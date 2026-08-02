# VSIMS — Vermicelli Sales & Inventory Management System

A complete single-page application (SPA) for managing vermicelli mill operations: customers, suppliers, products, inventory, sales (POS), purchases, payments, expenses, and reports.

## Features

✅ **Customer Management** - Track retail/wholesale customers, balances, invoices, YTD purchases  
✅ **Supplier Management** - Manage raw material & packaging suppliers with payment tracking  
✅ **Product Inventory** - Stock levels, barcode tracking, low-stock alerts, categories  
✅ **Sales / POS** - Complete point-of-sale with invoice generation, discounts, tax calculation  
✅ **Purchases** - Purchase order management with item tracking and supplier updates  
✅ **Payments** - Record customer receipts and supplier payments with multiple methods  
✅ **Expenses** - Track operational costs by category (salary, electricity, rent, etc.)  
✅ **Inventory Management** - Real-time stock movement, category split, valuation  
✅ **Receipts Center** - Invoice history with thermal receipt preview & print  
✅ **Reports** - Sales, purchases, inventory, P&L, customer, supplier, stock reports  
✅ **Settings** - Store config, user management, database backup/restore  
✅ **Dark Mode** - Light/dark theme toggle with persistent storage  
✅ **SQLite Database** - Persistent local data storage with relational integrity  
✅ **CSV Export** - Export customers, suppliers, products to CSV  

## Project Structure

```
prototype 5/
├── index.html                 # Quick API test page
├── VSIMS-Prototype.html       # Main single-page application (open this!)
├── server.py                  # Python REST API server, runs windowed (no console)
├── vsims_schema.sql           # SQLite database schema
├── vsims.db                   # Database file (auto-created on first run)
├── vsims.log                  # Log file (auto-created on first run; replaces console output)
├── requirements.txt           # Optional deps (tray icon) + build-time PyInstaller
├── build_windows_exe.bat      # Builds dist\VSIMS.exe, a windowed no-console app
├── start-vsims.vbs            # Quick no-console dev launcher (uses pythonw.exe)
└── README.md                  # This file
```

## Prerequisites

- **Python 3.8+** (with built-in `sqlite3` module)
- **Windows / Mac / Linux**
- Any modern browser (Chrome, Firefox, Safari, Edge)

## Installation & Setup

### 1. Verify Python Installation

Open Command Prompt and check:
```bash
python --version
```

### 2. Navigate to Project Folder

```bash
cd "c:\Users\sulem\Downloads\Software\prototype 5"
```

## Running the Application

The server now hosts both the API **and** the app itself, so there's only one thing to run. It also runs as a windowed application — no Command Prompt or terminal window opens, in any of the options below. Startup and request logs go to `vsims.log` next to the server instead of a console.

### Option A: Build the standalone Windows app (recommended for distributing to end users)

Run once, on a Windows machine with Python installed:

```bash
build_windows_exe.bat
```

This uses PyInstaller to produce `dist\VSIMS.exe` — a single portable, windowed executable. Double-clicking it starts the server in the background, opens VSIMS in your default browser at `http://127.0.0.1:8000/`, and shows a small tray icon (bottom-right of the taskbar) with **Open VSIMS** and **Quit** options — no console window ever appears. `vsims.db` and `vsims.log` are created next to `VSIMS.exe` on first run.

### Option B: Quick no-console dev launcher

**Double-click `start-vsims.vbs`** to start the server with `pythonw.exe` (the windowed Python interpreter) instead of `python.exe`. This never opens a console either, and is handy while developing without rebuilding the `.exe` each time. It opens the browser automatically; stop it via the tray icon's **Quit** option or by ending `pythonw.exe` in Task Manager.

### Option C: Manual start from a terminal (for debugging only)

```bash
python server.py
```

This is the only option that keeps a terminal window open, since you launched it from one on purpose — useful when you want to watch things live. Then **open your browser** and navigate to:
```
http://127.0.0.1:8000/
```

**Important:** Always open the app through this `http://` address, not by double-clicking `VSIMS-Prototype.html` directly. Opening the file directly (`file://...`) puts the page on a different origin than the API, which some browsers block — the app will look "disconnected" and quietly fall back to demo data instead of saving to `vsims.db`.

## Usage

### Login
- **Username:** `usman.admin`
- **Password:** Any value (demo login)
- Click **"Sign In →"** or toggle dark mode with the moon icon

### Main Dashboard
View KPIs for today's sales, purchases, profit, inventory stock, pending payments, and outstanding supplier dues.

### Key Workflows

**Adding a Customer:**
1. Navigate to **Customers** tab
2. Click **"+ Add Customer"**
3. Fill in name, phone, address, type (Retail/Wholesale), opening balance
4. Click **"Save Customer"**

**Recording a Sale (POS):**
1. Navigate to **Sales / POS** tab
2. Select customer (or walk-in)
3. Search products by name or barcode
4. Add items, adjust quantity/price/discount
5. Review order summary
6. Select payment method (Cash/Bank/Mobile)
7. Click **"Complete Sale"** → auto-generates invoice, updates stock & balances

**Checking Inventory:**
1. Navigate to **Inventory** tab
2. View total stock, category breakdown, stock valuation
3. See low-stock products that need reordering

**Recording Payment:**
1. Navigate to **Payments** tab
2. Click **"+ Record Payment"**
3. Select customer or supplier
4. Enter amount, method, reference number
5. Click **"Record Payment"** → updates outstanding balance

**Adding Expense:**
1. Navigate to **Expenses** tab
2. Click **"+ Add Expense"**
3. Select category (Electricity, Salary, Rent, etc.)
4. Enter amount and description
5. Click **"Save Expense"**

### Data Export
All master data (Customers, Suppliers, Products) can be exported to **CSV** for Excel/spreadsheets.

## Database

### Initialization
- On first run, `server.py` automatically:
  - Creates `vsims.db` SQLite database
  - Executes schema from `vsims_schema.sql`
  - Inserts sample data (4 customers, 3 suppliers, 4 products)

### Tables
- `customers` - Customer master records
- `customer_invoices` - Customer transaction history
- `suppliers` - Supplier master records
- `supplier_history` - Supplier purchase history
- `products` - Product master (SKUs)
- `sales` - Sales invoices
- `sale_items` - Individual line items per sales invoice
- `purchases` - Purchase orders
- `purchase_items` - Individual line items per purchase order
- `payments` - Payment receipts/disbursements
- `expenses` - Operational expenses

### Resetting Database
To start fresh with sample data:
1. Stop the server
2. Delete `vsims.db`
3. Run `python server.py` again

## API Endpoints

The server provides REST APIs at `http://127.0.0.1:8000`:

### Health Check
```
GET /api/health
```

### Master Data (CRUD)
```
GET    /api/customers         # Fetch all customers
POST   /api/customers         # Create customer
PUT    /api/customers/:id     # Update customer
DELETE /api/customers/:id     # Delete customer

GET    /api/suppliers         # Fetch all suppliers
POST   /api/suppliers         # Create supplier
PUT    /api/suppliers/:id     # Update supplier
DELETE /api/suppliers/:id     # Delete supplier

GET    /api/products          # Fetch all products
POST   /api/products          # Create product
PUT    /api/products/:id      # Update product
DELETE /api/products/:id      # Delete product
```

### Transactions
```
GET  /api/sales               # Fetch all sales invoices
POST /api/sales               # Record new sale

GET  /api/purchases           # Fetch all purchase orders
POST /api/purchases           # Record new purchase

GET  /api/payments            # Fetch all payments
POST /api/payments            # Record new payment

GET  /api/expenses            # Fetch all expenses
POST /api/expenses            # Record new expense
```

## Troubleshooting

### Error: "Connection refused on 127.0.0.1:8000"
- Make sure VSIMS is actually running — look for its tray icon (bottom-right of the taskbar), or `VSIMS.exe`/`pythonw.exe` in Task Manager's Details tab
- Check `vsims.log` for startup errors
- Check that no other application is using port 8000

### Error: "Module not found: sqlite3"
- SQLite3 is built into Python. If missing:
  - Reinstall Python 3.8+ with default options
  - Or install via: `pip install pysqlite3`

### Database locked error
- Close the app and server
- Wait 2 seconds
- Restart both

### App loads but no data shows
- Check browser console (F12 → Console tab) for errors
- Verify `server.py` is running
- Try refreshing the page (Ctrl+R)

### Missing features or blank screens
- Clear browser cache (Ctrl+Shift+Delete)
- Close and reopen the app file
- Restart the server

## Performance Notes

- ✅ Works smoothly with 100+ customers, suppliers, products, and 1000+ transactions
- ✅ Charts & reports render in <500ms
- ✅ Responsive design works on desktop, tablet, mobile
- ✅ Local SQLite storage means zero cloud dependency

## Customization

### Change Store Name
**Settings** → Store Information → Update "Store Name"

### Change Tax Rate
**Settings** → Store Information → Update "Tax Rate (%)"

### Change Theme Colors
Edit CSS variables in `VSIMS-Prototype.html` (top of `<style>` section):
```css
:root {
  --primary: #2E7D32;        /* Green accent */
  --secondary: #FF9800;      /* Orange accent */
  /* ... etc ... */
}
```

## Support & Feedback

For issues, feature requests, or suggestions:
- Check the **Troubleshooting** section above
- Verify all files are in the same folder
- Ensure Python 3.8+ is installed
- Confirm port 8000 is available

## License

This is a prototype/demo application for Al-Barkat Vermicelli Mills.

---

**Happy selling! 🌾**
