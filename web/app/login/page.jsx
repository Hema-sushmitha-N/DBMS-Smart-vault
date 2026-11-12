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
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("asha@smartvault.example");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "login"
              ? { email, password }
              : { full_name: fullName, email, password },
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  function changeMode() {
    const nextMode = mode === "login" ? "register" : "login";
    setMode(nextMode);
    setEmail(nextMode === "login" ? "asha@smartvault.example" : "");
    setPassword("");
    setConfirmPassword("");
    setError("");
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
            {["Central", "North", "West"].map((name, index) => (
              <div className={"illustration-node node-" + index} key={name}>
                <Warehouse size={28} />
                <strong>{name}</strong>
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
          <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to see what’s in stock, and what’s next."
              : "Create a Staff account to access your inventory workspace."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  type="text"
                  name="full_name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete={mode === "login" ? "username" : "email"}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode === "login"
                    ? "Enter your password"
                    : "Use at least 10 characters"
                }
              />
            </label>
            {mode === "register" && (
              <label>
                Confirm password
                <input
                  type="password"
                  name="confirm_password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary wide" disabled={pending}>
              {pending
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign in"
                  : "Create Staff account"}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode === "login" && (
            <div className="login-roles">
              <span>Demo account</span>
              <button
                type="button"
                onClick={() => setEmail("asha@smartvault.example")}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setEmail("ravi@smartvault.example")}
              >
                Staff
              </button>
            </div>
          )}
          <button type="button" className="auth-switch" onClick={changeMode}>
            {mode === "login"
              ? "New here? Create a Staff account"
              : "Already have an account? Sign in"}
          </button>
          <p className="login-help">
            {mode === "login"
              ? "Your role determines the actions available in your workspace."
              : "New accounts receive Staff access. An Admin creates Admin accounts."}
          </p>
        </div>
        <small className="login-bottom">
          Multi-warehouse inventory &amp; anomaly detection
        </small>
      </section>
    </main>
  );
}
