"""Configuration loader for VSIMS application."""

import configparser
from pathlib import Path
from typing import Any, Dict, Optional


def load_config(config_file: Path) -> Dict[str, Any]:
    """Load configuration from config.ini file with defaults."""
    config = configparser.ConfigParser()
    
    # Default configuration
    defaults = {
        "server": {
            "host": "127.0.0.1",
            "port": "8000",
            "auto_open_browser": "true",
        },
        "database": {
            "db_filename": "vsims.db",
            "connection_timeout": "10",
            "wal_mode": "true",
            "busy_timeout": "5000",
        },
        "backup": {
            "enabled": "true",
            "backup_dir": "backups",
            "max_backups": "5",
        },
        "logging": {
            "log_filename": "vsims.log",
            "log_level": "INFO",
            "max_file_size": "2000000",
            "backup_count": "3",
        },
        "validation": {
            "max_text_length": "255",
            "max_description_length": "1000",
            "min_price": "0.00",
            "min_quantity": "0",
            "max_price": "999999.99",
            "max_quantity": "999999",
        },
        "security": {
            "sanitize_input": "true",
            "prohibited_chars": '<>:"/\\|?*',
        },
    }
    
    # Apply defaults
    for section, options in defaults.items():
        if not config.has_section(section):
            config.add_section(section)
        for option, value in options.items():
            if not config.has_option(section, option):
                config.set(section, option, value)
    
    # Try to read from file
    if config_file.exists():
        config.read(config_file, encoding="utf-8")
    
    # Convert to dictionary with type conversion
    config_dict = {}
    for section in config.sections():
        config_dict[section] = {}
        for option in config.options(section):
            value = config.get(section, option)
            # Type conversion
            if value.lower() in ("true", "false"):
                config_dict[section][option] = value.lower() == "true"
            else:
                try:
                    config_dict[section][option] = int(value)
                except ValueError:
                    try:
                        config_dict[section][option] = float(value)
                    except ValueError:
                        config_dict[section][option] = value
    
    return config_dict


def get_config_value(config: Dict[str, Any], section: str, option: str, default: Any = None) -> Any:
    """Safely get a config value with a default fallback."""
    try:
        return config[section][option]
    except KeyError:
        return default
