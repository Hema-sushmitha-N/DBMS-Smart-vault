export const reports = [
  {
    id: "warehouse",
    title: "Warehouse stock value",
    concept: "JOIN · GROUP BY · SUM · ORDER BY",
    sql: "SELECT w.warehouse_name,SUM(i.quantity)::int AS units,SUM(i.quantity*p.unit_price) AS stock_value FROM smartvault.inventory i JOIN smartvault.warehouses w USING(warehouse_id) JOIN smartvault.products p USING(product_id) GROUP BY w.warehouse_id,w.warehouse_name ORDER BY stock_value DESC",
  },
  {
    id: "having",
    title: "Products with more than 50 units",
    concept: "GROUP BY · HAVING",
    sql: "SELECT p.product_name,SUM(i.quantity)::int AS total_stock FROM smartvault.products p JOIN smartvault.inventory i USING(product_id) GROUP BY p.product_id,p.product_name HAVING SUM(i.quantity)>50 ORDER BY total_stock DESC",
  },
  {
    id: "nested",
    title: "Products above average price",
    concept: "Nested subquery",
    sql: "SELECT product_name,unit_price FROM smartvault.products WHERE unit_price>(SELECT AVG(unit_price) FROM smartvault.products) ORDER BY unit_price DESC",
  },
  {
    id: "correlated",
    title: "Stock below its warehouse average",
    concept: "Correlated subquery",
    sql: "SELECT p.product_name,w.warehouse_name,i.quantity FROM smartvault.inventory i JOIN smartvault.products p USING(product_id) JOIN smartvault.warehouses w USING(warehouse_id) WHERE i.quantity<(SELECT AVG(j.quantity) FROM smartvault.inventory j WHERE j.warehouse_id=i.warehouse_id) ORDER BY w.warehouse_name,i.quantity",
  },
  {
    id: "recursive",
    title: "Category hierarchy",
    concept: "Recursive CTE · Self relationship",
    sql: "WITH RECURSIVE tree AS (SELECT category_id,category_name,parent_category_id,0 AS depth,category_name::text AS path FROM smartvault.categories WHERE parent_category_id IS NULL UNION ALL SELECT c.category_id,c.category_name,c.parent_category_id,t.depth+1,t.path||' / '||c.category_name FROM smartvault.categories c JOIN tree t ON c.parent_category_id=t.category_id) SELECT category_id,category_name,depth,path FROM tree ORDER BY path",
  },
  {
    id: "cte",
    title: "Warehouse share of all inventory",
    concept: "CTE · Window aggregate",
    sql: "WITH totals AS (SELECT warehouse_id,SUM(quantity) AS units FROM smartvault.inventory GROUP BY warehouse_id) SELECT w.warehouse_name,t.units,ROUND(100.0*t.units/NULLIF(SUM(t.units) OVER(),0),2) AS percent_of_all_stock FROM totals t JOIN smartvault.warehouses w USING(warehouse_id) ORDER BY t.units DESC",
  },
  {
    id: "ledger",
    title: "Reconcile balances with the movement ledger",
    concept: "UNION ALL · CTE · HAVING",
    sql: "WITH ledger AS (SELECT product_id,destination_warehouse_id AS warehouse_id,quantity AS delta FROM smartvault.stock_movements WHERE destination_warehouse_id IS NOT NULL UNION ALL SELECT product_id,source_warehouse_id,-quantity FROM smartvault.stock_movements WHERE source_warehouse_id IS NOT NULL) SELECT i.product_id,i.warehouse_id,i.quantity,COALESCE(SUM(l.delta),0) AS ledger_quantity FROM smartvault.inventory i LEFT JOIN ledger l USING(product_id,warehouse_id) GROUP BY i.product_id,i.warehouse_id,i.quantity HAVING i.quantity<>COALESCE(SUM(l.delta),0) ORDER BY i.product_id,i.warehouse_id",
  },
];
