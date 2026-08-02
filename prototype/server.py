from __future__ import annotations

import json
import logging
import mimetypes
import shutil
import socket
import sqlite3
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from config_loader import load_config
from vsims_utils import (
    ValidationError,
    InputValidator,
    get_db_connection,
    backup_database,
    find_available_port,
)

# When running as a plain script, BASE_DIR (bundled files: HTML, schema) and
# APP_DIR (writable data: database, log file) are the same folder.
#
# When running as a PyInstaller --onefile build, bundled files are unpacked
# to a temporary folder at sys._MEIPASS, so BASE_DIR points there. Writable
# data must NOT live in that temp folder (it's wiped on every launch), so
# APP_DIR instead points at the folder containing the .exe, which keeps the
# database and log persistent across runs — matching the original behaviour
# of the plain-script version.
if getattr(sys, "frozen", False):
    BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    APP_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent
    APP_DIR = BASE_DIR

# Load configuration
CONFIG_FILE = APP_DIR / "config.ini"
config = load_config(CONFIG_FILE)

# Database configuration
DB_PATH = APP_DIR / config["database"]["db_filename"]
SCHEMA_PATH = BASE_DIR / "vsims_schema.sql"
DB_CONNECTION_TIMEOUT = config["database"]["connection_timeout"]
DB_BUSY_TIMEOUT = config["database"]["busy_timeout"]

# Server configuration
SERVER_HOST = config["server"]["host"]
SERVER_PORT = config["server"]["port"]
AUTO_OPEN_BROWSER = config["server"]["auto_open_browser"]

# Backup configuration
BACKUP_ENABLED = config["backup"]["enabled"]
BACKUP_DIR = APP_DIR / config["backup"]["backup_dir"]
MAX_BACKUPS = config["backup"]["max_backups"]

# Logging configuration
LOG_PATH = APP_DIR / config["logging"]["log_filename"]
LOG_LEVEL = getattr(logging, config["logging"]["log_level"], logging.INFO)
LOG_MAX_SIZE = config["logging"]["max_file_size"]
LOG_BACKUP_COUNT = config["logging"]["backup_count"]

# Initialize logger
logger = logging.getLogger("vsims")
logger.setLevel(LOG_LEVEL)
_log_handler = RotatingFileHandler(LOG_PATH, maxBytes=LOG_MAX_SIZE, backupCount=LOG_BACKUP_COUNT, encoding="utf-8")
_log_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(_log_handler)

# Input validation
validator = InputValidator(config)


def _log_uncaught_exceptions(exc_type, exc_value, exc_traceback):
    """Log uncaught exceptions with full context."""
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    logger.error("Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback))


sys.excepthook = _log_uncaught_exceptions


# Static files the server will serve directly, so the whole app runs
# from the single http://127.0.0.1:8000 origin and the browser never
# has to make a cross-origin request from a file:// page to the API.
STATIC_FILES = {
    "/": "VSIMS-Prototype.html",
    "/VSIMS-Prototype.html": "VSIMS-Prototype.html",
    "/index.html": "index.html",
    "/styles.css": "styles.css",
    "/app.js": "app.js",
}

# Directories (relative to BASE_DIR) that may be served as static assets
# beyond the fixed STATIC_FILES whitelist above. VSIMS-Prototype.html loads
# its logic as separate modules from js/ (js/api.js, js/auth.js, ...), so
# that folder needs to be servable too, not just the single legacy app.js.
STATIC_DIRS = {"js"}


CUSTOMERS = [
    {
        "id": "WALK-IN",
        "name": "Walk-in Customer",
        "phone": "000-0000000",
        "address": "Counter / Walk-in",
        "balance": 0,
        "type": "Retail",
        "ytd": 0,
        "last_tx": "—",
        "invoices": [],
    },
]

SUPPLIERS = []

PRODUCTS = []


def init_db() -> None:
    """Initialize database with schema, creating tables if needed."""
    # Validate schema file exists
    if not SCHEMA_PATH.exists():
        logger.error(f"Database schema file not found: {SCHEMA_PATH}")
        raise FileNotFoundError(f"Database schema file not found: {SCHEMA_PATH}")
    
    try:
        schema_content = SCHEMA_PATH.read_text(encoding="utf-8")
        logger.debug(f"Loaded schema from {SCHEMA_PATH}")
    except Exception as e:
        logger.error(f"Failed to read schema file {SCHEMA_PATH}: {e}", exc_info=True)
        raise
    
    # Initialize database with schema
    try:
        with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
            conn.executescript(schema_content)
            
            # Insert default customer if not exists
            for row in CUSTOMERS:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO customers
                    (id, name, phone, address, balance, type, ytd, last_tx)
                    VALUES (:id, :name, :phone, :address, :balance, :type, :ytd, :last_tx)
                    """,
                    row,
                )
                for invoice in row.get("invoices", []):
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO customer_invoices
                        (invoice_no, customer_id, invoice_date, amount)
                        VALUES (:no, :customer_id, :date, :amt)
                        """,
                        {"no": invoice["no"], "customer_id": row["id"], "date": invoice["date"], "amt": invoice["amt"]},
                    )
            
            # Insert default suppliers if any
            for row in SUPPLIERS:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO suppliers
                    (id, name, phone, category, outstanding, ytd, terms)
                    VALUES (:id, :name, :phone, :category, :outstanding, :ytd, :terms)
                    """,
                    row,
                )
                for history in row.get("history", []):
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO supplier_history
                        (purchase_no, supplier_id, purchase_date, amount)
                        VALUES (:no, :supplier_id, :date, :amt)
                        """,
                        {"no": history["no"], "supplier_id": row["id"], "date": history["date"], "amt": history["amt"]},
                    )
            
            # Insert default products if any
            for row in PRODUCTS:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO products
                    (id, barcode, name, category, buy_price, sell_price, stock, min_stock)
                    VALUES (:id, :barcode, :name, :category, :buyPrice, :sellPrice, :stock, :minStock)
                    """,
                    row,
                )
            conn.commit()
        logger.info(f"Database initialized successfully at {DB_PATH}")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)
        raise


def connect_db(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Open and return a raw sqlite3 connection to the database.

    Unlike get_db_connection() (a context manager meant for `with` blocks
    inside request handlers), this returns the connection object directly
    so callers that manage their own lifecycle (e.g. the test suite) can
    open it, use it, and close it themselves.
    """
    path = db_path or DB_PATH
    conn = sqlite3.connect(path, timeout=DB_CONNECTION_TIMEOUT, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _normalize_expense_row(payload):
    """Normalize expense row data from request."""
    return {
        "expense_date": payload.get("date") or payload.get("expense_date") or payload.get("expenseDate") or "24 Jul 2026",
        "category": payload.get("category") or payload.get("cat") or "Other",
        "description": payload.get("desc") or payload.get("description") or payload.get("note") or "Miscellaneous expense",
        "amount": float(payload.get("amount") or 0),
    }


def _apply_stock_delta(conn, item, direction: int) -> None:
    """Apply stock delta (increase/decrease) for a product."""
    qty = int(item.get("qty") or 0)
    if qty <= 0:
        return

    product_id = item.get("productId") or item.get("product_id") or item.get("id")
    if product_id:
        conn.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (direction * qty, product_id))
        return

    product_name = item.get("name") or item.get("product_name")
    if product_name:
        conn.execute("UPDATE products SET stock = stock + ? WHERE name = ?", (direction * qty, product_name))


def _sale_items_for(conn, invoice_no: str):
    """Retrieve sale items for an invoice."""
    return [
        dict(r)
        for r in conn.execute(
            "SELECT product_name AS name, qty, price, discount, total FROM sale_items WHERE invoice_no = ? ORDER BY id",
            (invoice_no,),
        ).fetchall()
    ]


def _purchase_items_for(conn, invoice_no: str):
    """Retrieve purchase items for an invoice."""
    return [
        dict(r)
        for r in conn.execute(
            "SELECT item_name AS name, qty, price, discount, tax, total FROM purchase_items WHERE invoice_no = ? ORDER BY id",
            (invoice_no,),
        ).fetchall()
    ]



class VSIMSHandler(BaseHTTPRequestHandler):
    """HTTP request handler for VSIMS API."""
    
    def log_message(self, format: str, *args) -> None:
        """Log HTTP messages with request context."""
        logger.info("%s - %s", self.address_string(), format % args)

    def _set_headers(self, status=200):
        """Set response headers for JSON responses."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _read_json(self):
        """Read and parse JSON from request body with error handling."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            if not body:
                return {}
            payload = json.loads(body.decode("utf-8"))
            logger.debug(f"Received JSON payload: {payload}")
            return payload
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in request: {e}")
            raise ValidationError(f"Invalid JSON: {e}")
        except Exception as e:
            logger.error(f"Error reading request body: {e}", exc_info=True)
            raise ValidationError(f"Error reading request: {e}")

    def _json(self, payload, status=200):
        """Write JSON response."""
        try:
            self._set_headers(status)
            response = json.dumps(payload).encode("utf-8")
            self.wfile.write(response)
        except Exception as e:
            logger.error(f"Error writing response: {e}", exc_info=True)

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self._set_headers(200)

    def _serve_static(self, filename: str) -> bool:
        """Serve static files (HTML, CSS, JS) with error handling."""
        try:
            file_path = BASE_DIR / filename
            if not file_path.is_file():
                logger.warning(f"Static file not found: {filename}")
                self._json({"error": f"Static file not found: {filename}"}, status=404)
                return True
            content_type, _ = mimetypes.guess_type(str(file_path))
            self.send_response(200)
            self.send_header("Content-Type", content_type or "application/octet-stream")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(file_path.read_bytes())
            return True
        except Exception as e:
            logger.error(f"Error serving static file {filename}: {e}", exc_info=True)
            self._json({"error": "Error serving file"}, status=500)
            return True

    def _resolve_static_dir_file(self, path: str) -> Optional[Path]:
        """Resolve a request path to a file inside an allowed static directory.

        Returns None if the path doesn't fall under one of STATIC_DIRS, or if
        it would resolve outside BASE_DIR (path traversal, e.g. "..").
        """
        parts = [p for p in path.split("/") if p]
        if not parts or parts[0] not in STATIC_DIRS:
            return None

        candidate = (BASE_DIR / Path(*parts)).resolve()
        try:
            candidate.relative_to(BASE_DIR.resolve())
        except ValueError:
            return None
        return candidate

    def do_GET(self):
        """Handle GET requests for API endpoints."""
        try:
            path = urlparse(self.path).path
            parts = [p for p in path.split("/") if p]
            entity = parts[1] if len(parts) >= 2 else None

            if path in STATIC_FILES:
                self._serve_static(STATIC_FILES[path])
                return

            static_dir_file = self._resolve_static_dir_file(path)
            if static_dir_file is not None:
                if static_dir_file.is_file():
                    self._serve_static(str(static_dir_file.relative_to(BASE_DIR)))
                else:
                    logger.warning(f"Static file not found: {path}")
                    self._json({"error": f"Static file not found: {path}"}, status=404)
                return

            if path == "/api/health":
                self._json({"ok": True, "database": str(DB_PATH), "version": "1.0"})
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "customers":
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    rows = conn.execute("SELECT * FROM customers ORDER BY id DESC").fetchall()
                    payload = []
                    for row in rows:
                        record = dict(row)
                        record["lastTx"] = record.pop("last_tx")
                        record["invoices"] = [
                            dict(r)
                            for r in conn.execute(
                                "SELECT invoice_no AS no, invoice_date AS date, amount AS amt FROM customer_invoices WHERE customer_id = ? ORDER BY invoice_date DESC",
                                (record["id"],),
                            ).fetchall()
                        ]
                        payload.append(record)
                    self._json(payload)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "suppliers":
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    rows = conn.execute("SELECT * FROM suppliers ORDER BY id DESC").fetchall()
                    payload = []
                    for row in rows:
                        record = dict(row)
                        record["history"] = [
                            dict(r)
                            for r in conn.execute(
                                "SELECT purchase_no AS no, purchase_date AS date, amount AS amt FROM supplier_history WHERE supplier_id = ? ORDER BY purchase_date DESC",
                                (record["id"],),
                            ).fetchall()
                        ]
                        payload.append(record)
                    self._json(payload)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "products":
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
                    payload = []
                    for row in rows:
                        record = dict(row)
                        record["buyPrice"] = record.pop("buy_price")
                        record["sellPrice"] = record.pop("sell_price")
                        record["minStock"] = record.pop("min_stock")
                        payload.append(record)
                    self._json(payload)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "sales":
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    rows = conn.execute("SELECT * FROM sales ORDER BY invoice_date DESC, invoice_no DESC").fetchall()
                    payload = []
                    for row in rows:
                        record = dict(row)
                        record["invoiceNo"] = record.pop("invoice_no")
                        record["customerId"] = record.pop("customer_id")
                        record["customerName"] = record.pop("customer_name")
                        record["date"] = record.pop("invoice_date")
                        record["items"] = _sale_items_for(conn, record["invoiceNo"])
                        payload.append(record)
                    self._json(payload)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "purchases":
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    rows = conn.execute("SELECT * FROM purchases ORDER BY invoice_date DESC, invoice_no DESC").fetchall()
                    payload = []
                    for row in rows:
                        record = dict(row)
                        record["invoiceNo"] = record.pop("invoice_no")
                        record["supplierId"] = record.pop("supplier_id")
                        record["supplierName"] = record.pop("supplier_name")
                        record["date"] = record.pop("invoice_date")
                        record["items"] = _purchase_items_for(conn, record["invoiceNo"])
                        payload.append(record)
                    self._json(payload)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "payments":
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    rows = conn.execute("SELECT * FROM payments ORDER BY payment_date DESC, ref DESC").fetchall()
                    payload = []
                    for row in rows:
                        record = dict(row)
                        record["partyName"] = record.pop("party_name")
                        record["type"] = record.pop("party_type")
                        record["partyId"] = record.pop("party_id")
                        record["date"] = record.pop("payment_date")
                        payload.append(record)
                    self._json(payload)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "expenses":
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    rows = conn.execute("SELECT * FROM expenses ORDER BY expense_date DESC, id DESC").fetchall()
                    payload = []
                    for row in rows:
                        record = dict(row)
                        record["date"] = record.get("expense_date")
                        record["desc"] = record.get("description") or "Miscellaneous expense"
                        record["amount"] = float(record.get("amount") or 0)
                        payload.append(record)
                    self._json(payload)
                return

            logger.warning(f"Unhandled GET request: {path}")
            self._json({"error": "Not found"}, status=404)
        except ValidationError as e:
            logger.warning(f"Validation error in GET: {e}")
            self._json({"error": str(e)}, status=400)
        except Exception as e:
            logger.error(f"Error processing GET request: {e}", exc_info=True)
            self._json({"error": "Internal server error"}, status=500)


    def do_POST(self):
        """Handle POST requests for creating new records."""
        try:
            path = urlparse(self.path).path
            parts = [p for p in path.split("/") if p]
            entity = parts[1] if len(parts) >= 2 else None
            
            try:
                payload = self._read_json()
            except ValidationError as e:
                logger.warning(f"Invalid JSON in POST: {e}")
                self._json({"error": str(e)}, status=400)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "customers":
                try:
                    validated = validator.validate_customer_payload(payload)
                    with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                        conn.execute(
                            """
                            INSERT INTO customers (id, name, phone, address, balance, type, ytd, last_tx)
                            VALUES (:id, :name, :phone, :address, :balance, :type, :ytd, :last_tx)
                            """,
                            validated,
                        )
                        conn.commit()
                    validated["lastTx"] = validated["last_tx"]
                    logger.info(f"Customer created: {validated['id']}")
                    self._json(validated)
                except ValidationError as e:
                    logger.warning(f"Validation error in customer creation: {e}")
                    self._json({"error": str(e)}, status=400)
                except sqlite3.IntegrityError as e:
                    logger.error(f"Database integrity error: {e}")
                    self._json({"error": "Customer already exists"}, status=409)
                except Exception as e:
                    logger.error(f"Error creating customer: {e}", exc_info=True)
                    self._json({"error": "Internal server error"}, status=500)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "suppliers":
                try:
                    validated = validator.validate_supplier_payload(payload)
                    with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                        conn.execute(
                            """
                            INSERT INTO suppliers (id, name, phone, category, outstanding, ytd, terms)
                            VALUES (:id, :name, :phone, :category, :outstanding, :ytd, :terms)
                            """,
                            validated,
                        )
                        conn.commit()
                    logger.info(f"Supplier created: {validated['id']}")
                    self._json(validated)
                except ValidationError as e:
                    logger.warning(f"Validation error in supplier creation: {e}")
                    self._json({"error": str(e)}, status=400)
                except Exception as e:
                    logger.error(f"Error creating supplier: {e}", exc_info=True)
                    self._json({"error": "Internal server error"}, status=500)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "products":
                try:
                    validated = validator.validate_product_payload(payload)
                    with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                        conn.execute(
                            """
                            INSERT INTO products (id, barcode, name, category, buy_price, sell_price, stock, min_stock)
                            VALUES (:id, :barcode, :name, :category, :buy_price, :sell_price, :stock, :min_stock)
                            """,
                            validated,
                        )
                        conn.commit()
                    logger.info(f"Product created: {validated['id']}")
                    self._json(validated)
                except ValidationError as e:
                    logger.warning(f"Validation error in product creation: {e}")
                    self._json({"error": str(e)}, status=400)
                except Exception as e:
                    logger.error(f"Error creating product: {e}", exc_info=True)
                    self._json({"error": "Internal server error"}, status=500)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "sales":
                try:
                    sale_items = payload.pop("items", [])
                    sale_row = {
                        "invoice_no": payload.get("invoiceNo") or payload.get("invoice_no"),
                        "customer_id": payload.get("customerId") or "WALK-IN",
                        "customer_name": payload.get("customerName") or "Walk-in Customer",
                        "invoice_date": payload.get("date") or payload.get("invoiceDate") or "24 Jul 2026",
                        "subtotal": validator.validate_price(payload.get("subtotal", 0), "Subtotal"),
                        "discount": validator.validate_price(payload.get("discount", 0), "Discount"),
                        "tax": validator.validate_price(payload.get("tax", 0), "Tax"),
                        "total": validator.validate_price(payload.get("total", 0), "Total"),
                        "paid": validator.validate_price(payload.get("paid", 0), "Paid"),
                        "due": validator.validate_price(payload.get("due", 0), "Due"),
                        "method": payload.get("method") or "Cash",
                        "status": payload.get("status") or "Paid",
                    }
                    with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                        conn.execute(
                            """
                            INSERT INTO sales
                            (invoice_no, customer_id, customer_name, invoice_date, subtotal, discount, tax, total, paid, due, method, status)
                            VALUES (:invoice_no, :customer_id, :customer_name, :invoice_date, :subtotal, :discount, :tax, :total, :paid, :due, :method, :status)
                            """,
                            sale_row,
                        )
                        for item in sale_items:
                            conn.execute(
                                """
                                INSERT INTO sale_items (invoice_no, product_name, qty, price, discount, total)
                                VALUES (:invoice_no, :product_name, :qty, :price, :discount, :total)
                                """,
                                {
                                    "invoice_no": sale_row["invoice_no"],
                                    "product_name": item.get("name") or item.get("product_name"),
                                    "qty": validator.validate_quantity(item.get("qty"), "Item quantity"),
                                    "price": validator.validate_price(item.get("price"), "Item price"),
                                    "discount": validator.validate_price(item.get("discount", 0), "Item discount"),
                                    "total": validator.validate_price(item.get("total"), "Item total"),
                                },
                            )
                            _apply_stock_delta(conn, item, -1)
                        if sale_row["customer_id"] and sale_row["customer_id"] != "WALK-IN":
                            conn.execute(
                                "UPDATE customers SET balance = balance + ?, ytd = ytd + ?, last_tx = ? WHERE id = ?",
                                (sale_row["due"], sale_row["total"], sale_row["invoice_date"], sale_row["customer_id"]),
                            )
                            if sale_row["due"] > 0:
                                conn.execute(
                                    """
                                    INSERT OR REPLACE INTO customer_invoices
                                    (invoice_no, customer_id, invoice_date, amount)
                                    VALUES (?, ?, ?, ?)
                                    """,
                                    (sale_row["invoice_no"], sale_row["customer_id"], sale_row["invoice_date"], sale_row["due"]),
                                )
                        conn.commit()
                    logger.info(f"Sale created: {sale_row['invoice_no']}")
                    self._json({"saved": sale_row["invoice_no"]})
                except ValidationError as e:
                    logger.warning(f"Validation error in sale creation: {e}")
                    self._json({"error": str(e)}, status=400)
                except Exception as e:
                    logger.error(f"Error creating sale: {e}", exc_info=True)
                    self._json({"error": "Internal server error"}, status=500)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "purchases":
                try:
                    purchase_items = payload.pop("items", [])
                    purchase_row = {
                        "invoice_no": payload.get("invoiceNo") or payload.get("invoice_no"),
                        "supplier_id": payload.get("supplierId") or payload.get("supplier_id"),
                        "supplier_name": payload.get("supplierName") or payload.get("supplier_name"),
                        "invoice_date": payload.get("date") or payload.get("invoiceDate") or "24 Jul 2026",
                        "total": validator.validate_price(payload.get("total", 0), "Total"),
                        "paid": validator.validate_price(payload.get("paid", 0), "Paid"),
                        "due": validator.validate_price(payload.get("due", 0), "Due"),
                        "status": payload.get("status") or "Paid",
                    }
                    with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                        conn.execute(
                            """
                            INSERT INTO purchases
                            (invoice_no, supplier_id, supplier_name, invoice_date, total, paid, due, status)
                            VALUES (:invoice_no, :supplier_id, :supplier_name, :invoice_date, :total, :paid, :due, :status)
                            """,
                            purchase_row,
                        )
                        for item in purchase_items:
                            conn.execute(
                                """
                                INSERT INTO purchase_items (invoice_no, item_name, qty, price, discount, tax, total)
                                VALUES (:invoice_no, :item_name, :qty, :price, :discount, :tax, :total)
                                """,
                                {
                                    "invoice_no": purchase_row["invoice_no"],
                                    "item_name": item.get("name") or item.get("item_name"),
                                    "qty": validator.validate_quantity(item.get("qty"), "Item quantity"),
                                    "price": validator.validate_price(item.get("price"), "Item price"),
                                    "discount": validator.validate_price(item.get("discount", 0), "Item discount"),
                                    "tax": validator.validate_price(item.get("tax", 0), "Item tax"),
                                    "total": validator.validate_price(item.get("total"), "Item total"),
                                },
                            )
                            _apply_stock_delta(conn, item, 1)
                        conn.execute(
                            "UPDATE suppliers SET outstanding = outstanding + ?, ytd = ytd + ? WHERE id = ?",
                            (purchase_row["due"], purchase_row["total"], purchase_row["supplier_id"]),
                        )
                        if purchase_row["due"] > 0:
                            conn.execute(
                                """
                                INSERT OR REPLACE INTO supplier_history
                                (purchase_no, supplier_id, purchase_date, amount)
                                VALUES (?, ?, ?, ?)
                                """,
                                (purchase_row["invoice_no"], purchase_row["supplier_id"], purchase_row["invoice_date"], purchase_row["total"]),
                            )
                        conn.commit()
                    logger.info(f"Purchase created: {purchase_row['invoice_no']}")
                    self._json({"saved": purchase_row["invoice_no"]})
                except ValidationError as e:
                    logger.warning(f"Validation error in purchase creation: {e}")
                    self._json({"error": str(e)}, status=400)
                except Exception as e:
                    logger.error(f"Error creating purchase: {e}", exc_info=True)
                    self._json({"error": "Internal server error"}, status=500)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "payments":
                try:
                    payment_row = {
                        "ref": validator.validate_string(payload.get("ref", ""), "Reference"),
                        "party_name": validator.validate_string(payload.get("partyName", ""), "Party name"),
                        "party_type": payload.get("type") or payload.get("party_type"),
                        "party_id": payload.get("partyId") or payload.get("party_id"),
                        "payment_date": validator.validate_date(payload.get("date") or payload.get("payment_date"), "Payment date"),
                        "amount": validator.validate_price(payload.get("amount"), "Amount"),
                        "method": payload.get("method") or "Cash",
                        "status": payload.get("status") or "Cleared",
                    }
                    with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                        conn.execute(
                            """
                            INSERT INTO payments
                            (ref, party_name, party_type, party_id, payment_date, amount, method, status)
                            VALUES (:ref, :party_name, :party_type, :party_id, :payment_date, :amount, :method, :status)
                            """,
                            payment_row,
                        )
                        if payment_row["party_type"] == "Customer" and payment_row["party_id"]:
                            conn.execute(
                                "UPDATE customers SET balance = MAX(0, balance - ?), last_tx = ? WHERE id = ?",
                                (payment_row["amount"], payment_row["payment_date"], payment_row["party_id"]),
                            )
                        elif payment_row["party_type"] == "Supplier" and payment_row["party_id"]:
                            conn.execute(
                                "UPDATE suppliers SET outstanding = MAX(0, outstanding - ?) WHERE id = ?",
                                (payment_row["amount"], payment_row["party_id"]),
                            )
                        conn.commit()
                    logger.info(f"Payment created: {payment_row['ref']}")
                    self._json({"saved": payment_row["ref"]})
                except ValidationError as e:
                    logger.warning(f"Validation error in payment creation: {e}")
                    self._json({"error": str(e)}, status=400)
                except Exception as e:
                    logger.error(f"Error creating payment: {e}", exc_info=True)
                    self._json({"error": "Internal server error"}, status=500)
                return

            if len(parts) == 2 and parts[0] == "api" and entity == "expenses":
                try:
                    expense_row = _normalize_expense_row(payload)
                    expense_row["category"] = validator.validate_string(expense_row["category"], "Category")
                    expense_row["description"] = validator.validate_description(expense_row["description"])
                    expense_row["amount"] = validator.validate_price(expense_row["amount"], "Amount")
                    
                    with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                        conn.execute(
                            """
                            INSERT INTO expenses (expense_date, category, description, amount)
                            VALUES (:expense_date, :category, :description, :amount)
                            """,
                            expense_row,
                        )
                        conn.commit()
                    logger.info(f"Expense created: {expense_row['category']}")
                    self._json({
                        "saved": True,
                        "expense": {
                            "date": expense_row["expense_date"],
                            "category": expense_row["category"],
                            "desc": expense_row["description"],
                            "amount": expense_row["amount"]
                        }
                    })
                except ValidationError as e:
                    logger.warning(f"Validation error in expense creation: {e}")
                    self._json({"error": str(e)}, status=400)
                except Exception as e:
                    logger.error(f"Error creating expense: {e}", exc_info=True)
                    self._json({"error": "Internal server error"}, status=500)
                return

            logger.warning(f"Unhandled POST request: {path}")
            self._json({"error": "Not found"}, status=404)
        except Exception as e:
            logger.error(f"Unexpected error in POST handler: {e}", exc_info=True)
            self._json({"error": "Internal server error"}, status=500)


    def do_PUT(self):
        """Handle PUT requests for updating records."""
        try:
            path = urlparse(self.path).path
            parts = [p for p in path.split("/") if p]
            
            if len(parts) != 3 or parts[0] != "api":
                logger.warning(f"Invalid PUT request path: {path}")
                self._json({"error": "Not found"}, status=404)
                return

            entity, entity_id = parts[1], parts[2]
            
            try:
                payload = self._read_json()
            except ValidationError as e:
                self._json({"error": str(e)}, status=400)
                return

            try:
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    if entity == "customers":
                        validated = validator.validate_customer_payload(payload)
                        conn.execute(
                            """
                            UPDATE customers
                            SET name = ?, phone = ?, address = ?, balance = ?, type = ?, ytd = ?, last_tx = ?
                            WHERE id = ?
                            """,
                            (
                                validated["name"],
                                validated["phone"],
                                validated["address"],
                                validated["balance"],
                                validated["type"],
                                validated["ytd"],
                                validated["last_tx"],
                                entity_id,
                            ),
                        )
                        conn.commit()
                        validated["lastTx"] = validated["last_tx"]
                        logger.info(f"Customer updated: {entity_id}")
                        self._json(validated)
                    elif entity == "suppliers":
                        validated = validator.validate_supplier_payload(payload)
                        conn.execute(
                            """
                            UPDATE suppliers
                            SET name = ?, phone = ?, category = ?, outstanding = ?, ytd = ?, terms = ?
                            WHERE id = ?
                            """,
                            (
                                validated["name"],
                                validated["phone"],
                                validated["category"],
                                validated["outstanding"],
                                validated["ytd"],
                                validated["terms"],
                                entity_id,
                            ),
                        )
                        conn.commit()
                        logger.info(f"Supplier updated: {entity_id}")
                        self._json(validated)
                    elif entity == "products":
                        validated = validator.validate_product_payload(payload)
                        conn.execute(
                            """
                            UPDATE products
                            SET barcode = ?, name = ?, category = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?
                            WHERE id = ?
                            """,
                            (
                                validated["barcode"],
                                validated["name"],
                                validated["category"],
                                validated["buy_price"],
                                validated["sell_price"],
                                validated["stock"],
                                validated["min_stock"],
                                entity_id,
                            ),
                        )
                        conn.commit()
                        logger.info(f"Product updated: {entity_id}")
                        self._json(validated)
                    else:
                        logger.warning(f"Unknown entity for PUT: {entity}")
                        self._json({"error": "Not found"}, status=404)
            except ValidationError as e:
                logger.warning(f"Validation error in PUT: {e}")
                self._json({"error": str(e)}, status=400)
            except Exception as e:
                logger.error(f"Error processing PUT request: {e}", exc_info=True)
                self._json({"error": "Internal server error"}, status=500)
        except Exception as e:
            logger.error(f"Unexpected error in PUT handler: {e}", exc_info=True)
            self._json({"error": "Internal server error"}, status=500)

    def do_DELETE(self):
        """Handle DELETE requests for removing records."""
        try:
            path = urlparse(self.path).path
            parts = [p for p in path.split("/") if p]
            
            if len(parts) != 3 or parts[0] != "api":
                logger.warning(f"Invalid DELETE request path: {path}")
                self._json({"error": "Not found"}, status=404)
                return

            entity, entity_id = parts[1], parts[2]
            
            try:
                with get_db_connection(DB_PATH, timeout=DB_CONNECTION_TIMEOUT, logger=logger) as conn:
                    if entity == "customers":
                        conn.execute("DELETE FROM customers WHERE id = ?", (entity_id,))
                    elif entity == "suppliers":
                        conn.execute("DELETE FROM suppliers WHERE id = ?", (entity_id,))
                    elif entity == "products":
                        conn.execute("DELETE FROM products WHERE id = ?", (entity_id,))
                    else:
                        logger.warning(f"Unknown entity for DELETE: {entity}")
                        self._json({"error": "Not found"}, status=404)
                        return
                    conn.commit()
                    logger.info(f"{entity.capitalize()} deleted: {entity_id}")
                    self._json({"deleted": entity_id})
            except Exception as e:
                logger.error(f"Error processing DELETE request: {e}", exc_info=True)
                self._json({"error": "Internal server error"}, status=500)
        except Exception as e:
            logger.error(f"Unexpected error in DELETE handler: {e}", exc_info=True)
            self._json({"error": "Internal server error"}, status=500)



def _run_with_tray_icon(server: ThreadingHTTPServer, app_url: str) -> None:
    """Show a system tray icon for app control and graceful shutdown.
    
    Falls back to plain background operation if pystray/Pillow aren't available.
    Ensures proper cleanup of resources on shutdown."""
    def _run_without_tray():
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            logger.info("VSIMS API server stopping (keyboard interrupt)...")
        finally:
            server.server_close()
            logger.info("VSIMS API server shut down cleanly")

    try:
        import pystray
        from PIL import Image, ImageDraw
    except ImportError:
        logger.info("pystray/Pillow not available; running without a tray icon")
        _run_without_tray()
        return
    except Exception as e:
        # pystray can fail at import time for reasons other than ImportError
        # (e.g. no system tray backend available on this OS/desktop environment)
        logger.warning(f"Tray icon backend unavailable ({e}); running without a tray icon")
        _run_without_tray()
        return

    def make_icon_image():
        """Create a simple icon image for the system tray."""
        img = Image.new("RGB", (64, 64), "#2E7D32")
        draw = ImageDraw.Draw(img)
        draw.ellipse((14, 14, 50, 50), fill="#FF9800")
        return img

    def on_open(icon, item):
        """Open the app in the default browser."""
        webbrowser.open(app_url)

    def on_quit(icon, item):
        """Gracefully shut down the server and exit."""
        logger.info("VSIMS API server stopping (tray quit)...")
        icon.stop()
        server.shutdown()

    icon = pystray.Icon(
        "vsims",
        make_icon_image(),
        "VSIMS Server",
        menu=pystray.Menu(
            pystray.MenuItem("Open VSIMS", on_open, default=True),
            pystray.MenuItem("Quit", on_quit),
        ),
    )

    # Start server in background thread
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    
    try:
        # Run tray icon (blocks until on_quit calls icon.stop())
        icon.run()
    except Exception as e:
        logger.error(f"Error running tray icon: {e}", exc_info=True)
    finally:
        # Ensure server is fully shut down
        try:
            server.server_close()
            logger.info("VSIMS API server shut down cleanly")
        except Exception as e:
            logger.warning(f"Error closing server: {e}")


if __name__ == "__main__":
    try:
        logger.info("=" * 70)
        logger.info("VSIMS API server starting up...")
        logger.info(f"Configuration loaded from {CONFIG_FILE}")
        logger.info(f"Database: {DB_PATH}")
        logger.info(f"Log level: {LOG_LEVEL}")
        logger.info("=" * 70)

        # Initialize database
        init_db()

        # Create automatic backups if enabled
        if BACKUP_ENABLED:
            logger.info("Creating database backup...")
            backup_path = backup_database(DB_PATH, BACKUP_DIR, MAX_BACKUPS, logger)
            if backup_path:
                logger.info(f"Backup created: {backup_path}")

        # Determine server port (auto-find if configured to 0)
        server_port = SERVER_PORT
        if server_port == 0:
            logger.info(f"Auto-detecting available port starting from 8000...")
            server_port = find_available_port(SERVER_HOST, 8000)
            logger.info(f"Using port {server_port}")

        # Construct URL
        APP_URL = f"http://{SERVER_HOST}:{server_port}/"

        # Start server
        server = ThreadingHTTPServer((SERVER_HOST, server_port), VSIMSHandler)
        logger.info(f"VSIMS API server running at {APP_URL}")

        # Open browser if configured
        if AUTO_OPEN_BROWSER:
            threading.Timer(1.0, lambda: webbrowser.open(APP_URL)).start()

        # Run server with tray icon support
        _run_with_tray_icon(server, APP_URL)

    except KeyboardInterrupt:
        logger.info("VSIMS API server stopping (keyboard interrupt)...")
    except FileNotFoundError as e:
        logger.error(f"Startup error: {e}")
        logger.error("Please ensure vsims_schema.sql is in the application directory.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"VSIMS API server crashed during startup: {e}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("=" * 70)
        logger.info("VSIMS API server shutdown complete")
        logger.info("=" * 70)

