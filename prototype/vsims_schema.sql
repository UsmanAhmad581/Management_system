PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    balance REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    ytd REAL NOT NULL DEFAULT 0,
    last_tx TEXT
);

CREATE TABLE IF NOT EXISTS customer_invoices (
    invoice_no TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    category TEXT NOT NULL,
    outstanding REAL NOT NULL DEFAULT 0,
    ytd REAL NOT NULL DEFAULT 0,
    terms TEXT
);

CREATE TABLE IF NOT EXISTS supplier_history (
    purchase_no TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    buy_price REAL NOT NULL DEFAULT 0,
    sell_price REAL,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
    invoice_no TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    paid REAL NOT NULL DEFAULT 0,
    due REAL NOT NULL DEFAULT 0,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL,
    product_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_no) REFERENCES sales(invoice_no)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchases (
    invoice_no TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    paid REAL NOT NULL DEFAULT 0,
    due REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_no) REFERENCES purchases(invoice_no)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    ref TEXT PRIMARY KEY,
    party_name TEXT NOT NULL,
    party_type TEXT NOT NULL,
    party_id TEXT,
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    method TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL DEFAULT 0
);
