import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileSignature,
  ClipboardList,
  Wrench,
  CalendarDays,
  ReceiptText,
  Wallet,
  Megaphone,
  FolderOpen,
  Settings2,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  X,
  Check,
  CircleAlert,
  KeyRound,
  Menu,
  Home,
  ShieldCheck,
} from "lucide-react";
const icons = {
  properties: Building2,
  units: DoorOpen,
  tenants: Users,
  leases: FileSignature,
  applications: ClipboardList,
  maintenance: Wrench,
  vendors: Users,
  inspections: ClipboardList,
  tasks: ClipboardList,
  events: CalendarDays,
  invoices: ReceiptText,
  payments: Wallet,
  notices: Megaphone,
  documents: FolderOpen,
};
const editable = [
  "units",
  "tenants",
  "leases",
  "applications",
  "maintenance",
  "inspections",
  "tasks",
  "events",
];
const date = (s) =>
  s
    ? new Date(s + "T12:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
export default function Portal({
  state,
  api,
  onRefresh,
  onLogout,
  onHome,
  Logo,
}) {
  const { user, records, modules, settings } = state,
    tenant = user.role === "tenant";
  const [page, setPage] = useState("overview"),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [notice, setNotice] = useState("");
  const active = records.filter((r) => !r.archived),
    get = (id) => records.find((r) => r.id === id),
    of = (id) => active.filter((r) => r.module === id),
    money = (n) =>
      new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: settings.currency,
        maximumFractionDigits: 2,
      }).format(Number(n) || 0);
  const m = modules.find((m) => m.id === page),
    items = of(page).filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase()),
    );
  const invoices = of("invoices"),
    payments = of("payments").filter((r) => r.status === "Posted");
  const balance = invoices
      .filter((r) => r.status === "Issued")
      .reduce(
        (s, r) =>
          s +
          Math.max(
            0,
            Number(r.amount) -
              payments
                .filter((p) => p.invoiceId === r.id)
                .reduce((n, p) => n + Number(p.amount), 0),
          ),
        0,
      ),
    requests = of("maintenance").filter(
      (r) => !["Completed", "Cancelled"].includes(r.status),
    );
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const timer = setTimeout(
      () =>
        document
          .querySelector(
            ".portal-dialog input,.portal-dialog select,.portal-dialog button",
          )
          ?.focus(),
      30,
    );
    return () => {
      clearTimeout(timer);
      previous?.focus();
    };
  }, [modal?.type, modal?.record?.id]);
  function go(p) {
    setPage(p);
    setSearch("");
    setMobile(false);
    setError("");
  }
  async function send(path, body, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await onRefresh();
      setModal(null);
      setNotice("Saved successfully");
      setTimeout(() => setNotice(""), 3500);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function value(f, r) {
    if (f.type === "reference") return get(r[f.key])?.name || "—";
    if (f.type === "money") return money(r[f.key]);
    if (f.type === "date") return date(r[f.key]);
    if (f.type === "url")
      return r[f.key] ? (
        <a href={r[f.key]} target="_blank" rel="noreferrer">
          Open document ↗
        </a>
      ) : (
        "—"
      );
    return String(r[f.key] ?? "") || "—";
  }
  const allowedModules = tenant
    ? modules
    : modules.filter((m) => m.id !== "vendors");
  const nav = allowedModules.map((m) => [
    m.id,
    tenant
      ? {
          maintenance: "My requests",
          events: "Appointments",
          invoices: "My invoices",
          payments: "Payment history",
          leases: "My lease",
          documents: "My documents",
        }[m.id] || m.label
      : m.label,
    icons[m.id] || ClipboardList,
  ]);
  const heading =
    page === "overview"
      ? tenant
        ? "Tenant dashboard"
        : "Agent dashboard"
      : page === "settings"
        ? "Account settings"
        : nav.find((n) => n[0] === page)?.[1] || page;
  function badges(r) {
    return (
      <span
        className={
          "badge " +
          (["Open", "Pending", "Draft", "Urgent"].includes(r.status)
            ? "amber"
            : "green")
        }
      >
        <i />
        {r.status}
      </span>
    );
  }
  function detail(r) {
    setError("");
    setModal({ type: "detail", record: r });
  }
  function list(rows) {
    return rows.length ? (
      <div className="portal-list">
        {rows.map((r) => (
          <button key={r.id} onClick={() => detail(r)}>
            <span className="record-icon">
              {React.createElement(icons[r.module] || ClipboardList, {
                size: 18,
              })}
            </span>
            <div>
              <b>{r.name}</b>
              <small>
                {r.dueDate
                  ? "Due " + date(r.dueDate)
                  : r.eventDate
                    ? date(r.eventDate)
                    : r.unitId
                      ? get(r.unitId)?.name
                      : r.residentDescription ||
                        modules.find((m) => m.id === r.module)?.label}
              </small>
            </div>
            {badges(r)}
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    ) : (
      <div className="portal-empty">
        <Check size={24} />
        <h3>Nothing here yet.</h3>
        <p>
          {tenant
            ? "Your property team will share updates here."
            : "Updates for your assigned properties will appear here."}
        </p>
      </div>
    );
  }
  function overview() {
    const unit = get(of("tenants")[0]?.unitId) || of("units")[0],
      building = unit && get(unit.propertyId),
      lease = of("leases").find((l) => l.status === "Active");
    const stats = tenant
      ? [
          [
            "Outstanding balance",
            money(balance),
            "Based on issued invoices",
            ReceiptText,
          ],
          [
            "Monthly rent",
            money(lease?.rent || 0),
            "From your active lease",
            Wallet,
          ],
          [
            "Open requests",
            requests.length,
            "Your maintenance requests",
            Wrench,
          ],
        ]
      : [
          [
            "Assigned properties",
            of("properties").length,
            "Your connected portfolio",
            Building2,
          ],
          [
            "Active leases",
            of("leases").filter((l) => l.status === "Active").length,
            "Across assigned properties",
            FileSignature,
          ],
          ["Open work orders", requests.length, "Keep things moving", Wrench],
        ];
    return (
      <>
        <div className="portal-welcome">
          <div>
            <span className="eyebrow">
              {tenant ? "YOUR HOME, CONNECTED" : "YOUR PROPERTIES, CONNECTED"}
            </span>
            <h2>
              {tenant
                ? "A little closer to home."
                : "Make room for a productive day."}
            </h2>
            <p>
              {tenant
                ? "Your home information, requests, and updates. All in one place."
                : "A clear view of your assignments and what needs your attention."}
            </p>
          </div>
          {tenant ? (
            <button onClick={() => setModal({ type: "request" })}>
              <Plus size={16} />
              Request maintenance
            </button>
          ) : (
            <button onClick={() => go("applications")}>
              Review applications <ArrowUpRight size={16} />
            </button>
          )}
        </div>
        <div className="portal-stats">
          {stats.map(([label, n, sub, Icon]) => (
            <div className="metric" key={label}>
              <div className="metric-label">
                {label}
                <span>
                  <Icon size={18} />
                </span>
              </div>
              <strong>{n}</strong>
              <small>{sub}</small>
            </div>
          ))}
        </div>
        <div className="portal-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{tenant ? "Your home" : "Your properties"}</h2>
                <p>
                  {tenant
                    ? "The details that make it yours."
                    : "Places you help look after."}
                </p>
              </div>
              <Building2 size={19} />
            </div>
            {tenant ? (
              <div className="tenant-home-card">
                <span className="home-key">
                  <KeyRound size={30} />
                </span>
                <h3>{unit?.name || "Your unit is being connected"}</h3>
                <p>
                  {building
                    ? [building.address, building.city]
                        .filter(Boolean)
                        .join(", ")
                    : "Your administrator can link your resident record to a unit."}
                </p>
                {lease && (
                  <div>
                    <span>Lease ends</span>
                    <b>{date(lease.endDate)}</b>
                  </div>
                )}
                <button onClick={() => go("leases")}>
                  View my lease <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              list(of("properties").slice(0, 4))
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {tenant
                    ? "Your maintenance requests"
                    : "Work that needs attention"}
                </h2>
                <p>
                  {tenant
                    ? "Stay close to the progress."
                    : "Priorities across your assignments."}
                </p>
              </div>
              <button className="link" onClick={() => go("maintenance")}>
                View all <ArrowRight size={14} />
              </button>
            </div>
            {list(requests.slice(0, 4))}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>{tenant ? "Latest notices" : "Leasing pipeline"}</h2>
              <button
                className="link"
                onClick={() => go(tenant ? "notices" : "applications")}
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
            {list(of(tenant ? "notices" : "applications").slice(0, 3))}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>{tenant ? "Your appointments" : "Tasks to keep moving"}</h2>
              <button
                className="link"
                onClick={() => go(tenant ? "events" : "tasks")}
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
            {list(
              of(tenant ? "events" : "tasks")
                .filter(
                  (r) => !["Done", "Cancelled", "Completed"].includes(r.status),
                )
                .slice(0, 3),
            )}
          </section>
        </div>
        {tenant && (
          <p className="portal-note">
            Payments are handled outside this portal. Your payment history shows
            amounts recorded by your property team. For emergencies, contact
            local emergency services; maintenance requests are not monitored as
            an emergency service.
          </p>
        )}
      </>
    );
  }
  function table() {
    let fields = (m?.fields || [])
      .filter(
        (f) =>
          f.key !== "name" &&
          f.type !== "textarea" &&
          items.some((r) => r[f.key] !== undefined),
      )
      .slice(0, 3);
    if (tenant && page === "maintenance")
      fields = [
        { key: "residentDescription", label: "Description", type: "text" },
        { key: "priority", label: "Priority", type: "text" },
      ];
    return (
      <section className="panel">
        <div className="table-tools">
          <div className="searchbox">
            <Search size={17} />
            <input
              aria-label="Search portal records"
              placeholder={"Search " + heading.toLowerCase() + "…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="pill">{items.length} records</span>
        </div>
        {items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Record</th>
                  {fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button className="record-name" onClick={() => detail(r)}>
                        <b>{r.name}</b>
                      </button>
                    </td>
                    {fields.map((f) => (
                      <td key={f.key}>{value(f, r)}</td>
                    ))}
                    <td>{badges(r)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"View " + r.name}
                        onClick={() => detail(r)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          list([])
        )}
      </section>
    );
  }
  function account() {
    return (
      <section className="panel portal-account">
        <div className="panel-heading">
          <div>
            <h2>Your account</h2>
            <p>
              {user.email} · {tenant ? "Tenant" : "Agent"}
            </p>
          </div>
          <ShieldCheck size={20} />
        </div>
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send(
              "/auth/password",
              Object.fromEntries(new FormData(e.target)),
            );
            if (ok) e.target.reset();
          }}
        >
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <p className="form-hint">
            Use at least 12 characters. Your other sessions will be signed out.
          </p>
          <button className="primary" disabled={busy}>
            Change password
          </button>
        </form>
      </section>
    );
  }
  const r = modal?.record,
    rm = modules.find((m) => m.id === r?.module),
    fm = modules.find((m) => m.id === modal?.module);
  return (
    <>
      <div className={"portal-sidebar " + (mobile ? "open" : "")}>
        <Logo />
        <div className="portal-role">
          <span />
          {tenant ? "Tenant portal" : "Agent workspace"}
        </div>
        <nav>
          <button
            className={page === "overview" ? "active" : ""}
            onClick={() => go("overview")}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="portal-bottom">
          <button onClick={() => go("settings")}>
            <Settings2 size={17} />
            Account settings
          </button>
          <button onClick={onHome}>
            <Home size={17} />
            Arcland homepage
          </button>
          <div className="profile">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <b>{user.name}</b>
              <small>{tenant ? "Tenant" : "Agent"}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={onLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <main className="portal-main">
        <header>
          <div className="crumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={19} />
            </button>
            <span>{tenant ? "Tenant portal" : "Agent workspace"}</span>
            <ArrowRight size={12} />
            <b>{heading}</b>
          </div>
          <button className="portal-home-link" onClick={onHome}>
            Arcland Properties <ArrowUpRight size={14} />
          </button>
        </header>
        <div className="content">
          <div className="title-row">
            <div>
              <div className="section-eyebrow">
                WELCOME, {user.name.split(" ")[0]}
              </div>
              <h1>{heading}</h1>
              <p>
                {tenant
                  ? "A place for your home, your records, and your next step."
                  : "Your assigned portfolio, thoughtfully connected."}
              </p>
            </div>
            {tenant && page === "maintenance" ? (
              <button
                className="primary"
                onClick={() => {
                  setError("");
                  setModal({ type: "request" });
                }}
              >
                <Plus size={16} />
                New request
              </button>
            ) : !tenant && m && editable.includes(m.id) ? (
              <button
                className="primary"
                onClick={() => {
                  setError("");
                  setModal({ type: "edit", module: m.id });
                }}
              >
                <Plus size={16} />
                Add {m.singular}
              </button>
            ) : null}
          </div>
          {error && !modal && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {page === "overview"
            ? overview()
            : page === "settings"
              ? account()
              : table()}
          <footer>
            <span>
              © {new Date().getFullYear()} {settings.company}
            </span>
            <span>Your place, connected.</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal portal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.type === "request"
                ? "New maintenance request"
                : modal.type === "edit"
                  ? "Edit record"
                  : "Record details"
            }
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setModal(null);
              if (e.key === "Tab") {
                const fields = [
                  ...e.currentTarget.querySelectorAll(
                    "input,select,textarea,button:not(:disabled),a[href]",
                  ),
                ];
                if (e.shiftKey && document.activeElement === fields[0]) {
                  e.preventDefault();
                  fields.at(-1)?.focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === fields.at(-1)
                ) {
                  e.preventDefault();
                  fields[0]?.focus();
                }
              }
            }}
          >
            <div className="modal-heading">
              <div>
                <span className="section-eyebrow">
                  {tenant ? "YOUR TENANT PORTAL" : "YOUR AGENT WORKSPACE"}
                </span>
                <h2>
                  {modal.type === "request"
                    ? "How can we help?"
                    : modal.type === "edit"
                      ? (r ? "Edit " : "Add ") + fm?.singular
                      : r?.name}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {modal.type === "request" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(
                    "/tenant/requests",
                    Object.fromEntries(new FormData(e.target)),
                  );
                }}
              >
                <label className="field">
                  <span>Request title</span>
                  <input
                    name="title"
                    required
                    maxLength={150}
                    placeholder="e.g. Kitchen tap leaking"
                  />
                </label>
                <label className="field">
                  <span>What’s happening?</span>
                  <textarea
                    name="description"
                    required
                    minLength={5}
                    maxLength={5000}
                    rows={4}
                  />
                </label>
                <label className="field">
                  <span>Priority</span>
                  <select name="priority">
                    <option>Normal</option>
                    <option>Low</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </label>
                <p className="form-hint">
                  Your current unit is attached automatically. For emergencies,
                  contact local emergency services.
                </p>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button className="primary" disabled={busy}>
                    Submit request
                  </button>
                </div>
              </form>
            ) : modal.type === "edit" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = Object.fromEntries(new FormData(e.target)),
                    status = data._status;
                  delete data._status;
                  send(
                    "/records/" + fm.id + (r ? "/" + r.id : ""),
                    { data, status, version: r?.version },
                    r ? "PATCH" : "POST",
                  );
                }}
              >
                <div className="form-grid">
                  {fm.fields.map((f) => (
                    <label className="field" key={f.key}>
                      <span>
                        {f.label}
                        {f.required ? " *" : ""}
                      </span>
                      {f.type === "reference" ? (
                        <select
                          name={f.key}
                          aria-label={f.label}
                          required={f.required}
                          defaultValue={r?.[f.key] || ""}
                        >
                          <option value="">Select…</option>
                          {active
                            .filter((x) => x.module === f.module)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                              </option>
                            ))}
                        </select>
                      ) : f.type === "select" ? (
                        <select
                          name={f.key}
                          aria-label={f.label}
                          defaultValue={r?.[f.key] || f.options[0]}
                        >
                          {f.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : f.type === "textarea" ? (
                        <textarea
                          name={f.key}
                          aria-label={f.label}
                          defaultValue={r?.[f.key] || ""}
                          required={f.required}
                          maxLength={10000}
                        />
                      ) : (
                        <input
                          name={f.key}
                          aria-label={f.label}
                          type={
                            ["number", "money"].includes(f.type)
                              ? "number"
                              : f.type
                          }
                          required={f.required}
                          min={f.min}
                          max={f.max}
                          step={f.type === "money" ? "0.01" : "any"}
                          defaultValue={r?.[f.key] ?? ""}
                        />
                      )}
                    </label>
                  ))}
                  <label className="field">
                    <span>Status</span>
                    <select
                      name="_status"
                      defaultValue={r?.status || fm.statuses[0]}
                    >
                      {fm.statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button className="primary" disabled={busy}>
                    Save record
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="detail-status">{badges(r)}</div>
                <dl className="details">
                  {(rm?.fields || [])
                    .filter((f) => f.key !== "name" && r[f.key] !== undefined)
                    .map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>{value(f, r)}</dd>
                      </div>
                    ))}
                  {r.residentDescription && (
                    <div>
                      <dt>Your description</dt>
                      <dd>{r.residentDescription}</dd>
                    </div>
                  )}
                </dl>
                <div className="modal-actions">
                  {tenant &&
                    r.module === "maintenance" &&
                    r.status === "Open" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          send("/tenant/requests/" + r.id + "/cancel", {
                            version: r.version,
                          })
                        }
                      >
                        Cancel this request
                      </button>
                    )}
                  {!tenant && editable.includes(r.module) && (
                    <button
                      onClick={() =>
                        setModal({ type: "edit", module: r.module, record: r })
                      }
                    >
                      Edit record
                    </button>
                  )}
                  {!tenant &&
                    editable.includes(r.module) &&
                    rm?.action.from.includes(r.status) && (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          send(`/records/${r.module}/${r.id}/action`, {
                            version: r.version,
                          })
                        }
                      >
                        {rm.action.label}
                      </button>
                    )}
                  <button onClick={() => setModal(null)}>Close</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
