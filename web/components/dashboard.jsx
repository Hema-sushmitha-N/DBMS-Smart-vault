"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  Network,
  BarChart3,
  Layers,
  Users,
  LogOut,
  Plus,
  Search,
  ArrowUpRight,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Pencil,
  X,
  Boxes,
  Warehouse,
  Activity,
  Menu,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight as ArrowOut,
} from "lucide-react";
const money = (x) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(x || 0));
const number = (x) => new Intl.NumberFormat("en-IN").format(Number(x || 0));
const date = (x) =>
  new Date(x).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const navigation = [
  ["overview", "Overview", LayoutDashboard],
  ["inventory", "Inventory", Package],
  ["movements", "Stock movements", ArrowLeftRight],
  ["orders", "Purchase orders", ShoppingCart],
  ["alerts", "Alerts & anomalies", AlertTriangle],
  ["patterns", "Pattern intelligence", Network],
  ["reports", "SQL reports", BarChart3],
  ["catalog", "Master data", Layers],
  ["users", "Users & access", Users],
];
const pageCopy = {
  overview: [
    "Inventory, in focus.",
    "Your warehouses, stock, and next actions. All in one place.",
  ],
  inventory: [
    "Every product. Every warehouse.",
    "Search availability and keep your stock levels in view.",
  ],
  movements: [
    "Keep stock moving.",
    "A complete record of receipts, issues, and warehouse transfers.",
  ],
  orders: [
    "Procurement, connected.",
    "Plan supplier orders and receive stock with confidence.",
  ],
  alerts: [
    "Stay ahead of exceptions.",
    "Review low stock and unusual withdrawals in one place.",
  ],
  patterns: [
    "Find the familiar. Spot the unusual.",
    "Compare inventory behavior across products and warehouses.",
  ],
  reports: [
    "Your data, explained.",
    "Run SQL reports against the live PostgreSQL database.",
  ],
  catalog: [
    "A strong foundation.",
    "Manage the products, partners, and places behind your inventory.",
  ],
  users: [
    "The right access.",
    "Create accounts and assign Admin or Staff responsibilities.",
  ],
};
async function read(resource) {
  const r = await fetch("/api/data/" + resource, { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Unable to load data.");
  return d;
}
async function write(action, payload) {
  const r = await fetch("/api/operations/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Unable to save.");
  return d;
}
function Badge({ children, tone }) {
  const text = String(children || "");
  tone =
    tone ||
    {
      AVAILABLE: "green",
      "LOW STOCK": "amber",
      "OUT OF STOCK": "red",
      RECEIPT: "green",
      ISSUE: "amber",
      TRANSFER: "blue",
      PLACED: "blue",
      DRAFT: "gray",
      RECEIVED: "green",
      CANCELLED: "gray",
      ADMIN: "green",
      STAFF: "blue",
      OPEN: "amber",
    }[text] ||
    "gray";
  return (
    <span className={"badge " + tone}>
      <i />
      {text.replaceAll("_", " ")}
    </span>
  );
}
function Empty({
  title = "Nothing here yet",
  text = "New records will appear here as you work.",
}) {
  return (
    <div className="empty">
      <Boxes size={31} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
function Modal({ title, subtitle, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} className="modal">
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      {label}
      {children}
    </label>
  );
}
function Table({ columns, rows, empty }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || r.movement_id || i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty
          title={empty || "No matching records"}
          text="Try another filter or add a new record."
        />
      )}
    </div>
  );
}
export default function Dashboard({ user, section }) {
  if (!pageCopy[section] || (section === "users" && user.role !== "ADMIN"))
    section = "overview";
  const [data, setData] = useState(null),
    [meta, setMeta] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [mobile, setMobile] = useState(false),
    [q, setQ] = useState(""),
    [warehouse, setWarehouse] = useState(""),
    [availability, setAvailability] = useState(""),
    [sort, setSort] = useState("name"),
    [catalog, setCatalog] = useState("products"),
    [status, setStatus] = useState("");
  const notify = (message, bad = false) => {
    setToast({ message, bad });
  };
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    read("meta")
      .then(setMeta)
      .catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    const resource =
      section === "alerts"
        ? "anomalies"
        : section === "catalog"
          ? "meta"
          : section === "patterns"
            ? "patterns"
            : section === "reports"
              ? "reports"
              : section;
    const params =
      section === "inventory"
        ? "?" +
          new URLSearchParams({ q, warehouse, status: availability, sort })
        : "";
    const timer = setTimeout(
      () =>
        read(resource + params)
          .then((d) => {
            if (active) setData(d);
          })
          .catch((e) => {
            if (active) setError(e.message);
          })
          .finally(() => {
            if (active) setBusy(false);
          }),
      q ? 220 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [section, refresh, q, warehouse, availability, sort]);
  useEffect(() => {
    const id = setInterval(() => setRefresh((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);
  async function mutate(action, payload, message) {
    const d = await write(action, payload);
    notify(d.warning || message, !!d.warning);
    setRefresh((x) => x + 1);
    return d;
  }
  const admin = user.role === "ADMIN",
    copy = pageCopy[section];
  const openMovement = () => setModal({ type: "movement" });
  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    window.location.assign("/login");
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "show" : "")}>
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <Boxes size={24} />
          </span>
          SmartVault<span className="brand-dot">.</span>
        </Link>
        <span className="nav-caption">YOUR WORKSPACE</span>
        <nav>
          {navigation
            .filter((n) => n[0] !== "users" || admin)
            .map(([id, label, Icon]) => (
              <Link
                key={id}
                href={"/dashboard" + (id === "overview" ? "" : "/" + id)}
                className={"nav-item " + (section === id ? "active" : "")}
                onClick={() => setMobile(false)}
              >
                <Icon size={19} />
                {label}
                {section === id && <span className="nav-indicator" />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection">
            <i />
            <span>
              Local workspace<strong>PostgreSQL + LanceDB</strong>
            </span>
          </div>
          <div className="user-block">
            <span className="avatar">
              {user.full_name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </span>
            <div>
              <strong>{user.full_name}</strong>
              <span>{admin ? "Administrator" : "Staff member"}</span>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumbs">
            Workspace
            <ChevronRight size={13} />
            <strong>{navigation.find((n) => n[0] === section)?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <i />
              Live inventory
            </span>
            <span className="top-date">
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className={"icon-button " + (busy ? "spinning" : "")}
              title="Refresh data"
              aria-label="Refresh data"
              onClick={() => setRefresh((x) => x + 1)}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {section === "overview"
                  ? "THE BIG PICTURE"
                  : navigation.find((n) => n[0] === section)?.[1].toUpperCase()}
              </span>
              <h1>{copy[0]}</h1>
              <p>{copy[1]}</p>
            </div>
            {!["reports", "patterns", "users", "catalog", "orders"].includes(
              section,
            ) && (
              <button className="button primary" onClick={openMovement}>
                <Plus size={17} />
                Record movement
              </button>
            )}
            {section === "orders" && (
              <button
                className="button primary"
                onClick={() => setModal({ type: "order" })}
              >
                <Plus size={17} />
                New purchase order
              </button>
            )}
            {section === "catalog" && admin && (
              <button
                className="button primary"
                onClick={() => setModal({ type: "master", resource: catalog })}
              >
                <Plus size={17} />
                Add{" "}
                {catalog === "categories" ? "category" : catalog.slice(0, -1)}
              </button>
            )}
            {section === "users" && admin && (
              <button
                className="button primary"
                onClick={() => setModal({ type: "user" })}
              >
                <Plus size={17} />
                Create account
              </button>
            )}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              {error}
              <button onClick={() => setRefresh((x) => x + 1)}>
                Try again
              </button>
            </div>
          )}
          {!data && !error ? (
            <div className="loading">
              <RefreshCw size={22} />
              Loading your workspace…
            </div>
          ) : (
            data && (
              <>
                {section === "overview" && (
                  <Overview data={data} openMovement={openMovement} />
                )}
                {section === "inventory" && (
                  <div className="panel">
                    <div className="filters">
                      <div className="search-input">
                        <Search size={17} />
                        <input
                          aria-label="Search inventory"
                          placeholder="Search products, SKU, category…"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="Filter warehouse"
                        value={warehouse}
                        onChange={(e) => setWarehouse(e.target.value)}
                      >
                        <option value="">All warehouses</option>
                        {meta?.warehouses.map((w) => (
                          <option value={w.warehouse_id} key={w.warehouse_id}>
                            {w.warehouse_name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter availability"
                        value={availability}
                        onChange={(e) => setAvailability(e.target.value)}
                      >
                        <option value="">All availability</option>
                        {["AVAILABLE", "LOW STOCK", "OUT OF STOCK"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Sort inventory"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="name">Product A–Z</option>
                        <option value="quantity">Lowest stock first</option>
                        <option value="value">Highest value first</option>
                      </select>
                    </div>
                    <div className="table-label">
                      <strong>{data.rows?.length || 0} stock positions</strong>
                      <span>One balance per product and warehouse</span>
                    </div>
                    <Table
                      rows={data.rows || []}
                      columns={[
                        {
                          key: "product_name",
                          label: "Product",
                          render: (r) => (
                            <div className="product-cell">
                              <span className="product-icon">
                                <Package size={17} />
                              </span>
                              <div>
                                <strong>{r.product_name}</strong>
                                <small>
                                  {r.sku} · {r.category_name}
                                </small>
                              </div>
                            </div>
                          ),
                        },
                        { key: "warehouse_name", label: "Warehouse" },
                        {
                          key: "quantity",
                          label: "On hand",
                          render: (r) => (
                            <strong
                              className={
                                r.quantity < r.reorder_level ? "stock-low" : ""
                              }
                            >
                              {r.quantity}
                            </strong>
                          ),
                        },
                        { key: "reorder_level", label: "Reorder at" },
                        {
                          key: "availability",
                          label: "Availability",
                          render: (r) => <Badge>{r.availability}</Badge>,
                        },
                        {
                          key: "stock_value",
                          label: "Stock value",
                          render: (r) => money(r.stock_value),
                        },
                      ]}
                    />
                  </div>
                )}
                {section === "movements" && (
                  <div className="panel">
                    <div className="panel-heading">
                      <h2>Movement ledger</h2>
                      <span className="muted">
                        {data.rows?.length} posted transactions
                      </span>
                    </div>
                    <MovementTable rows={data.rows || []} />
                  </div>
                )}
                {section === "alerts" && (
                  <>
                    <div className="stat-grid">
                      <div className="stat-card warning">
                        <div className="stat-top">
                          <span>OPEN LOW-STOCK ALERTS</span>
                          <AlertTriangle size={18} />
                        </div>
                        <strong>{data.alerts.length}</strong>
                        <small>Inventory below its reorder threshold</small>
                      </div>
                      <div className="stat-card">
                        <div className="stat-top">
                          <span>FLAGGED WITHDRAWALS</span>
                          <Activity size={18} />
                        </div>
                        <strong>{data.anomalies.length}</strong>
                        <small>Individual issues of 50 units or more</small>
                      </div>
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Unusual stock movements</h2>
                          <p>
                            Review flags provide context; they are not a
                            determination of fraud.
                          </p>
                        </div>
                        <Badge tone="amber">Review queue</Badge>
                      </div>
                      <Table
                        rows={data.anomalies}
                        columns={[
                          {
                            key: "movement_id",
                            label: "Movement",
                            render: (r) => (
                              <span className="mono">
                                MV-{String(r.movement_id).padStart(4, "0")}
                              </span>
                            ),
                          },
                          {
                            key: "product_name",
                            label: "Product",
                            render: (r) => <strong>{r.product_name}</strong>,
                          },
                          { key: "warehouse_name", label: "Warehouse" },
                          { key: "quantity", label: "Units issued" },
                          {
                            key: "rule_name",
                            label: "Rule",
                            render: (r) => (
                              <Badge tone="amber">{r.rule_name}</Badge>
                            ),
                          },
                          {
                            key: "occurred_at",
                            label: "Movement date",
                            render: (r) => date(r.occurred_at),
                          },
                        ]}
                      />
                    </section>
                    <section className="panel result-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Low-stock positions</h2>
                          <p>
                            Receipts resolve these alerts automatically when
                            stock reaches the threshold.
                          </p>
                        </div>
                      </div>
                      <Table
                        rows={data.alerts}
                        columns={[
                          {
                            key: "product_name",
                            label: "Product",
                            render: (r) => <strong>{r.product_name}</strong>,
                          },
                          { key: "warehouse_name", label: "Warehouse" },
                          { key: "observed_quantity", label: "On hand" },
                          { key: "threshold", label: "Reorder level" },
                          {
                            key: "status",
                            label: "Alert status",
                            render: (r) => <Badge>{r.status}</Badge>,
                          },
                        ]}
                      />
                    </section>
                  </>
                )}
                {section === "orders" && (
                  <>
                    <div className="tabs">
                      {["", "PLACED", "DRAFT", "RECEIVED", "CANCELLED"].map(
                        (v) => (
                          <button
                            key={v}
                            className={status === v ? "selected" : ""}
                            onClick={() => setStatus(v)}
                          >
                            {v || "All orders"}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="order-grid">
                      {(data.rows || [])
                        .filter((r) => !status || r.status === status)
                        .map((r) => (
                          <button
                            className="order-card"
                            key={r.order_id}
                            onClick={() =>
                              setModal({ type: "order_detail", order: r })
                            }
                          >
                            <div className="order-top">
                              <span className="order-number">
                                PO-{String(r.order_id).padStart(4, "0")}
                              </span>
                              <Badge>{r.status}</Badge>
                            </div>
                            <h2>{r.supplier_name}</h2>
                            <p>
                              <Warehouse size={15} />
                              {r.warehouse_name}
                            </p>
                            <div className="order-bottom">
                              <div>
                                <small>
                                  {r.items.length} line items ·{" "}
                                  {date(r.order_date)}
                                </small>
                                <strong>{money(r.total)}</strong>
                              </div>
                              <ArrowUpRight size={21} />
                            </div>
                          </button>
                        ))}
                    </div>
                    {!(data.rows || []).filter(
                      (r) => !status || r.status === status,
                    ).length && (
                      <div className="panel">
                        <Empty title="No orders in this status" />
                      </div>
                    )}
                  </>
                )}
                {section === "patterns" && (
                  <Patterns
                    data={data}
                    meta={meta}
                    admin={admin}
                    mutate={mutate}
                    setModal={setModal}
                    refresh={refresh}
                  />
                )}
                {section === "reports" && (
                  <Reports reports={data.reports || []} />
                )}
                {section === "catalog" && (
                  <div className="panel">
                    <div className="tabs catalog-tabs">
                      {[
                        "products",
                        "categories",
                        "suppliers",
                        "warehouses",
                      ].map((v) => (
                        <button
                          key={v}
                          className={catalog === v ? "selected" : ""}
                          onClick={() => setCatalog(v)}
                        >
                          {v[0].toUpperCase() + v.slice(1)}
                          <span>{data[v]?.length || 0}</span>
                        </button>
                      ))}
                    </div>
                    {!admin && (
                      <p className="readonly-note">
                        <ShieldCheck size={16} />
                        You have read access. An Admin manages these records.
                      </p>
                    )}
                    <Catalog
                      resource={catalog}
                      rows={data[catalog] || []}
                      meta={data}
                      admin={admin}
                      onEdit={(r) =>
                        setModal({
                          type: "master",
                          resource: catalog,
                          record: r,
                        })
                      }
                      onDelete={async (r) => {
                        if (
                          !confirm(
                            "Delete this record? Records with stock or history are protected.",
                          )
                        )
                          return;
                        try {
                          await mutate(
                            "master_delete",
                            {
                              resource: catalog,
                              id: r[
                                {
                                  products: "product_id",
                                  categories: "category_id",
                                  suppliers: "supplier_id",
                                  warehouses: "warehouse_id",
                                }[catalog]
                              ],
                            },
                            "Record deleted.",
                          );
                        } catch (e) {
                          notify(e.message, true);
                        }
                      }}
                    />
                  </div>
                )}
                {section === "users" && (
                  <div className="panel">
                    <div className="panel-heading">
                      <h2>Workspace members</h2>
                      <Badge tone="green">Database-enforced roles</Badge>
                    </div>
                    <Table
                      rows={data.rows || []}
                      columns={[
                        {
                          key: "full_name",
                          label: "Member",
                          render: (r) => (
                            <div className="product-cell">
                              <span className="avatar light">
                                {r.full_name[0]}
                              </span>
                              <strong>{r.full_name}</strong>
                            </div>
                          ),
                        },
                        { key: "email", label: "Email address" },
                        {
                          key: "role",
                          label: "Access role",
                          render: (r) => <Badge>{r.role}</Badge>,
                        },
                        {
                          key: "access",
                          label: "Responsibilities",
                          render: (r) =>
                            r.role === "ADMIN"
                              ? "Master data, receiving, users, and all operations"
                              : "Inventory, stock movements, and order creation",
                        },
                      ]}
                    />
                    <div className="panel-foot">
                      Passwords are hashed. Admin and Staff connect through
                      separate, restricted PostgreSQL roles.
                    </div>
                  </div>
                )}
              </>
            )
          )}
          <footer className="page-footer">
            <span>SmartVault · A clear view of every unit.</span>
            <span>
              <ShieldCheck size={13} />
              {admin ? "Admin" : "Staff"} workspace
            </span>
          </footer>
        </div>
      </main>
      {modal && meta && (
        <OperationModal
          modal={modal}
          meta={meta}
          admin={admin}
          onClose={() => setModal(null)}
          onSave={async (action, payload, message) => {
            await mutate(action, payload, message);
            setModal(null);
          }}
        />
      )}
      {toast && (
        <div className={"toast " + (toast.bad ? "bad" : "")} role="status">
          {toast.bad ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Overview({ data, openMovement }) {
  const c = data.counts;
  const max = Math.max(...data.warehouses.map((w) => Number(w.units)), 1);
  return (
    <>
      <div className="stat-grid">
        {[
          {
            label: "TOTAL STOCK",
            value: number(c.units),
            note: "Across " + c.warehouses + " warehouses",
            icon: Boxes,
          },
          {
            label: "INVENTORY VALUE",
            value: money(c.stock_value),
            note: c.products + " products in your catalog",
            icon: Package,
          },
          {
            label: "LOW-STOCK POSITIONS",
            value: c.low_stock,
            note: "Below their reorder level",
            icon: AlertTriangle,
            warn: true,
          },
          {
            label: "OPEN PURCHASE ORDERS",
            value: c.open_orders,
            note: "Placed and awaiting receipt",
            icon: ShoppingCart,
          },
        ].map((s) => (
          <div
            className={"stat-card " + (s.warn ? "warning" : "")}
            key={s.label}
          >
            <div className="stat-top">
              <span>{s.label}</span>
              <s.icon size={18} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="overview-main">
        <section className="panel warehouse-panel">
          <div className="panel-heading">
            <div>
              <h2>Stock across your warehouses</h2>
              <p>Current units and their inventory value</p>
            </div>
            <Link href="/dashboard/inventory" className="text-link">
              View inventory
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="warehouse-bars">
            {data.warehouses.map((w, i) => (
              <div className="warehouse-row" key={w.warehouse_name}>
                <span className={"warehouse-icon wh-" + i}>
                  <Warehouse size={21} />
                </span>
                <div className="warehouse-bar-info">
                  <div>
                    <strong>{w.warehouse_name}</strong>
                    <span>{number(w.units)} units</span>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{ width: (Number(w.units) / max) * 100 + "%" }}
                    />
                  </div>
                </div>
                <strong className="warehouse-value">
                  {money(w.stock_value)}
                </strong>
              </div>
            ))}
          </div>
          <div className="warehouse-summary">
            <span>
              <i />
              {c.warehouses} connected warehouses
            </span>
            <strong>{number(c.units)} total units</strong>
          </div>
        </section>
        <section className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <h2>Needs attention</h2>
              <p>Stock positions to keep an eye on</p>
            </div>
            <span className="count-pill">{c.low_stock}</span>
          </div>
          <div className="attention-list">
            {data.alerts.map((r) => (
              <div
                className="attention-row"
                key={r.product_id + ":" + r.warehouse_id}
              >
                <span
                  className={"attention-dot " + (!r.quantity ? "red" : "")}
                />
                <div>
                  <strong>{r.product_name}</strong>
                  <small>{r.warehouse_name}</small>
                </div>
                <span className={"stock-count " + (!r.quantity ? "red" : "")}>
                  {r.quantity}
                  <small> / {r.reorder_level}</small>
                </span>
              </div>
            ))}
          </div>
          <Link href="/dashboard/alerts" className="panel-bottom-link">
            Explore inventory
            <ArrowRightIcon />
          </Link>
        </section>
      </div>
      <div className="overview-bottom">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>The latest movements in your ledger</p>
            </div>
            <Link href="/dashboard/movements" className="text-link">
              All movements
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <MovementTable rows={data.recent} compact />
        </section>
        <section className="insight-card">
          <span className="insight-icon">
            <Network size={25} />
          </span>
          <span className="eyebrow">PATTERN INTELLIGENCE</span>
          <h2>
            Similar behavior.
            <br />
            Smarter decisions.
          </h2>
          <p>
            Find inventory positions with similar stock coverage and movement
            patterns.
          </p>
          <Link className="button" href="/dashboard/patterns">
            Explore patterns
            <ArrowUpRight size={16} />
          </Link>
          <div className="insight-foot">
            <span>
              {c.anomalies} movement{c.anomalies === 1 ? "" : "s"} flagged for
              review
            </span>
            <Activity size={16} />
          </div>
        </section>
      </div>
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={15} />;
}
function MovementTable({ rows, compact = false }) {
  const columns = [
    {
      key: "movement_id",
      label: "Reference",
      render: (r) => (
        <span className="mono">
          MV-{String(r.movement_id).padStart(4, "0")}
        </span>
      ),
    },
    {
      key: "product_name",
      label: "Product",
      render: (r) => <strong>{r.product_name}</strong>,
    },
    {
      key: "movement_type",
      label: "Movement",
      render: (r) => <Badge>{r.movement_type}</Badge>,
    },
    {
      key: "quantity",
      label: "Units",
      render: (r) => <strong>{r.quantity}</strong>,
    },
  ];
  if (!compact)
    columns.push(
      { key: "source", label: "From" },
      { key: "destination", label: "To" },
      { key: "full_name", label: "Recorded by" },
    );
  columns.push({
    key: "occurred_at",
    label: "Date",
    render: (r) => date(r.occurred_at),
  });
  return <Table rows={rows} columns={columns} />;
}
function Catalog({ resource, rows, meta, admin, onEdit, onDelete }) {
  const columns =
    resource === "products"
      ? [
          {
            key: "product_name",
            label: "Product",
            render: (r) => (
              <div>
                <strong>{r.product_name}</strong>
                <small className="cell-sub">{r.sku}</small>
              </div>
            ),
          },
          {
            key: "category_id",
            label: "Category",
            render: (r) =>
              meta.categories.find((c) => c.category_id === r.category_id)
                ?.category_name,
          },
          {
            key: "preferred_supplier_id",
            label: "Preferred supplier",
            render: (r) =>
              meta.suppliers.find(
                (s) => s.supplier_id === r.preferred_supplier_id,
              )?.supplier_name,
          },
          {
            key: "unit_price",
            label: "Unit price",
            render: (r) => money(r.unit_price),
          },
        ]
      : resource === "categories"
        ? [
            {
              key: "category_name",
              label: "Category",
              render: (r) => <strong>{r.category_name}</strong>,
            },
            {
              key: "parent_category_id",
              label: "Parent category",
              render: (r) =>
                meta.categories.find(
                  (c) => c.category_id === r.parent_category_id,
                )?.category_name || "Top level",
            },
          ]
        : resource === "suppliers"
          ? [
              {
                key: "supplier_name",
                label: "Supplier",
                render: (r) => <strong>{r.supplier_name}</strong>,
              },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
            ]
          : [
              {
                key: "warehouse_name",
                label: "Warehouse",
                render: (r) => <strong>{r.warehouse_name}</strong>,
              },
              { key: "city", label: "City" },
            ];
  if (admin)
    columns.push({
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label={
              "Edit " +
              (r.product_name ||
                r.category_name ||
                r.supplier_name ||
                r.warehouse_name)
            }
            onClick={() => onEdit(r)}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button danger"
            aria-label={
              "Delete " +
              (r.product_name ||
                r.category_name ||
                r.supplier_name ||
                r.warehouse_name)
            }
            onClick={() => onDelete(r)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    });
  return <Table rows={rows} columns={columns} />;
}
function Reports({ reports }) {
  const [active, setActive] = useState(reports[0]?.id),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selected = reports.find((r) => r.id === active);
  async function run() {
    setBusy(true);
    setError("");
    try {
      setResult(await read("reports?id=" + active));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reports-layout">
      <div className="panel report-options">
        {reports.map((r) => (
          <button
            key={r.id}
            className={r.id === active ? "active" : ""}
            onClick={() => {
              setActive(r.id);
              setResult(null);
              setError("");
            }}
          >
            <strong>{r.title}</strong>
            <small>{r.concept}</small>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      <div>
        <section className="panel sql-panel">
          <div className="panel-heading">
            <div>
              <h2>{selected?.title}</h2>
              <p>{selected?.concept}</p>
            </div>
            <button className="button primary" onClick={run} disabled={busy}>
              {busy ? "Running…" : "Run report"}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <pre className="sql-code">
            <code>
              {selected?.sql
                .replaceAll(" FROM ", "\nFROM ")
                .replaceAll(" WHERE ", "\nWHERE ")
                .replaceAll(" GROUP BY ", "\nGROUP BY ")
                .replaceAll(" ORDER BY ", "\nORDER BY ")
                .replaceAll(" HAVING ", "\nHAVING ")
                .replaceAll(" JOIN ", "\nJOIN ")}
            </code>
          </pre>
        </section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <section className="panel result-panel">
          <div className="panel-heading">
            <h2>Query results</h2>
            <span className="muted">
              {result ? result.rows.length + " rows" : "Ready to run"}
            </span>
          </div>
          {result ? (
            result.rows.length ? (
              <Table
                rows={result.rows}
                columns={result.columns.map((k) => ({
                  key: k,
                  label: k.replaceAll("_", " "),
                }))}
              />
            ) : (
              <Empty
                title={
                  active === "ledger"
                    ? "All balances reconcile"
                    : "No rows matched"
                }
                text={
                  active === "ledger"
                    ? "Inventory quantities agree with the movement ledger."
                    : "The query executed successfully."
                }
              />
            )
          ) : (
            <Empty
              title="Your results will appear here"
              text="Choose a report and run it against the live database."
            />
          )}
        </section>
      </div>
    </div>
  );
}
function Patterns({ data, meta, admin, mutate, setModal, refresh }) {
  const [selected, setSelected] = useState(""),
    [matches, setMatches] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [restore, setRestore] = useState("");
  useEffect(() => {
    if (data.rows?.length && !data.rows.some((r) => r.id === selected))
      setSelected(data.rows[0].id);
    else if (!data.rows?.length) setSelected("");
  }, [data, selected]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setBusy(true);
    setError("");
    read("similar?id=" + encodeURIComponent(selected))
      .then((d) => {
        if (active) setMatches(d);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setMatches(null);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [selected, refresh]);
  const rows = (data.rows || []).filter((r) =>
    (r.product_name + " " + r.warehouse_name)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="pattern-toolbar">
        <div className="pattern-explainer">
          <span className="mini-icon">
            <Network size={18} />
          </span>
          <span>
            Six stock &amp; movement features · Cosine similarity · Persistent
            LanceDB storage
          </span>
        </div>
        {admin && (
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await mutate(
                  "vector_sync",
                  {},
                  "Patterns refreshed from live inventory.",
                );
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <RefreshCw size={15} />
            Refresh patterns
          </button>
        )}
      </div>
      <div className="pattern-layout">
        <section className="panel pattern-list">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search patterns"
              placeholder="Find an inventory position…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="pattern-list-label">
            {rows.length} inventory patterns
          </div>
          {rows.map((r) => (
            <button
              className={
                "pattern-choice " + (selected === r.id ? "active" : "")
              }
              key={r.id}
              onClick={() => setSelected(r.id)}
            >
              <span className="product-icon">
                <Package size={17} />
              </span>
              <div>
                <strong>{r.product_name}</strong>
                <small>{r.warehouse_name}</small>
              </div>
              <span>
                {r.quantity}
                <small>units</small>
              </span>
            </button>
          ))}
        </section>
        <div className="pattern-results">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {matches && (
            <>
              <section className="pattern-source">
                <span className="eyebrow">COMPARING THIS POSITION</span>
                <div>
                  <div>
                    <h2>{matches.source.product_name}</h2>
                    <p>
                      {matches.source.warehouse_name} ·{" "}
                      {matches.source.quantity} units on hand
                    </p>
                  </div>
                  <Network size={34} />
                </div>
                {matches.source.note && (
                  <p className="pattern-note">{matches.source.note}</p>
                )}
                {admin && (
                  <div className="pattern-source-actions">
                    <button
                      onClick={() =>
                        setModal({
                          type: "pattern_note",
                          record: matches.source,
                        })
                      }
                    >
                      <Pencil size={13} />
                      Edit note
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            "Delete this vector record? PostgreSQL inventory will remain available.",
                          )
                        )
                          try {
                            await mutate(
                              "vector_delete",
                              { id: selected },
                              "Pattern deleted. Restore it below or refresh patterns.",
                            );
                            setSelected("");
                          } catch (e) {
                            setError(e.message);
                          }
                      }}
                    >
                      <Trash2 size={13} />
                      Delete pattern
                    </button>
                  </div>
                )}
              </section>
              <div className="section-title">
                <h2>Closest inventory patterns</h2>
                <span>{busy ? "Comparing…" : "Similarity, highest first"}</span>
              </div>
              <div className="match-grid">
                {matches.matches.map((r, i) => (
                  <div className="match-card" key={r.id}>
                    <div className="match-top">
                      <span>0{i + 1}</span>
                      <strong>
                        {Math.round(r.similarity * 100)}
                        <small>%</small>
                      </strong>
                    </div>
                    <h3>{r.product_name}</h3>
                    <p>{r.warehouse_name}</p>
                    <div className="match-bar">
                      <span style={{ width: r.similarity * 100 + "%" }} />
                    </div>
                    <div className="match-footer">
                      <span>{r.quantity} units</span>
                      <button onClick={() => setSelected(r.id)}>
                        Compare
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <details className="panel feature-details">
                <summary>How this pattern is represented</summary>
                <p className="muted">
                  These are normalized operational features, not text
                  embeddings. Similarity is a comparison score, not a fraud
                  probability.
                </p>
                {matches.features.map((f, i) => (
                  <div className="feature-row" key={f}>
                    <span>{f}</span>
                    <div className="bar-track">
                      <span
                        style={{ width: matches.source.vector[i] * 100 + "%" }}
                      />
                    </div>
                    <code>{Number(matches.source.vector[i]).toFixed(3)}</code>
                  </div>
                ))}
              </details>
            </>
          )}
        </div>
      </div>
      {admin && (
        <div className="panel restore-pattern">
          <div>
            <h3>Create or restore a pattern</h3>
            <p>
              Build a vector record from an existing PostgreSQL inventory
              position.
            </p>
          </div>
          <select
            aria-label="Pattern to restore"
            value={restore}
            onChange={(e) => setRestore(e.target.value)}
          >
            <option value="">Choose product &amp; warehouse</option>
            {meta?.products.flatMap((p) =>
              meta.warehouses.map((w) => (
                <option
                  key={p.product_id + ":" + w.warehouse_id}
                  value={p.product_id + ":" + w.warehouse_id}
                >
                  {p.product_name} / {w.warehouse_name}
                </option>
              )),
            )}
          </select>
          <button
            className="button secondary"
            disabled={!restore}
            onClick={async () => {
              try {
                await mutate(
                  "vector_upsert",
                  { id: restore },
                  "Pattern saved.",
                );
                setSelected(restore);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <Plus size={15} />
            Save pattern
          </button>
        </div>
      )}
    </>
  );
}
function OperationModal({ modal, meta, admin, onClose, onSave }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [type, setType] = useState("TRANSFER"),
    [items, setItems] = useState([
      {
        product_id: meta.products[0]?.product_id || "",
        quantity: 1,
        unit_cost: meta.products[0]?.unit_price || 0,
      },
    ]);
  const form = useRef();
  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (modal.type === "movement")
        await onSave(
          "movement",
          {
            product_id: Number(f.product_id),
            source_warehouse_id:
              type === "RECEIPT" ? null : Number(f.source_warehouse_id),
            destination_warehouse_id:
              type === "ISSUE" ? null : Number(f.destination_warehouse_id),
            movement_type: type,
            quantity: Number(f.quantity),
            note: f.note || "",
          },
          "Stock movement recorded.",
        );
      if (modal.type === "order")
        await onSave(
          "order",
          {
            supplier_id: Number(f.supplier_id),
            warehouse_id: Number(f.warehouse_id),
            items: items.map((i) => ({
              ...i,
              product_id: Number(i.product_id),
              quantity: Number(i.quantity),
              unit_cost: Number(i.unit_cost),
            })),
          },
          "Purchase order placed.",
        );
      if (modal.type === "user")
        await onSave("user_create", f, "Account created.");
      if (modal.type === "pattern_note")
        await onSave(
          "vector_update",
          { id: modal.record.id, note: f.note || "" },
          "Pattern note updated.",
        );
      if (modal.type === "master") {
        const resource = modal.resource;
        const data = { ...f };
        for (const k of [
          "category_id",
          "preferred_supplier_id",
          "parent_category_id",
        ])
          if (k in data) data[k] = data[k] ? Number(data[k]) : null;
        if ("unit_price" in data) data.unit_price = Number(data.unit_price);
        const key = {
          products: "product_id",
          categories: "category_id",
          suppliers: "supplier_id",
          warehouses: "warehouse_id",
        }[resource];
        await onSave(
          modal.record ? "master_update" : "master_create",
          { resource, data, id: modal.record?.[key] },
          "Record saved.",
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  if (modal.type === "order_detail") {
    const o = modal.order;
    return (
      <Modal
        title={"Purchase order PO-" + String(o.order_id).padStart(4, "0")}
        subtitle={o.supplier_name + " · " + o.warehouse_name}
        onClose={onClose}
      >
        <div className="order-detail-meta">
          <Badge>{o.status}</Badge>
          <span>
            {date(o.order_date)} · Created by {o.full_name}
          </span>
        </div>
        <Table
          rows={o.items}
          columns={[
            { key: "product_name", label: "Product" },
            { key: "quantity", label: "Quantity" },
            {
              key: "unit_cost",
              label: "Unit cost",
              render: (r) => money(r.unit_cost),
            },
            {
              key: "total",
              label: "Line total",
              render: (r) => money(r.quantity * r.unit_cost),
            },
          ]}
        />
        <div className="order-total">
          <span>Order total</span>
          <strong>{money(o.total)}</strong>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Close
          </button>
          {admin && ["PLACED", "DRAFT"].includes(o.status) && (
            <button
              className="button secondary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onSave(
                    "cancel_order",
                    { order_id: o.order_id },
                    "Order cancelled.",
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setPending(false);
                }
              }}
            >
              Cancel order
            </button>
          )}
          {admin && o.status === "PLACED" && (
            <button
              className="button primary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onSave(
                    "receive_order",
                    { order_id: o.order_id },
                    "Order received. Inventory updated.",
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Receiving…" : "Receive stock"}
            </button>
          )}
        </div>
      </Modal>
    );
  }
  const title =
    modal.type === "movement"
      ? "Record stock movement"
      : modal.type === "order"
        ? "New purchase order"
        : modal.type === "user"
          ? "Create workspace account"
          : modal.type === "pattern_note"
            ? "Edit pattern note"
            : (modal.record ? "Edit " : "Add ") +
              (modal.resource === "categories"
                ? "category"
                : modal.resource?.slice(0, -1));
  const r = modal.record || {};
  return (
    <Modal
      title={title}
      subtitle={
        modal.type === "movement"
          ? "Balances and alerts update when the movement is saved."
          : undefined
      }
      onClose={onClose}
    >
      <form ref={form} onSubmit={submit}>
        {modal.type === "movement" && (
          <>
            <div className="type-picker">
              {["TRANSFER", "RECEIPT", "ISSUE"].map((t) => (
                <button
                  type="button"
                  className={type === t ? "active" : ""}
                  key={t}
                  onClick={() => setType(t)}
                >
                  {t[0] + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <Field label="Product">
              <select name="product_id" required>
                {meta.products.map((p) => (
                  <option value={p.product_id} key={p.product_id}>
                    {p.product_name} · {p.sku}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              {type !== "RECEIPT" && (
                <Field label="From warehouse">
                  <select name="source_warehouse_id" required>
                    {meta.warehouses.map((w) => (
                      <option value={w.warehouse_id} key={w.warehouse_id}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {type !== "ISSUE" && (
                <Field label="To warehouse">
                  <select
                    name="destination_warehouse_id"
                    defaultValue={meta.warehouses[1]?.warehouse_id}
                    required
                  >
                    {meta.warehouses.map((w) => (
                      <option value={w.warehouse_id} key={w.warehouse_id}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <Field label="Quantity">
              <input
                name="quantity"
                type="number"
                min="1"
                max="1000000"
                defaultValue="1"
                required
              />
            </Field>
            <Field label="Note (optional)">
              <textarea
                name="note"
                maxLength={200}
                placeholder="What is this movement for?"
              />
            </Field>
          </>
        )}
        {modal.type === "order" && (
          <>
            <div className="form-grid">
              <Field label="Supplier">
                <select name="supplier_id" required>
                  {meta.suppliers.map((s) => (
                    <option value={s.supplier_id} key={s.supplier_id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Receiving warehouse">
                <select name="warehouse_id" required>
                  {meta.warehouses.map((w) => (
                    <option value={w.warehouse_id} key={w.warehouse_id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-section-label">ORDER ITEMS</div>
            {items.map((item, i) => (
              <div className="order-item-form" key={i}>
                <Field label="Product">
                  <select
                    aria-label={"Line " + (i + 1) + " product"}
                    value={item.product_id}
                    onChange={(e) =>
                      setItems((old) =>
                        old.map((v, j) =>
                          j === i
                            ? {
                                ...v,
                                product_id: e.target.value,
                                unit_cost:
                                  meta.products.find(
                                    (p) =>
                                      p.product_id === Number(e.target.value),
                                  )?.unit_price || 0,
                              }
                            : v,
                        ),
                      )
                    }
                  >
                    {meta.products.map((p) => (
                      <option value={p.product_id} key={p.product_id}>
                        {p.product_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    aria-label={"Line " + (i + 1) + " quantity"}
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(e) =>
                      setItems((old) =>
                        old.map((v, j) =>
                          j === i ? { ...v, quantity: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Unit cost (₹)">
                  <input
                    aria-label={"Line " + (i + 1) + " unit cost"}
                    type="number"
                    min="0"
                    step=".01"
                    required
                    value={item.unit_cost}
                    onChange={(e) =>
                      setItems((old) =>
                        old.map((v, j) =>
                          j === i ? { ...v, unit_cost: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={"Remove line " + (i + 1)}
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-link add-line"
              onClick={() =>
                setItems([
                  ...items,
                  {
                    product_id:
                      meta.products.find(
                        (p) =>
                          !items.some(
                            (i) => Number(i.product_id) === p.product_id,
                          ),
                      )?.product_id || meta.products[0]?.product_id,
                    quantity: 1,
                    unit_cost: 0,
                  },
                ])
              }
            >
              <Plus size={15} />
              Add line item
            </button>
            <div className="order-total">
              <span>Order total</span>
              <strong>
                {money(
                  items.reduce(
                    (s, i) => s + Number(i.quantity) * Number(i.unit_cost),
                    0,
                  ),
                )}
              </strong>
            </div>
          </>
        )}
        {modal.type === "user" && (
          <>
            <Field label="Full name">
              <input name="full_name" required maxLength={100} />
            </Field>
            <Field label="Email address">
              <input name="email" type="email" required maxLength={160} />
            </Field>
            <div className="form-grid">
              <Field label="Role">
                <select name="role">
                  <option>STAFF</option>
                  <option>ADMIN</option>
                </select>
              </Field>
              <Field label="Password (at least 10 characters)">
                <input
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </Field>
            </div>
          </>
        )}
        {modal.type === "pattern_note" && (
          <Field label="Review note">
            <textarea
              name="note"
              defaultValue={r.note}
              maxLength={300}
              placeholder="Add context for this inventory pattern."
            />
          </Field>
        )}
        {modal.type === "master" && (
          <>
            {modal.resource === "products" && (
              <>
                <div className="form-grid">
                  <Field label="Product name">
                    <input
                      name="product_name"
                      defaultValue={r.product_name}
                      required
                      maxLength={100}
                    />
                  </Field>
                  <Field label="SKU">
                    <input
                      name="sku"
                      defaultValue={r.sku}
                      required
                      pattern="[a-zA-Z0-9_-]{2,30}"
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Category">
                    <select
                      name="category_id"
                      defaultValue={r.category_id}
                      required
                    >
                      {meta.categories.map((c) => (
                        <option value={c.category_id} key={c.category_id}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Preferred supplier">
                    <select
                      name="preferred_supplier_id"
                      defaultValue={r.preferred_supplier_id}
                      required
                    >
                      {meta.suppliers.map((s) => (
                        <option value={s.supplier_id} key={s.supplier_id}>
                          {s.supplier_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Unit price (₹)">
                  <input
                    name="unit_price"
                    type="number"
                    min="0"
                    step=".01"
                    defaultValue={r.unit_price || 0}
                    required
                  />
                </Field>
              </>
            )}
            {modal.resource === "categories" && (
              <>
                <Field label="Category name">
                  <input
                    name="category_name"
                    defaultValue={r.category_name}
                    required
                    maxLength={80}
                  />
                </Field>
                <Field label="Parent category">
                  <select
                    name="parent_category_id"
                    defaultValue={r.parent_category_id || ""}
                  >
                    <option value="">Top level (no parent)</option>
                    {meta.categories
                      .filter((c) => c.category_id !== r.category_id)
                      .map((c) => (
                        <option value={c.category_id} key={c.category_id}>
                          {c.category_name}
                        </option>
                      ))}
                  </select>
                </Field>
              </>
            )}
            {modal.resource === "suppliers" && (
              <>
                <Field label="Supplier name">
                  <input
                    name="supplier_name"
                    defaultValue={r.supplier_name}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    defaultValue={r.email}
                    required
                    maxLength={160}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    name="phone"
                    defaultValue={r.phone}
                    required
                    maxLength={20}
                  />
                </Field>
              </>
            )}
            {modal.resource === "warehouses" && (
              <>
                <Field label="Warehouse name">
                  <input
                    name="warehouse_name"
                    defaultValue={r.warehouse_name}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="City">
                  <input
                    name="city"
                    defaultValue={r.city}
                    required
                    maxLength={80}
                  />
                </Field>
              </>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={pending}>
            {pending
              ? "Saving…"
              : modal.type === "order"
                ? "Place order"
                : modal.type === "movement"
                  ? "Save movement"
                  : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
