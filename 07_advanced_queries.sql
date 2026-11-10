-- SmartVault: extended SQL evaluation examples.
SET search_path TO smartvault, public;
-- DML create/read/update/delete. This demonstration leaves no sample changes.
BEGIN;
INSERT INTO categories(category_name) VALUES('DML demonstration') RETURNING category_id,category_name;
SELECT category_id,category_name FROM categories WHERE category_name='DML demonstration';
UPDATE categories SET category_name='DML updated' WHERE category_name='DML demonstration';
DELETE FROM categories WHERE category_name='DML updated';
ROLLBACK;

-- Nested subquery.
SELECT product_name,unit_price FROM products WHERE unit_price>(SELECT AVG(unit_price) FROM products);
-- Correlated subquery.
SELECT p.product_name,w.warehouse_name,i.quantity FROM inventory i
JOIN products p USING(product_id) JOIN warehouses w USING(warehouse_id)
WHERE i.quantity<(SELECT AVG(j.quantity) FROM inventory j WHERE j.warehouse_id=i.warehouse_id);
-- Recursive CTE: real category hierarchy.
WITH RECURSIVE tree AS (
 SELECT category_id,category_name,parent_category_id,0 AS depth,category_name::text AS path
 FROM categories WHERE parent_category_id IS NULL
 UNION ALL
 SELECT c.category_id,c.category_name,c.parent_category_id,t.depth+1,t.path||' / '||c.category_name
 FROM categories c JOIN tree t ON c.parent_category_id=t.category_id
) SELECT * FROM tree ORDER BY path;
-- JOIN, aggregation, HAVING, sorting.
SELECT w.warehouse_name,SUM(i.quantity) AS total_units
FROM inventory i JOIN warehouses w USING(warehouse_id)
GROUP BY w.warehouse_id,w.warehouse_name HAVING SUM(i.quantity)>100 ORDER BY total_units DESC;
-- CTE and window aggregation.
WITH totals AS (SELECT warehouse_id,SUM(quantity) AS units FROM inventory GROUP BY warehouse_id)
SELECT w.warehouse_name,t.units,ROUND(100.0*t.units/NULLIF(SUM(t.units) OVER(),0),2) AS stock_share_percent
FROM totals t JOIN warehouses w USING(warehouse_id) ORDER BY t.units DESC;
-- Database-enforced permission evidence, evaluated without exposing credentials.
SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='smartvault' AND grantee IN('smartvault_admin','smartvault_staff') ORDER BY grantee,table_name,privilege_type;
-- Function-trigger transaction path. Run as owner or a permitted application role.
-- BEGIN;
-- SELECT smartvault.record_movement(1,1,2,'TRANSFER',3,1,'Evaluation demo');
-- SELECT * FROM inventory WHERE product_id=1 AND warehouse_id IN(1,2);
-- ROLLBACK;
