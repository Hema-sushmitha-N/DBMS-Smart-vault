-- SMARTVAULT | 02_sample_data.sql
-- Run once after 01_schema.sql. IDs are generated in insertion order.
BEGIN;
SET search_path TO smartvault, public;

INSERT INTO app_users (full_name, email, role) VALUES
 ('Asha Rao', 'asha@smartvault.example', 'ADMIN'),
 ('Ravi Kumar', 'ravi@smartvault.example', 'STAFF'),
 ('Neha Shah', 'neha@smartvault.example', 'STAFF');

INSERT INTO categories (category_name) VALUES
 ('Electronics'),
 ('Stationery'),
 ('Safety');

INSERT INTO suppliers (supplier_name, email, phone) VALUES
 ('TechSource', 'sales@techsource.example', '9000000001'),
 ('PaperPlus', 'sales@paperplus.example', '9000000002'),
 ('SafeSupply', 'sales@safesupply.example', '9000000003');

INSERT INTO warehouses (warehouse_name, city) VALUES
 ('Central Warehouse', 'Bengaluru'),
 ('North Warehouse', 'Hyderabad'),
 ('West Warehouse', 'Pune');

INSERT INTO products (sku, product_name, category_id, preferred_supplier_id, unit_price) VALUES
 ('EL-001', 'Wireless Mouse', 1, 1, 600),
 ('EL-002', 'Keyboard', 1, 1, 900),
 ('ST-001', 'A4 Paper Ream', 2, 2, 250),
 ('ST-002', 'Notebook Pack', 2, 2, 150),
 ('SF-001', 'Safety Gloves', 3, 3, 120),
 ('SF-002', 'Safety Helmet', 3, 3, 450);

INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES
 (1, 1, 0, 10),
 (1, 2, 0, 10),
 (1, 3, 0, 10),
 (2, 1, 0, 10),
 (2, 2, 0, 10),
 (2, 3, 0, 10),
 (3, 1, 0, 20),
 (3, 2, 0, 20),
 (3, 3, 0, 20),
 (4, 1, 0, 10),
 (4, 2, 0, 10),
 (4, 3, 0, 10),
 (5, 1, 0, 10),
 (5, 2, 0, 10),
 (5, 3, 0, 10),
 (6, 1, 0, 10),
 (6, 2, 0, 10),
 (6, 3, 0, 10);

INSERT INTO purchase_orders (supplier_id, warehouse_id, created_by, order_date, status) VALUES
 (1, 1, 1, '2026-10-25', 'PLACED'),
 (2, 2, 2, '2026-10-26', 'DRAFT'),
 (3, 3, 1, '2026-10-27', 'PLACED'),
 (1, 2, 3, '2026-10-28', 'CANCELLED');

INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_cost) VALUES
 (1, 1, 20, 550),
 (1, 2, 10, 800),
 (2, 3, 50, 220),
 (2, 4, 30, 130),
 (3, 5, 40, 100),
 (3, 6, 20, 400),
 (4, 2, 5, 800);

INSERT INTO stock_movements (product_id, source_warehouse_id, destination_warehouse_id, movement_type, quantity, performed_by, occurred_at, note) VALUES
 (1, NULL, 1, 'RECEIPT', 30, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (1, NULL, 2, 'RECEIPT', 12, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (1, NULL, 3, 'RECEIPT', 5, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (2, NULL, 1, 'RECEIPT', 8, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (2, NULL, 2, 'RECEIPT', 40, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (2, NULL, 3, 'RECEIPT', 20, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (3, NULL, 1, 'RECEIPT', 100, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (3, NULL, 2, 'RECEIPT', 20, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (3, NULL, 3, 'RECEIPT', 15, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (4, NULL, 1, 'RECEIPT', 25, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (4, NULL, 2, 'RECEIPT', 5, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (4, NULL, 3, 'RECEIPT', 10, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (5, NULL, 1, 'RECEIPT', 40, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (5, NULL, 2, 'RECEIPT', 15, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (5, NULL, 3, 'RECEIPT', 8, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (6, NULL, 2, 'RECEIPT', 20, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (6, NULL, 3, 'RECEIPT', 30, 1, '2026-10-28 09:00:00+05:30', 'Opening stock receipt'),
 (3, 1, NULL, 'ISSUE', 60, 2, '2026-10-29 11:00:00+05:30', 'Large customer withdrawal - review'),
 (1, 1, 2, 'TRANSFER', 5, 3, '2026-10-30 10:00:00+05:30', 'Balance mouse stock between warehouses');

COMMIT;
-- Read current results after all movements have been posted.
SELECT * FROM v_inventory_report ORDER BY product_id,warehouse_id;
