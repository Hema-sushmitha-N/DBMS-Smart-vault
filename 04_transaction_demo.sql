-- SMARTVAULT | 04_transaction_demo.sql
-- Select and execute each entire BEGIN ... ROLLBACK block.
-- Both examples roll back, preserving the sample data.
SET search_path TO smartvault, public;

-- A: Transactional transfer; before (25,17), during (22,20), after (25,17).
BEGIN;
SELECT product_id,warehouse_id,quantity FROM inventory
WHERE product_id=1 AND warehouse_id IN (1,2) ORDER BY warehouse_id;
SELECT transfer_stock(1,1,2,3,2) AS new_movement_id;
SELECT product_id,warehouse_id,quantity FROM inventory
WHERE product_id=1 AND warehouse_id IN (1,2) ORDER BY warehouse_id;
ROLLBACK;
SELECT product_id,warehouse_id,quantity FROM inventory
WHERE product_id=1 AND warehouse_id IN (1,2) ORDER BY warehouse_id;

-- B: Replenish low stock; alert resolves, then rollback restores it.
BEGIN;
INSERT INTO stock_movements(product_id,destination_warehouse_id,movement_type,quantity,performed_by,note)
VALUES (2,1,'RECEIPT',10,1,'Demonstration replenishment');
SELECT quantity FROM inventory WHERE product_id=2 AND warehouse_id=1; -- 18
SELECT status FROM low_stock_alerts WHERE product_id=2 AND warehouse_id=1; -- RESOLVED
ROLLBACK;
SELECT quantity FROM inventory WHERE product_id=2 AND warehouse_id=1; -- 8
SELECT status FROM low_stock_alerts WHERE product_id=2 AND warehouse_id=1; -- OPEN

-- C: Data validation example. Select this block separately.
-- Expected ERROR: Source inventory missing or insufficient stock.
-- After the error, run ROLLBACK if pgAdmin leaves the transaction aborted.
-- BEGIN;
-- SELECT transfer_stock(1,1,2,99999,2);
-- ROLLBACK;
-- Identity sequences can have gaps after rollbacks; this is normal.
