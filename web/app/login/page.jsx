"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Boxes,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("asha@smartvault.example"),
    [password, setPassword] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-shell">
      <section className="login-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Boxes size={25} />
          </span>
          SmartVault<span className="brand-dot">.</span>
        </a>
        <div className="story-body">
          <span className="eyebrow">INVENTORY INTELLIGENCE</span>
          <h1>
            Every unit.
            <br />
            Accounted for.
          </h1>
          <p>
            A clearer view of your warehouses.
            <br />A smarter way to keep stock moving.
          </p>
          <div className="warehouse-illustration">
            <div className="illustration-line" />
            {["Central", "North", "West"].map((n, i) => (
              <div className={"illustration-node node-" + i} key={n}>
                <Warehouse size={28} />
                <strong>{n}</strong>
                <span>
                  <i /> Connected
                </span>
              </div>
            ))}
            <div className="illustration-hub">
              <Boxes size={31} />
            </div>
          </div>
          <div className="story-foot">
            <ShieldCheck size={18} />
            <span>Connected stock. Controlled access. Clear decisions.</span>
          </div>
        </div>
        <small>SMARTVAULT / DBMS PROJECT</small>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <span className="login-badge">
            <CheckCircle2 size={14} /> Your inventory workspace
          </span>
          <h2>Welcome back</h2>
          <p className="muted">
            Sign in to see what’s in stock, and what’s next.
          </p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary wide" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="login-roles">
            <span>Demo account</span>
            <button onClick={() => setEmail("asha@smartvault.example")}>
              Admin
            </button>
            <button onClick={() => setEmail("ravi@smartvault.example")}>
              Staff
            </button>
          </div>
          <p className="login-help">
            Your role determines the actions available in your workspace.
          </p>
        </div>
        <small className="login-bottom">
          Multi-warehouse inventory &amp; anomaly detection
        </small>
      </section>
    </main>
  );
}
