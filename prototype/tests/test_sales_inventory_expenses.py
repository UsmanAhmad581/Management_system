import tempfile
import unittest
from pathlib import Path

import server


class SalesInventoryExpensesTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "vsims.db"
        server.DB_PATH = self.db_path
        server.init_db()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_sale_stock_reduces_by_product_id(self):
        conn = server.connect_db()
        try:
            conn.execute(
                """
                INSERT INTO products (id, barcode, name, category, buy_price, sell_price, stock, min_stock)
                VALUES ('PR-1', '123456', 'Test Vermicelli', 'Finished Good', 100, 150, 10, 2)
                """
            )
            conn.commit()

            server._apply_stock_delta(conn, {"productId": "PR-1", "qty": 3}, -1)

            row = conn.execute("SELECT stock FROM products WHERE id = 'PR-1'").fetchone()
            self.assertEqual(row["stock"], 7)
        finally:
            conn.close()

    def test_expense_payload_is_normalized(self):
        payload = {"date": "25 Jul 2026", "category": "Salary", "desc": "Payroll", "amount": 2500}
        normalized = server._normalize_expense_row(payload)

        self.assertEqual(normalized["expense_date"], "25 Jul 2026")
        self.assertEqual(normalized["category"], "Salary")
        self.assertEqual(normalized["description"], "Payroll")
        self.assertEqual(normalized["amount"], 2500.0)


if __name__ == "__main__":
    unittest.main()
