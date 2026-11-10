import { requireUser } from "../../../../lib/auth.mjs";
import { query } from "../../../../lib/db.mjs";
import { json, fail } from "../../../../lib/http.mjs";
import { reports } from "../../../../lib/reports.mjs";
import { listPatterns, similarPatterns } from "../../../../lib/vector.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  try {
    const u = await requireUser();
    const { resource } = await params;
    const url = new URL(request.url);
    const role = u.role;
    if (resource === "meta") {
      const [products, warehouses, suppliers, categories] = await Promise.all(
        ["products", "warehouses", "suppliers", "categories"].map((t) =>
          query(role, "SELECT * FROM smartvault." + t + " ORDER BY 1"),
        ),
      );
      return json({
        products: products.rows,
        warehouses: warehouses.rows,
        suppliers: suppliers.rows,
        categories: categories.rows,
      });
    }
    if (resource === "overview") {
      const [counts, warehouses, categories, recent, alerts] =
        await Promise.all([
          query(
            role,
            "SELECT (SELECT COUNT(*) FROM smartvault.products)::int AS products,(SELECT COUNT(*) FROM smartvault.warehouses)::int AS warehouses,(SELECT COUNT(*) FROM smartvault.suppliers)::int AS suppliers,(SELECT COUNT(*) FROM smartvault.purchase_orders WHERE status='PLACED')::int AS open_orders,(SELECT COALESCE(SUM(quantity),0) FROM smartvault.inventory)::int AS units,(SELECT COALESCE(SUM(stock_value),0) FROM smartvault.v_inventory_report) AS stock_value,(SELECT COUNT(*) FROM smartvault.low_stock_alerts WHERE status='OPEN')::int AS low_stock,(SELECT COUNT(*) FROM smartvault.anomaly_logs)::int AS anomalies",
          ),
          query(role, reports[0].sql),
          query(
            role,
            "SELECT category_name,SUM(stock_value) AS value FROM smartvault.v_inventory_report GROUP BY category_name ORDER BY value DESC",
          ),
          query(
            role,
            "SELECT m.movement_id,p.product_name,m.movement_type,m.quantity,m.occurred_at,u.full_name FROM smartvault.stock_movements m JOIN smartvault.products p USING(product_id) JOIN smartvault.app_users u ON u.user_id=m.performed_by ORDER BY m.movement_id DESC LIMIT 5",
          ),
          query(
            role,
            "SELECT * FROM smartvault.v_inventory_report WHERE quantity<reorder_level ORDER BY quantity LIMIT 5",
          ),
        ]);
      return json({
        counts: counts.rows[0],
        warehouses: warehouses.rows,
        categories: categories.rows,
        recent: recent.rows,
        alerts: alerts.rows,
      });
    }
    if (resource === "inventory") {
      const q = (url.searchParams.get("q") || "").slice(0, 100),
        warehouse = url.searchParams.get("warehouse"),
        status = url.searchParams.get("status");
      const sorting = {
        name: "product_name ASC,warehouse_name",
        quantity: "quantity ASC,product_name",
        value: "stock_value DESC,product_name",
      };
      const wh = warehouse ? Number(warehouse) : null;
      if (wh !== null && (!Number.isInteger(wh) || wh < 1))
        return json({ error: "Invalid warehouse." }, 400);
      const r = await query(
        role,
        "SELECT * FROM smartvault.v_inventory_report WHERE (product_name ILIKE $1 OR sku ILIKE $1 OR category_name ILIKE $1) AND ($2::integer IS NULL OR warehouse_id=$2) AND ($3::text IS NULL OR availability=$3) ORDER BY " +
          (sorting[url.searchParams.get("sort")] || sorting.name),
        ["%" + q + "%", wh, status || null],
      );
      return json({ rows: r.rows });
    }
    if (resource === "movements") {
      return json({
        rows: (
          await query(
            role,
            "SELECT m.*,p.product_name,u.full_name,sw.warehouse_name AS source,dw.warehouse_name AS destination FROM smartvault.stock_movements m JOIN smartvault.products p USING(product_id) JOIN smartvault.app_users u ON u.user_id=m.performed_by LEFT JOIN smartvault.warehouses sw ON sw.warehouse_id=m.source_warehouse_id LEFT JOIN smartvault.warehouses dw ON dw.warehouse_id=m.destination_warehouse_id ORDER BY m.movement_id DESC",
          )
        ).rows,
      });
    }
    if (resource === "orders") {
      const rows = (
        await query(
          role,
          "SELECT po.*,s.supplier_name,w.warehouse_name,u.full_name,COALESCE(jsonb_agg(jsonb_build_object('product_id',i.product_id,'product_name',p.product_name,'quantity',i.quantity,'unit_cost',i.unit_cost)) FILTER (WHERE i.product_id IS NOT NULL),'[]') AS items,COALESCE(SUM(i.quantity*i.unit_cost),0) AS total FROM smartvault.purchase_orders po JOIN smartvault.suppliers s USING(supplier_id) JOIN smartvault.warehouses w USING(warehouse_id) JOIN smartvault.app_users u ON u.user_id=po.created_by LEFT JOIN smartvault.purchase_order_items i USING(order_id) LEFT JOIN smartvault.products p ON p.product_id=i.product_id GROUP BY po.order_id,s.supplier_name,w.warehouse_name,u.full_name ORDER BY po.order_id DESC",
        )
      ).rows;
      return json({ rows });
    }
    if (resource === "anomalies") {
      const [a, l] = await Promise.all([
        query(
          role,
          "SELECT a.*,m.quantity,m.occurred_at,p.product_name,w.warehouse_name FROM smartvault.anomaly_logs a JOIN smartvault.stock_movements m USING(movement_id) JOIN smartvault.products p USING(product_id) LEFT JOIN smartvault.warehouses w ON w.warehouse_id=m.source_warehouse_id ORDER BY a.anomaly_id DESC",
        ),
        query(
          role,
          "SELECT a.*,p.product_name,w.warehouse_name FROM smartvault.low_stock_alerts a JOIN smartvault.products p USING(product_id) JOIN smartvault.warehouses w USING(warehouse_id) WHERE a.status='OPEN' ORDER BY a.observed_quantity",
        ),
      ]);
      return json({ anomalies: a.rows, alerts: l.rows });
    }
    if (resource === "patterns") return json({ rows: await listPatterns() });
    if (resource === "similar")
      return json(await similarPatterns(url.searchParams.get("id") || ""));
    if (resource === "reports") {
      const id = url.searchParams.get("id");
      if (!id) return json({ reports });
      const selected = reports.find((r) => r.id === id);
      if (!selected) return json({ error: "Report not found." }, 404);
      const result = await query(role, selected.sql);
      return json({
        ...selected,
        rows: result.rows,
        columns: result.fields.map((f) => f.name),
      });
    }
    if (resource === "users") {
      await requireUser(true);
      return json({
        rows: (
          await query(
            role,
            "SELECT user_id,full_name,email,role FROM smartvault.app_users ORDER BY user_id",
          )
        ).rows,
      });
    }
    return json({ error: "Resource not found." }, 404);
  } catch (e) {
    return fail(e);
  }
}
