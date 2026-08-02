"""Utility functions for VSIMS application."""

import shutil
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from logging import Logger
from pathlib import Path
from typing import Any, Dict, Optional


class ConfigError(Exception):
    """Configuration-related error."""
    pass


class ValidationError(Exception):
    """Input validation error."""
    pass


def find_available_port(host: str, start_port: int) -> int:
    """Find an available port starting from start_port."""
    import socket
    
    for port in range(start_port, start_port + 1000):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.bind((host, port))
            sock.close()
            return port
        except OSError:
            continue
    raise RuntimeError(f"Could not find available port near {start_port}")


@contextmanager
def get_db_connection(db_path: Path, timeout: float = 10, logger: Optional[Logger] = None):
    """Context manager for database connections with proper error handling."""
    conn = None
    try:
        conn = sqlite3.connect(db_path, timeout=timeout, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        # Enable WAL mode for better concurrency
        conn.execute("PRAGMA journal_mode = WAL")
        yield conn
    except sqlite3.DatabaseError as e:
        if logger:
            logger.error(f"Database error: {e}", exc_info=True)
        raise
    except Exception as e:
        if logger:
            logger.error(f"Unexpected error accessing database: {e}", exc_info=True)
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception as e:
                if logger:
                    logger.warning(f"Error closing database connection: {e}")


def backup_database(db_path: Path, backup_dir: Path, max_backups: int, logger: Optional[Logger] = None) -> Optional[Path]:
    """Create a backup of the database with automatic cleanup of old backups."""
    if not db_path.exists():
        if logger:
            logger.debug(f"Database {db_path} does not exist, skipping backup")
        return None
    
    try:
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"vsims_{timestamp}.db"
        shutil.copy2(db_path, backup_path)
        
        if logger:
            logger.info(f"Database backed up to {backup_path}")
        
        # Clean up old backups
        backups = sorted(backup_dir.glob("vsims_*.db"))
        if len(backups) > max_backups:
            for old_backup in backups[:-max_backups]:
                try:
                    old_backup.unlink()
                    if logger:
                        logger.info(f"Removed old backup {old_backup}")
                except Exception as e:
                    if logger:
                        logger.warning(f"Could not remove old backup {old_backup}: {e}")
        
        return backup_path
    except Exception as e:
        if logger:
            logger.error(f"Failed to backup database: {e}", exc_info=True)
        return None


def sanitize_input(text: str, max_length: int = 255, prohibited_chars: str = "") -> str:
    """Sanitize text input by removing prohibited characters and truncating."""
    if not isinstance(text, str):
        text = str(text)
    
    # Remove prohibited characters
    for char in prohibited_chars:
        text = text.replace(char, "")
    
    # Strip whitespace and truncate
    text = text.strip()[:max_length]
    
    return text


class InputValidator:
    """Validate various types of input for VSIMS."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize validator with configuration."""
        self.config = config.get("validation", {})
        self.max_text_length = self.config.get("max_text_length", 255)
        self.max_description_length = self.config.get("max_description_length", 1000)
        self.min_price = float(self.config.get("min_price", 0))
        self.max_price = float(self.config.get("max_price", 999999.99))
        self.min_quantity = int(self.config.get("min_quantity", 0))
        self.max_quantity = int(self.config.get("max_quantity", 999999))
        self.sanitize = config.get("security", {}).get("sanitize_input", True)
        self.prohibited_chars = config.get("security", {}).get("prohibited_chars", "")
    
    def validate_string(self, value: str, field_name: str, max_length: Optional[int] = None) -> str:
        """Validate and sanitize string input."""
        if value is None or value == "":
            raise ValidationError(f"{field_name} cannot be empty")
        
        if not isinstance(value, str):
            raise ValidationError(f"{field_name} must be a string")
        
        max_len = max_length or self.max_text_length
        if len(value) > max_len:
            raise ValidationError(f"{field_name} exceeds maximum length of {max_len} characters")
        
        if self.sanitize:
            value = sanitize_input(value, max_length=max_len, prohibited_chars=self.prohibited_chars)
        
        return value.strip()
    
    def validate_description(self, value: Optional[str], field_name: str = "description") -> str:
        """Validate description field."""
        if value is None:
            return ""
        
        return self.validate_string(value, field_name, max_length=self.max_description_length)
    
    def validate_price(self, value: Any, field_name: str) -> float:
        """Validate price input."""
        try:
            price = float(value) if value is not None else 0.0
        except (TypeError, ValueError):
            raise ValidationError(f"{field_name} must be a valid number")
        
        if price < self.min_price:
            raise ValidationError(f"{field_name} cannot be less than {self.min_price}")
        
        if price > self.max_price:
            raise ValidationError(f"{field_name} cannot exceed {self.max_price}")
        
        return round(price, 2)
    
    def validate_quantity(self, value: Any, field_name: str) -> int:
        """Validate quantity input."""
        try:
            qty = int(value) if value is not None else 0
        except (TypeError, ValueError):
            raise ValidationError(f"{field_name} must be a valid integer")
        
        if qty < self.min_quantity:
            raise ValidationError(f"{field_name} cannot be less than {self.min_quantity}")
        
        if qty > self.max_quantity:
            raise ValidationError(f"{field_name} cannot exceed {self.max_quantity}")
        
        return qty
    
    def validate_date(self, value: Optional[str], field_name: str = "date") -> str:
        """Validate date input (basic format check)."""
        if not value:
            return ""
        
        value = str(value).strip()

        # "—" (em dash) is the app's placeholder for "no transaction yet",
        # not an actual date — accept it as-is rather than length-checking it.
        if value == "—":
            return value

        # Accept common date formats: YYYY-MM-DD, DD Mon YYYY, etc.
        # For now, just check it's not empty and reasonable length
        if len(value) < 4 or len(value) > 20:
            raise ValidationError(f"{field_name} appears to be invalid: {value}")
        
        return value
    
    def validate_customer_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Validate customer creation/update payload."""
        try:
            validated = {
                "id": self.validate_string(payload.get("id", ""), "Customer ID"),
                "name": self.validate_string(payload.get("name", ""), "Customer Name"),
                "phone": self.validate_string(payload.get("phone", ""), "Phone"),
                "address": self.validate_string(payload.get("address", ""), "Address"),
                "balance": self.validate_price(payload.get("balance", 0), "Balance"),
                "type": self.validate_string(payload.get("type", ""), "Type"),
                "ytd": self.validate_price(payload.get("ytd", 0), "YTD"),
                "last_tx": self.validate_date(payload.get("last_tx") or payload.get("lastTx"), "Last Transaction"),
            }
            if not validated["last_tx"]:
                validated["last_tx"] = "—"
            return validated
        except (KeyError, ValidationError) as e:
            raise ValidationError(f"Invalid customer data: {e}")
    
    def validate_product_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Validate product creation/update payload."""
        try:
            validated = {
                "id": self.validate_string(payload.get("id", ""), "Product ID"),
                "barcode": self.validate_string(payload.get("barcode", ""), "Barcode"),
                "name": self.validate_string(payload.get("name", ""), "Product Name"),
                "category": self.validate_string(payload.get("category", ""), "Category"),
                "buy_price": self.validate_price(payload.get("buyPrice") or payload.get("buy_price"), "Buy Price"),
                "sell_price": self.validate_price(payload.get("sellPrice") or payload.get("sell_price"), "Sell Price"),
                "stock": self.validate_quantity(payload.get("stock"), "Stock"),
                "min_stock": self.validate_quantity(payload.get("minStock") or payload.get("min_stock"), "Min Stock"),
            }
            return validated
        except (KeyError, ValidationError) as e:
            raise ValidationError(f"Invalid product data: {e}")
    
    def validate_supplier_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Validate supplier creation/update payload."""
        try:
            validated = {
                "id": self.validate_string(payload.get("id", ""), "Supplier ID"),
                "name": self.validate_string(payload.get("name", ""), "Supplier Name"),
                "phone": self.validate_string(payload.get("phone", ""), "Phone"),
                "category": self.validate_string(payload.get("category", ""), "Category"),
                "outstanding": self.validate_price(payload.get("outstanding"), "Outstanding"),
                "ytd": self.validate_price(payload.get("ytd"), "YTD"),
                "terms": self.validate_string(payload.get("terms", ""), "Terms"),
            }
            return validated
        except (KeyError, ValidationError) as e:
            raise ValidationError(f"Invalid supplier data: {e}")
