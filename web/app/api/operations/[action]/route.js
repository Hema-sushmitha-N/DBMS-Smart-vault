import { z } from "zod";
import { requireUser } from "../../../../lib/auth.mjs";
import { query, poolFor } from "../../../../lib/db.mjs";
import { hashPassword } from "../../../../lib/passwords.mjs";
import { body, json, fail } from "../../../../lib/http.mjs";
import {
  syncPatterns,
  updatePattern,
  deletePattern,
  upsertPattern,
} from "../../../../lib/vector.mjs";
const id = z.coerce.number().int().positive();
const text = (n) => z.string().trim().min(1).max(n);
const amount = z.coerce.number().finite().nonnegative().max(999999999);
const masterDefs = {
  categories: {
    pk: "category_id",
    schema: z.object({
      category_name: text(80),
      parent_category_id: id.nullable().optional(),
    }),
  },
  warehouses: {
    pk: "warehouse_id",
    schema: z.object({ warehouse_name: text(100), city: text(80) }),
  },
  suppliers: {
    pk: "supplier_id",
    schema: z.object({
      supplier_name: text(100),
      email: z.email().max(160),
      phone: z
        .string()
        .regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number."),
    }),
  },
  products: {
    pk: "product_id",
    schema: z.object({
      sku: z
        .string()
        .regex(
          /^[a-zA-Z0-9_-]{2,30}$/,
          "SKU must contain 2–30 letters, numbers, dashes, or underscores.",
        ),
      product_name: text(100),
      category_id: id,
      preferred_supplier_id: id,
      unit_price: amount,
    }),
  },
};
async function synced(role) {
  try {
    return { ...(await syncPatterns(role)), synced: true };
  } catch (e) {
    console.error("Pattern sync", e.message);
    return {
      synced: false,
      warning:
        "Saved in PostgreSQL. Pattern refresh is pending; ask an Admin to refresh patterns.",
    };
  }
}
export async function POST(request, { params }) {
  try {
    const u = await requireUser();
    const { action } = await params;
    const b = await body(request);
    const role = u.role;
    let result;
    if (action === "movement") {
      const d = z
        .object({
          product_id: id,
          source_warehouse_id: id.nullable(),
          destination_warehouse_id: id.nullable(),
          movement_type: z.enum(["RECEIPT", "ISSUE", "TRANSFER"]),
          quantity: id.max(1000000),
          note: z.string().max(200).default(""),
        })
        .parse(b);
      if (
        (d.movement_type === "RECEIPT" &&
          (d.source_warehouse_id !== null ||
            d.destination_warehouse_id === null)) ||
        (d.movement_type === "ISSUE" &&
          (d.source_warehouse_id === null ||
            d.destination_warehouse_id !== null)) ||
        (d.movement_type === "TRANSFER" &&
          (d.source_warehouse_id === null ||
            d.destination_warehouse_id === null ||
            d.source_warehouse_id === d.destination_warehouse_id))
      )
        return json(
          {
            error:
              "Select the correct source and destination for this movement.",
          },
          400,
        );
      result = await query(
        role,
        "SELECT smartvault.record_movement($1,$2,$3,$4,$5,$6,$7) AS id",
        [
          d.product_id,
          d.source_warehouse_id,
          d.destination_warehouse_id,
          d.movement_type,
          d.quantity,
          u.user_id,
          d.note,
        ],
      );
      return json({ ok: true, id: result.rows[0].id, ...(await synced(role)) });
    }
    if (action === "order") {
      const d = z
        .object({
          supplier_id: id,
          warehouse_id: id,
          items: z
            .array(
              z.object({
                product_id: id,
                quantity: id.max(1000000),
                unit_cost: amount,
              }),
            )
            .min(1)
            .max(100),
        })
        .parse(b);
      if (new Set(d.items.map((x) => x.product_id)).size !== d.items.length)
        return json({ error: "Choose each product only once per order." }, 400);
      result = await query(
        role,
        "SELECT smartvault.create_purchase_order($1,$2,$3,$4::jsonb) AS id",
        [d.supplier_id, d.warehouse_id, u.user_id, JSON.stringify(d.items)],
      );
      return json({ ok: true, id: result.rows[0].id });
    }
    await requireUser(true);
    if (action === "receive_order") {
      const order = id.parse(b.order_id);
      result = await query(
        role,
        "SELECT smartvault.receive_purchase_order($1,$2) AS received",
        [order, u.user_id],
      );
      return json({
        ok: true,
        received: result.rows[0].received,
        ...(await synced(role)),
      });
    }
    if (action === "cancel_order") {
      await query(role, "SELECT smartvault.cancel_purchase_order($1)", [
        id.parse(b.order_id),
      ]);
      return json({ ok: true });
    }
    if (action === "user_create") {
      const d = z
        .object({
          full_name: text(100),
          email: z.email().max(160),
          role: z.enum(["ADMIN", "STAFF"]),
          password: z.string().min(10).max(128),
        })
        .parse(b);
      await query(role, "SELECT smartvault.create_app_user($1,$2,$3,$4)", [
        d.full_name,
        d.email.toLowerCase(),
        d.role,
        await hashPassword(d.password),
      ]);
      return json({ ok: true });
    }
    if (action === "vector_sync")
      return json({ ok: true, ...(await syncPatterns(role)) });
    if (action === "vector_update") {
      await updatePattern(
        z.string().parse(b.id),
        z.string().max(300).parse(b.note),
      );
      return json({ ok: true });
    }
    if (action === "vector_delete") {
      await deletePattern(z.string().parse(b.id));
      return json({ ok: true });
    }
    if (action === "vector_upsert") {
      await upsertPattern(z.string().parse(b.id));
      return json({ ok: true });
    }
    if (["master_create", "master_update", "master_delete"].includes(action)) {
      const definition = masterDefs[b.resource];
      if (!definition) return json({ error: "Unknown master table." }, 400);
      const client = await poolFor(role).connect();
      try {
        await client.query("BEGIN");
        if (action === "master_delete") {
          const key = id.parse(b.id);
          if (b.resource === "products")
            await client.query("SELECT smartvault.remove_product($1)", [key]);
          else if (b.resource === "warehouses")
            await client.query("SELECT smartvault.remove_warehouse($1)", [key]);
          else
            await client.query(
              "DELETE FROM smartvault." +
                b.resource +
                " WHERE " +
                definition.pk +
                "=$1",
              [key],
            );
        } else {
          const data = definition.schema.parse(b.data);
          const columns = Object.keys(data);
          const values = Object.values(data);
          if (action === "master_create")
            await client.query(
              "INSERT INTO smartvault." +
                b.resource +
                " (" +
                columns.join(",") +
                ") VALUES (" +
                columns.map((_, i) => "$" + (i + 1)).join(",") +
                ")",
              values,
            );
          else
            await client.query(
              "UPDATE smartvault." +
                b.resource +
                " SET " +
                columns.map((c, i) => c + "=$" + (i + 1)).join(",") +
                " WHERE " +
                definition.pk +
                "=$" +
                (values.length + 1),
              [...values, id.parse(b.id)],
            );
          if (["products", "warehouses"].includes(b.resource))
            await client.query("SELECT smartvault.initialize_inventory()");
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
      return json({ ok: true, ...(await synced(role)) });
    }
    return json({ error: "Action not found." }, 404);
  } catch (e) {
    return fail(e);
  }
}
