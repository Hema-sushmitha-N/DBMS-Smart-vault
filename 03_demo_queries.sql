-- SMARTVAULT | 03_demo_queries.sql
-- Run SELECT statements individually in pgAdmin to see each result grid.
-- Expected results assume only scripts 01 and 02 have been committed.
SET search_path TO smartvault, public;

-- Q01 — Display all products (JOIN + ORDER BY)
-- Expected: 6 products.
SELECT p.product_id,p.sku,p.product_name,c.category_name,s.supplier_name,p.unit_price
FROM products p JOIN categories c USING(category_id)
JOIN suppliers s ON s.supplier_id=p.preferred_supplier_id
ORDER BY p.product_id;

-- Q02 — Inventory availability report (view)
-- Expected: 18 product/warehouse combinations.
SELECT * FROM v_inventory_report ORDER BY product_id,warehouse_id;

-- Q03 — Low stock (filter)
-- Expected: 6 rows: Mouse/Pune 5; Keyboard/Bengaluru 8; Paper/Pune 15; Notebook/Hyderabad 5; Gloves/Pune 8; Helmet/Bengaluru 0.
SELECT product_name,warehouse_name,quantity,reorder_level
FROM v_inventory_report WHERE quantity<reorder_level
ORDER BY product_id,warehouse_id;

-- Q04 — Search and sort
-- Expected: Wireless Mouse in Central Warehouse (25), North Warehouse (17), West Warehouse (5).
SELECT product_name,warehouse_name,quantity
FROM v_inventory_report WHERE product_name ILIKE '%mouse%'
ORDER BY quantity DESC;

-- Q05 — Warehouse analytics (GROUP BY + SUM)
-- Expected: Central: 138 units / 40750; North: 117 / 62750; West: 88 / 40710.
SELECT warehouse_name,SUM(quantity) AS total_units,SUM(stock_value) AS stock_value
FROM v_inventory_report GROUP BY warehouse_id,warehouse_name ORDER BY warehouse_id;

-- Q06 — High-volume products (HAVING)
-- Expected: A4 Paper Ream 75; Keyboard 68; Safety Gloves 63.
SELECT p.product_name,SUM(i.quantity) AS total_stock
FROM products p JOIN inventory i USING(product_id)
GROUP BY p.product_id,p.product_name HAVING SUM(i.quantity)>50
ORDER BY total_stock DESC;

-- Q07 — Purchase order totals (LEFT JOIN view)
-- Expected: Order totals: 1=19000, 2=14900, 3=12000, 4=4000.
SELECT * FROM v_purchase_order_totals ORDER BY order_id;

-- Q08 — Supplier analytics, excluding cancelled orders
-- Expected: TechSource: 1 order / 19000; PaperPlus: 1 / 14900; SafeSupply: 1 / 12000.
SELECT s.supplier_name,COUNT(DISTINCT po.order_id) AS active_orders,
 COALESCE(SUM(poi.quantity*poi.unit_cost),0) AS order_value
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id=s.supplier_id AND po.status<>'CANCELLED'
LEFT JOIN purchase_order_items poi ON poi.order_id=po.order_id
GROUP BY s.supplier_id,s.supplier_name ORDER BY s.supplier_id;

-- Q09 — Products above average price (subquery)
-- Expected: Wireless Mouse 600; Keyboard 900; Safety Helmet 450. Mean is 411.6667.
SELECT product_name,unit_price FROM products
WHERE unit_price>(SELECT AVG(unit_price) FROM products) ORDER BY product_id;

-- Q10 — Products without active orders (NOT EXISTS)
-- Expected: 0 rows: every product has a non-cancelled order.
SELECT p.product_id,p.product_name FROM products p
WHERE NOT EXISTS (
 SELECT 1 FROM purchase_order_items poi JOIN purchase_orders po USING(order_id)
 WHERE poi.product_id=p.product_id AND po.status<>'CANCELLED'
) ORDER BY p.product_id;

-- Q11 — Movement history with warehouse role aliases
-- Expected: 19 movements; null source for receipts and null destination for issues.
SELECT m.movement_id,p.product_name,m.movement_type,
 sw.warehouse_name AS source,dw.warehouse_name AS destination,
 m.quantity,u.full_name,m.occurred_at
FROM stock_movements m JOIN products p USING(product_id)
JOIN app_users u ON u.user_id=m.performed_by
LEFT JOIN warehouses sw ON sw.warehouse_id=m.source_warehouse_id
LEFT JOIN warehouses dw ON dw.warehouse_id=m.destination_warehouse_id
ORDER BY m.occurred_at,m.movement_id;

-- Q12 — Transfers only
-- Expected: Movement 19 transfers 5 mice from warehouse 1 to warehouse 2.
SELECT movement_id,product_id,source_warehouse_id,destination_warehouse_id,quantity
FROM stock_movements WHERE movement_type='TRANSFER' ORDER BY movement_id;

-- Q13 — Trigger-generated open alerts
-- Expected: 6 OPEN alerts, matching Q03.
SELECT p.product_name,w.warehouse_name,a.observed_quantity,a.threshold,a.status
FROM low_stock_alerts a JOIN products p USING(product_id)
JOIN warehouses w USING(warehouse_id)
WHERE a.status='OPEN' ORDER BY a.product_id,a.warehouse_id;

-- Q14 — Rule-based anomaly report
-- Expected: 1 anomaly: movement 18, A4 Paper Ream, issue of 60.
SELECT a.anomaly_id,m.movement_id,p.product_name,m.quantity,a.rule_name,a.reason
FROM anomaly_logs a JOIN stock_movements m USING(movement_id)
JOIN products p USING(product_id) ORDER BY a.anomaly_id;

-- Q15 — Dashboard aggregates
-- Expected: 6 products, 3 warehouses, 3 suppliers, 4 orders, 343 units, value 144210, 6 open alerts, 1 anomaly.
SELECT (SELECT COUNT(*) FROM products) AS products,
 (SELECT COUNT(*) FROM warehouses) AS warehouses,
 (SELECT COUNT(*) FROM suppliers) AS suppliers,
 (SELECT COUNT(*) FROM purchase_orders) AS orders,
 (SELECT SUM(quantity) FROM inventory) AS units,
 (SELECT SUM(stock_value) FROM v_inventory_report) AS stock_value,
 (SELECT COUNT(*) FROM low_stock_alerts WHERE status='OPEN') AS open_alerts,
 (SELECT COUNT(*) FROM anomaly_logs) AS anomalies;

-- Q16 — Stock reconciliation against movement ledger
-- Expected: 0 rows means all stored quantities match their movement totals.
WITH ledger AS (
 SELECT product_id,destination_warehouse_id AS warehouse_id,quantity AS delta
 FROM stock_movements WHERE destination_warehouse_id IS NOT NULL
 UNION ALL
 SELECT product_id,source_warehouse_id,-quantity
 FROM stock_movements WHERE source_warehouse_id IS NOT NULL
)
SELECT i.product_id,i.warehouse_id,i.quantity,COALESCE(SUM(l.delta),0) AS ledger_quantity
FROM inventory i LEFT JOIN ledger l USING(product_id,warehouse_id)
GROUP BY i.product_id,i.warehouse_id,i.quantity
HAVING i.quantity<>COALESCE(SUM(l.delta),0)
ORDER BY i.product_id,i.warehouse_id;

-- Q17 — Category inventory value
-- Expected: Electronics 89400; Stationery 24750; Safety 30060.
SELECT category_name,SUM(quantity) AS units,SUM(stock_value) AS stock_value
FROM v_inventory_report GROUP BY category_name ORDER BY stock_value DESC;

-- Q18 — Out-of-stock availability
-- Expected: Safety Helmet in Central Warehouse.
SELECT product_name,warehouse_name FROM v_inventory_report
WHERE availability='OUT OF STOCK' ORDER BY product_id,warehouse_id;

-- Q19 — Show every base table
-- Expected: 11 tables. Run each statement individually to show its result grid.
SELECT * FROM app_users ORDER BY user_id;
SELECT * FROM categories ORDER BY category_id;
SELECT * FROM suppliers ORDER BY supplier_id;
SELECT * FROM warehouses ORDER BY warehouse_id;
SELECT * FROM products ORDER BY product_id;
SELECT * FROM inventory ORDER BY product_id;
SELECT * FROM purchase_orders ORDER BY order_id;
SELECT * FROM purchase_order_items ORDER BY order_id;
SELECT * FROM stock_movements ORDER BY movement_id;
SELECT * FROM low_stock_alerts ORDER BY alert_id;
SELECT * FROM anomaly_logs ORDER BY anomaly_id;
