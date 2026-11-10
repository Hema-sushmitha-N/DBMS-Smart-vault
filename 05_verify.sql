-- SMARTVAULT | 05_verify.sql
-- Run after 01 and 02, before committing any additional sample changes.
-- A failure raises an exception. Successful execution reports passed checks.
BEGIN;
SET search_path TO smartvault, public;
DO $$
DECLARE rejected boolean := false; movement_count integer;
BEGIN
 IF (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='smartvault' AND table_type='BASE TABLE') <> 11
 THEN RAISE EXCEPTION 'Expected 11 base tables'; END IF;
 IF (SELECT COUNT(*) FROM inventory) <> 18
 THEN RAISE EXCEPTION 'Expected 18 inventory rows'; END IF;
 IF (SELECT SUM(quantity) FROM inventory) <> 343
 THEN RAISE EXCEPTION 'Expected 343 units'; END IF;
 IF (SELECT SUM(stock_value) FROM v_inventory_report) <> 144210
 THEN RAISE EXCEPTION 'Expected stock value 144210'; END IF;
 IF (SELECT COUNT(*) FROM low_stock_alerts WHERE status='OPEN') <> 6
 THEN RAISE EXCEPTION 'Expected 6 open alerts'; END IF;
 IF (SELECT COUNT(*) FROM anomaly_logs) <> 1
 THEN RAISE EXCEPTION 'Expected 1 anomaly'; END IF;
 IF (SELECT COUNT(*) FROM stock_movements) <> 19
 THEN RAISE EXCEPTION 'Expected 19 stock movements'; END IF;

 SELECT COUNT(*) INTO movement_count FROM stock_movements;
 BEGIN
  PERFORM transfer_stock(1,1,2,99999,2);
 EXCEPTION WHEN raise_exception THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Insufficient stock was accepted'; END IF;
 IF (SELECT quantity FROM inventory WHERE product_id=1 AND warehouse_id=1) <> 25
 OR (SELECT COUNT(*) FROM stock_movements) <> movement_count
 THEN RAISE EXCEPTION 'Failed transfer changed data'; END IF;

 rejected := false;
 BEGIN
  UPDATE inventory SET quantity=-1 WHERE product_id=1 AND warehouse_id=1;
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Negative quantity was accepted'; END IF;

 rejected := false;
 BEGIN
  INSERT INTO products(sku,product_name,category_id,preferred_supplier_id,unit_price)
  VALUES ('BAD-001','Invalid category test',99999,1,1);
 EXCEPTION WHEN foreign_key_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Orphan category was accepted'; END IF;

 PERFORM transfer_stock(1,1,2,3,2);
 IF (SELECT quantity FROM inventory WHERE product_id=1 AND warehouse_id=1) <> 22
 OR (SELECT quantity FROM inventory WHERE product_id=1 AND warehouse_id=2) <> 20
 THEN RAISE EXCEPTION 'Transfer balances incorrect'; END IF;

 INSERT INTO stock_movements(product_id,destination_warehouse_id,movement_type,quantity,performed_by)
 VALUES(2,1,'RECEIPT',10,1);
 IF (SELECT status FROM low_stock_alerts WHERE product_id=2 AND warehouse_id=1) <> 'RESOLVED'
 THEN RAISE EXCEPTION 'Replenishment did not resolve alert'; END IF;
 RAISE NOTICE 'PASS: sample totals, constraints, atomic failed transfer, successful transfer, alert resolution';
END;
$$;
ROLLBACK;
SELECT 'Checks completed; sample changes rolled back' AS verification;
