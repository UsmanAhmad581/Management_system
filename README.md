# 🌾 VSIMS: Vermicelli Sales & Inventory Management System

A desktop-style sales and inventory management system built for a vermicelli mill. It manages customers, suppliers, products, stock, sales (POS), purchases, payments, expenses and reports. Everything is stored locally in a SQLite database, so no internet or cloud service is needed.

The app is a single-page web interface served by a lightweight Python REST API (standard library only). It can be packaged into a single Windows `.exe` that runs in the background with a system-tray icon and opens in your browser.

---

### Login
Sign-in screen with a dark mode toggle.

<img width="1907" height="862" alt="Screenshot 2026-09-28 072651" src="https://github.com/user-attachments/assets/e679890b-dbf7-4fc5-9bb2-053ee8e73ce0" />


### Dashboard
KPIs for today's sales, today's purchases, profit, current inventory, pending payments and supplier dues.
<img width="1899" height="863" alt="Screenshot 2026-09-28 072700" src="https://github.com/user-attachments/assets/273e18a4-d129-4fc9-8a04-6074514a00a1" />



### Customers
Retail and wholesale customers with balances, invoice history and year-to-date purchases.

<img width="1913" height="867" alt="Screenshot 2026-09-28 072712" src="https://github.com/user-attachments/assets/d5609855-9933-436e-a085-e8062e0087d9" />


### Suppliers
Raw-material and packaging suppliers with outstanding balances and purchase history.
<img width="1896" height="868" alt="Screenshot 2026-09-28 072735" src="https://github.com/user-attachments/assets/87f079e6-2df1-4868-aa05-4fb6b789bd84" />




### Products
Product list with barcode, category, buy/sell price, stock and minimum stock level.

<img width="1900" height="867" alt="Screenshot 2026-09-28 072751" src="https://github.com/user-attachments/assets/a1b08caa-3296-4dca-a690-fefd1cd9a03e" />


### Inventory
Stock levels, category breakdown, stock valuation and low-stock alerts.

<img width="1898" height="875" alt="Screenshot 2026-09-28 072759" src="https://github.com/user-attachments/assets/15c3b611-f96e-475f-836a-48c019b25c2f" />


### Sales / POS
Point of sale with customer selection, barcode/name search, discounts, tax and payment method.

<img width="1898" height="868" alt="Screenshot 2026-09-28 072823" src="https://github.com/user-attachments/assets/736288e8-badc-4b8b-9b30-a2bdeec011cc" />


### Purchases
Purchase entry with line items, tax, discount and supplier balance updates.

<img width="1905" height="835" alt="Screenshot 2026-09-28 072834" src="https://github.com/user-attachments/assets/6ac02d3c-cfde-4a37-84e1-410e05609b8a" />


### Payments
Customer receipts and supplier payments.

<img width="1899" height="873" alt="Screenshot 2026-09-28 072841" src="https://github.com/user-attachments/assets/b36e0558-3fcd-43d3-b2ff-f817cf9fc295" />


### Expenses
Operational costs by category (salary, electricity, rent, etc.).

<img width="1909" height="872" alt="Screenshot 2026-09-28 072848" src="https://github.com/user-attachments/assets/98a81a3e-5bad-425b-b13f-757cd79606a8" />


### Reports
Sales, purchases, inventory, profit & loss, customer and supplier reports.

<img width="1905" height="851" alt="Screenshot 2026-09-28 072856" src="https://github.com/user-attachments/assets/2140bf80-1fe5-4e18-81fe-95e0515457ec" />


### Receipt Center
Invoice history with a thermal-receipt style preview and print option.

<img width="1913" height="861" alt="Screenshot 2026-09-28 073542" src="https://github.com/user-attachments/assets/359f50a3-0608-4c09-80cb-26aa31a3b873" />

### Settings
Store information, tax rate, users, theme, and database backup/restore.

<img width="1892" height="866" alt="Screenshot 2026-09-28 073534" src="https://github.com/user-attachments/assets/e56dc95f-6103-41ef-a68e-d877a68aba4f" />


### Dark Mode
Any screen in dark theme.

<img width="1905" height="845" alt="Screenshot 2026-09-28 073723" src="https://github.com/user-attachments/assets/961e6817-cdd1-462a-9c62-3f14f901c083" />


---

## ✨ Features

- **Customers**: retail and wholesale, balances, invoices, year-to-date purchases
- **Suppliers**: raw-material and packaging suppliers with payment tracking
- **Products**: barcode, categories, buy/sell prices, minimum-stock alerts
- **Inventory**: live stock, category split and valuation
- **Sales / POS**: invoice generation, per-item discount, tax, cash/bank/mobile payment, automatic stock and balance updates
- **Purchases**: purchase entries with line items that update stock and supplier dues
- **Payments**: record customer receipts and supplier payments
- **Expenses**: track operating costs by category
- **Receipt Center**: invoice history with printable receipts
- **Reports**: sales, purchases, inventory, P&L, customers, suppliers
- **Settings**: store details, users, theme, backup and restore
- **Dark / light theme**
- **CSV export** for customers, suppliers and products
- **Automatic database backups** (keeps the latest 5 by default)
- **Rotating log file** (`vsims.log`) instead of a console window
- **Input validation and sanitization**, configurable in `config.ini`

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (modular files in `js/`) |
| Backend | Python 3 (`http.server`, REST API) |
| Database | SQLite (WAL mode) |
| Packaging | PyInstaller (Windows `.exe`) |
| Tray icon | `pystray` + `Pillow` (optional) |

## 📁 Project Structure

```
prototype/
├── VSIMS-Prototype.html        # Main single-page application
├── index.html                  # "Start here" API status page
├── styles.css                  # Styles
├── app.js                      # Core application logic
├── js/                         # Feature modules (pos, products, customers, ...)
├── server.py                   # Python REST API + static file server
├── vsims_utils.py              # Validation and backup helpers
├── config_loader.py            # Reads config.ini
├── config.ini                  # Server, database, backup, logging settings
├── vsims_schema.sql            # SQLite database schema
├── tests/                      # Unit tests
├── requirements.txt            # Optional tray-icon dependencies
├── build_windows_exe.bat       # Builds dist\VSIMS.exe
├── start-vsims.vbs             # No-console developer launcher
└── images/                     # README screenshots
```

## 🚀 Getting Started

**Requirements:** Python 3.8+ and any modern browser.

### Option A: Run from source
```bash
git clone <your-repo-url>
cd <repo-folder>/prototype
pip install -r requirements.txt   # optional, only for the tray icon
python server.py
```
Then open **http://127.0.0.1:8000/** in your browser.

> Open the app through this `http://` address, not by double-clicking the HTML file. Opening it as `file://` stops it from reaching the API.

### Option B: Windows launcher (no console)
Double-click `start-vsims.vbs`.

### Option C: Build a standalone `.exe`
```bash
build_windows_exe.bat
```
This creates `dist\VSIMS.exe`. Double-click it to start the server, open the browser and show a tray icon with **Open VSIMS** and **Quit**. The database (`vsims.db`) and log (`vsims.log`) are created next to the `.exe`.

### Demo login
The login is a demo screen: use the pre-filled username and any password.

## ⚙️ Configuration

Edit `config.ini` to change the port, database name, backup count, log level and validation limits.

## 🗄️ Database

Tables: `customers`, `customer_invoices`, `suppliers`, `supplier_history`, `products`, `sales`, `sale_items`, `purchases`, `purchase_items`, `payments`, `expenses`.

To reset to sample data, stop the app, delete `vsims.db` and start it again.

## 🔌 API Overview

| Resource | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Customers, Suppliers, Products | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| Sales, Purchases, Payments, Expenses | `GET`, `POST` |

## 🧪 Tests

```bash
python -m unittest discover tests
```

## 🔮 Future Improvements

- Real user authentication and roles
- Cloud or multi-device sync
- More report exports (PDF / Excel)

## 👤 Author

**Usman Ahmad**
GitHub: [@UsmanAhmad581](https://github.com/UsmanAhmad581)
