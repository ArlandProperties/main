import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Building2,
  DoorOpen,
  BriefcaseBusiness,
  Users,
  FileSignature,
  ClipboardList,
  ReceiptText,
  Wallet,
  CreditCard,
  ChartPie,
  Wrench,
  HardHat,
  ClipboardCheck,
  Package,
  FolderOpen,
  Megaphone,
  ListTodo,
  CalendarDays,
  ShieldCheck,
  KeyRound,
  Circle,
  Sprout,
  Plus,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChartNoAxesCombined,
  Archive,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Download,
  Grid2X2,
  Blocks,
  Check,
  History,
  Settings2,
  LogOut,
  Menu,
  Search,
  Bell,
  ChevronsUpDown,
  LayoutDashboard,
  CircleAlert,
  CircleCheck,
  LockKeyhole,
  UserPlus,
  ExternalLink,
  Pencil,
  ArchiveRestore,
  X,
  RotateCcw,
} from "lucide-react";
const I = {
  Building2,
  DoorOpen,
  BriefcaseBusiness,
  Users,
  FileSignature,
  ClipboardList,
  ReceiptText,
  Wallet,
  CreditCard,
  ChartPie,
  Wrench,
  HardHat,
  ClipboardCheck,
  Package,
  FolderOpen,
  Megaphone,
  ListTodo,
  CalendarDays,
  ShieldCheck,
  KeyRound,
  Circle,
  Sprout,
  Plus,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChartNoAxesCombined,
  Archive,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Download,
  Grid2X2,
  Blocks,
  Check,
  History,
  Settings2,
  LogOut,
  Menu,
  Search,
  Bell,
  ChevronsUpDown,
  LayoutDashboard,
  CircleAlert,
  CircleCheck,
  LockKeyhole,
  UserPlus,
  ExternalLink,
  Pencil,
  ArchiveRestore,
  X,
  RotateCcw,
};
import { modules, moduleMap, featureCatalog } from "../shared/modules";
import "./style.css";
import HomePage from "./Home.jsx";
import Portal from "./Portal.jsx";
import "./portals.css";
const Icon = ({ name, size = 18, ...props }) => {
  const C = I[name] || I.Circle;
  return <C size={size} strokeWidth={1.7} {...props} />;
};
async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Arcland-Request": "1",
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}
const dateText = (s) =>
  s
    ? new Date(s + "T12:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
const labelOf = (m, r) => r?.name || "Untitled";
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v) =>
  '"' +
  String(v ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';
function App() {
  const [user, setUser] = useState(null),
    [auth, setAuth] = useState(null),
    [ready, setReady] = useState(false),
    [state, setState] = useState(null),
    [page, setPage] = useState("overview"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [archive, setArchive] = useState(false),
    [sort, setSort] = useState("name"),
    [direction, setDirection] = useState("asc"),
    [pageNum, setPageNum] = useState(1),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(null),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false),
    [activity, setActivity] = useState([]),
    [team, setTeam] = useState([]),
    [calendarMonth, setCalendarMonth] = useState(
      new Date().toISOString().slice(0, 7),
    );
  const [route, setRoute] = useState(window.location.pathname);
  const [authIntent, setAuthIntent] = useState(
    window.location.hash.includes("activate="),
  );
  function navigate(path) {
    window.history.pushState(null, "", path);
    setRoute(path);
    setAuthIntent(false);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const pop = () => setRoute(window.location.pathname);
    const hash = () => {
      if (window.location.hash.includes("activate=")) setAuthIntent(true);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (user && ["/signin", "/login"].includes(route)) navigate("/dashboard");
  }, [user, route]);
  const tell = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };
  async function refresh() {
    const d = await api("/bootstrap");
    setState(d);
    setUser(d.user);
    return d;
  }
  useEffect(() => {
    (async () => {
      try {
        setAuth(await api("/auth/status"));
        try {
          await refresh();
        } catch (e) {
          if (e.status !== 401) throw e;
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    if (!user) return;
    if (page === "activity")
      api("/audit")
        .then((d) => setActivity(d.events))
        .catch((e) => tell(e.message, "error"));
    if (page === "team")
      api("/users")
        .then((d) => setTeam(d.users))
        .catch((e) => tell(e.message, "error"));
  }, [page, user]);
  useEffect(() => {
    setError("");
  }, [modal?.type, modal?.record?.id]);
  useEffect(() => {
    function escape(e) {
      if (e.key === "Escape") {
        setModal(null);
        setMobile(false);
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  function go(p) {
    setPage(p);
    setQuery("");
    setStatus("all");
    setArchive(false);
    setPageNum(1);
    setMobile(false);
    setError("");
  }
  async function mutate(
    path,
    body,
    method = "POST",
    message = "Saved successfully",
  ) {
    setBusy(true);
    setError("");
    try {
      const r = await api(path, { method, body: JSON.stringify(body) });
      await refresh();
      setModal(null);
      tell(message);
      return r;
    } catch (e) {
      setError(e.message);
      tell(e.message, "error");
      if (e.status === 409) await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }
  const records = state?.records || [],
    active = records.filter((r) => !r.archived),
    canEdit = user && user.role !== "viewer",
    isAdmin = user?.role === "admin";
  const currency = state?.settings?.currency || "CAD";
  const money = (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  const get = (id) => records.find((r) => r.id === id);
  const of = (m) => active.filter((r) => r.module === m);
  const m = moduleMap[page];
  function exportRecords(module, rows) {
    const cols = [
      "name",
      "status",
      ...module.fields.filter((f) => f.key !== "name").map((f) => f.key),
      "createdAt",
      "updatedAt",
    ];
    download(
      [
        cols.map(csvCell).join(","),
        ...rows.map((r) =>
          cols
            .map((k) => {
              const f = module.fields.find((f) => f.key === k);
              return csvCell(
                f?.type === "reference" ? get(r[k])?.name || r[k] : r[k],
              );
            })
            .join(","),
        ),
      ].join("\r\n"),
      `arcland-${module.id}-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
    );
    tell("CSV report downloaded");
  }
  const visible = useMemo(() => {
    if (!m) return [];
    return records
      .filter(
        (r) =>
          r.module === page &&
          r.archived === archive &&
          (status === "all" || r.status === status) &&
          [
            r.name,
            r.status,
            ...m.fields.map((f) =>
              f.type === "reference" ? get(r[f.key])?.name : r[f.key],
            ),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) => {
        const av = a[sort] ?? "",
          bv = b[sort] ?? "";
        const cmp =
          typeof av === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return direction === "asc" ? cmp : -cmp;
      });
  }, [records, page, query, status, archive, sort, direction]);
  if (!ready)
    return (
      <div className="loading">
        <Logo />
        <span>Opening your workspace…</span>
      </div>
    );
  if (route === "/" && !authIntent)
    return (
      <HomePage
        Logo={Logo}
        user={user}
        onSignIn={() => navigate("/signin")}
        onDashboard={() => navigate("/dashboard")}
      />
    );
  if (!user)
    return (
      <Auth
        auth={auth}
        error={error}
        onHome={() => navigate("/")}
        onLogin={async () => {
          await refresh();
          navigate("/dashboard");
        }}
      />
    );
  if (["agent", "tenant"].includes(user.role))
    return (
      <Portal
        state={state}
        api={api}
        onRefresh={refresh}
        onLogout={logout}
        onHome={() => navigate("/")}
        Logo={Logo}
      />
    );
  const units = of("units"),
    occupied = units.filter((u) => u.status === "Occupied").length,
    occupancy = units.length ? Math.round((100 * occupied) / units.length) : 0,
    income = of("leases")
      .filter((l) => l.status === "Active")
      .reduce((s, r) => s + Number(r.rent || 0), 0),
    work = of("maintenance").filter(
      (r) => !["Completed", "Cancelled"].includes(r.status),
    );
  const outstanding = of("invoices")
    .filter((r) => r.status === "Issued")
    .reduce(
      (s, r) =>
        s +
        Math.max(
          0,
          Number(r.amount) -
            of("payments")
              .filter((p) => p.status === "Posted" && p.invoiceId === r.id)
              .reduce((s, p) => s + Number(p.amount), 0),
        ),
      0,
    );
  const pageTitle =
    m?.label ||
    {
      overview:
        user.role === "admin" ? "Admin dashboard" : "Portfolio overview",
      reports: "Portfolio insights",
      calendar: "Portfolio calendar",
      activity: "Activity log",
      team: "Team & access",
      settings: "Workspace settings",
      features: "Feature directory",
    }[page];
  const desc =
    m?.description ||
    {
      overview: "A clearer view of your properties. A better way to manage.",
      reports: "Turn your portfolio data into confident decisions.",
      calendar: "Every important date, in one considered view.",
      activity: "A clear record of the work behind your portfolio.",
      team: "Give the right people the right access.",
      settings: "Make this workspace feel like your business.",
      features:
        "Explore the 200 module capabilities available in your workspace.",
    }[page];
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
      setState(null);
      setAuth(await api("/auth/status"));
    } catch (e) {
      tell(e.message, "error");
      setUser(null);
      setState(null);
    }
    setPage("overview");
    setModal(null);
    setError("");
    navigate("/signin");
  }
  function stats() {
    return (
      <div className="metrics">
        {[
          [
            "Properties",
            of("properties").length,
            "Buildings in your portfolio",
            "Building2",
          ],
          [
            "Occupancy",
            occupancy + "%",
            `${occupied} of ${units.length} units occupied`,
            "ChartPie",
          ],
          [
            "Monthly scheduled rent",
            money(income),
            "From active leases",
            "Wallet",
          ],
          [
            "Open work orders",
            work.length,
            `${work.filter((r) => r.priority === "Urgent").length} marked urgent`,
            "Wrench",
          ],
        ].map(([l, v, s, i]) => (
          <div className="metric" key={l}>
            <div className="metric-label">
              {l}
              <span>
                <Icon name={i} />
              </span>
            </div>
            <strong>{v}</strong>
            <small>
              <i />
              {s}
            </small>
          </div>
        ))}
      </div>
    );
  }
  function empty(
    title = "A fresh start.",
    text = "Add your first record to bring this workspace to life.",
  ) {
    return (
      <div className="empty">
        <span className="empty-icon">
          <Icon name={m?.icon || "Sprout"} size={30} />
        </span>
        <h3>{title}</h3>
        <p>{text}</p>
        {m && canEdit && (
          <button
            className="primary"
            onClick={() => setModal({ type: "edit", module: m.id })}
          >
            <Icon name="Plus" />
            Add {m.singular}
          </button>
        )}
      </div>
    );
  }
  function propertyCards() {
    return (
      <div className="property-cards">
        {of("properties")
          .slice(0, 3)
          .map((p, i) => {
            const us = units.filter((u) => u.propertyId === p.id),
              occ = us.filter((u) => u.status === "Occupied").length;
            return (
              <button
                key={p.id}
                className="property-card"
                onClick={() => setModal({ type: "detail", record: p })}
              >
                <div className={"building-art art-" + i}>
                  <div className="building-block">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="building-block second">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="property-badge">{p.type || "Property"}</span>
                </div>
                <div className="property-info">
                  <h3>{p.name}</h3>
                  <p>
                    <Icon name="MapPin" size={12} />
                    {[p.address, p.city].filter(Boolean).join(", ")}
                  </p>
                  <div>
                    <span>
                      <b>{us.length}</b> units
                    </span>
                    <span>
                      <b>
                        {us.length ? Math.round((occ / us.length) * 100) : 0}%
                      </b>{" "}
                      occupied
                    </span>
                    <Icon name="ArrowUpRight" size={16} />
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    );
  }
  function chart() {
    const start = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() - 5 + i, 1);
      const key = d.toISOString().slice(0, 7);
      return {
        label: d.toLocaleString("en", { month: "short" }),
        income: of("payments")
          .filter(
            (p) => p.status === "Posted" && p.paymentDate?.startsWith(key),
          )
          .reduce((s, p) => s + Number(p.amount), 0),
        expense: of("expenses")
          .filter((p) => p.status === "Paid" && p.expenseDate?.startsWith(key))
          .reduce((s, p) => s + Number(p.amount), 0),
      };
    });
    const max = Math.max(1, ...months.flatMap((x) => [x.income, x.expense]));
    return (
      <section className="panel">
        <PanelHead
          title="Income & expenses"
          sub="Recorded payments and paid expenses"
          aside={<span className="pill">Last 6 months</span>}
        />
        <div className="legend">
          <span>
            <i />
            Income received
          </span>
          <span>
            <i className="light" />
            Expenses paid
          </span>
        </div>
        <div className="chart">
          <div className="chart-scale">
            <span>{money(max)}</span>
            <span>{money(max / 2)}</span>
            <span>{money(0)}</span>
          </div>
          <div className="bars">
            {months.map((x, i) => (
              <div className="bar-group" key={i}>
                <div className="bar-pair">
                  <div
                    style={{
                      height: Math.max(2, (100 * x.income) / max) + "%",
                    }}
                    title={`${x.label}: ${money(x.income)} income`}
                  />
                  <div
                    style={{
                      height: Math.max(2, (100 * x.expense) / max) + "%",
                    }}
                    title={`${x.label}: ${money(x.expense)} expense`}
                  />
                </div>
                <span>{x.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-foot">
          <span>Based on your recorded transactions</span>
          <button className="link" onClick={() => go("reports")}>
            View insights <Icon name="ArrowUpRight" size={14} />
          </button>
        </div>
      </section>
    );
  }
  function overview() {
    return (
      <>
        <div className="welcome">
          <div>
            <span className="eyebrow">YOUR PORTFOLIO, AT A GLANCE</span>
            <h2>Good things are taking shape.</h2>
            <p>
              Stay connected to your properties, your people, and what’s next.
            </p>
          </div>
          <button onClick={() => go("properties")}>
            Explore portfolio <Icon name="ArrowUpRight" size={17} />
          </button>
          <div className="welcome-orbit" />
        </div>
        {stats()}
        <div className="two-col">
          {chart()}
          <section className="panel">
            <PanelHead
              title="Needs your attention"
              sub="A few things to keep moving"
              aside={<span className="pill amber">{work.length} open</span>}
            />
            <div className="attention">
              {work.slice(0, 4).map((r) => (
                <button
                  className="attention-item"
                  key={r.id}
                  onClick={() => setModal({ type: "detail", record: r })}
                >
                  <span className="attention-icon">
                    <Icon name="Wrench" />
                  </span>
                  <div>
                    <b>{r.name}</b>
                    <small>
                      {get(r.propertyId)?.name || "Unassigned property"}
                    </small>
                  </div>
                  <Badge value={r.priority || r.status} />
                </button>
              ))}
              {!work.length && (
                <div className="quiet">
                  <Icon name="CircleCheck" size={28} />
                  <p>You’re all caught up.</p>
                  <span>New work orders will appear here.</span>
                </div>
              )}
            </div>
            <div className="panel-foot center">
              <button className="link" onClick={() => go("maintenance")}>
                View all work orders <Icon name="ArrowRight" size={14} />
              </button>
            </div>
          </section>
        </div>
        <section className="panel">
          <PanelHead
            title="Your properties"
            sub="A place for every possibility"
            aside={
              <button className="link" onClick={() => go("properties")}>
                View portfolio <Icon name="ArrowRight" size={14} />
              </button>
            }
          />
          {of("properties").length
            ? propertyCards()
            : empty(
                "Your next chapter starts here.",
                "Add a property, or load a sample portfolio in Settings to explore.",
              )}
        </section>
      </>
    );
  }
  function fieldValue(f, r) {
    if (f.type === "reference") return get(r[f.key])?.name || "—";
    if (f.type === "money") return money(r[f.key]);
    if (f.type === "date") return dateText(r[f.key]);
    if (f.type === "url")
      return r[f.key] ? (
        <a
          href={r[f.key]}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Open document <Icon name="ExternalLink" size={13} />
        </a>
      ) : (
        "—"
      );
    return String(r[f.key] ?? "") || "—";
  }
  function recordTable() {
    const cols = m.fields
        .filter((f) => f.key !== "name" && f.type !== "textarea")
        .slice(0, 3),
      pages = Math.max(1, Math.ceil(visible.length / 12));
    return (
      <section className="panel records">
        <div className="table-tools">
          <div className="searchbox">
            <Icon name="Search" size={16} />
            <input
              aria-label="Search records"
              placeholder={`Search ${m.label.toLowerCase()}…`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPageNum(1);
              }}
            />
          </div>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPageNum(1);
            }}
          >
            <option value="all">All statuses</option>
            {m.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Sort records"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Sort: Name</option>
            <option value="updatedAt">Sort: Updated</option>
            {m.fields
              .filter((f) => ["money", "number", "date"].includes(f.type))
              .map((f) => (
                <option key={f.key} value={f.key}>
                  Sort: {f.label}
                </option>
              ))}
          </select>
          <button
            className="icon-button"
            aria-label="Reverse sort direction"
            onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
          >
            <Icon
              name={
                direction === "asc"
                  ? "ArrowUpNarrowWide"
                  : "ArrowDownWideNarrow"
              }
            />
          </button>
          <button
            className={archive ? "soft active" : "soft"}
            onClick={() => {
              setArchive(!archive);
              setPageNum(1);
            }}
          >
            <Icon name="Archive" size={15} />
            {archive ? "Archived" : "Archive"}
          </button>
        </div>
        {visible.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{m.singular}</th>
                    {cols.map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                    <th>Status</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible
                    .slice(
                      (Math.min(pageNum, pages) - 1) * 12,
                      Math.min(pageNum, pages) * 12,
                    )
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="record-name"
                            onClick={() =>
                              setModal({ type: "detail", record: r })
                            }
                          >
                            <span className="record-icon">
                              <Icon name={m.icon} size={17} />
                            </span>
                            <b>{r.name}</b>
                          </button>
                        </td>
                        {cols.map((f) => (
                          <td key={f.key}>{fieldValue(f, r)}</td>
                        ))}
                        <td>
                          <Badge value={r.status} />
                        </td>
                        <td className="muted">
                          {dateText(r.updatedAt.slice(0, 10))}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`View ${r.name}`}
                            onClick={() =>
                              setModal({ type: "detail", record: r })
                            }
                          >
                            <Icon name="ArrowUpRight" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {visible.length}{" "}
                {visible.length === 1 ? m.singular : m.label.toLowerCase()} ·
                Page {Math.min(pageNum, pages)} of {pages}
              </span>
              <div>
                <button
                  aria-label="Previous page"
                  disabled={pageNum === 1}
                  onClick={() => setPageNum((n) => n - 1)}
                >
                  <Icon name="ChevronLeft" size={15} />
                </button>
                <button
                  aria-label="Next page"
                  disabled={pageNum >= pages}
                  onClick={() => setPageNum((n) => n + 1)}
                >
                  <Icon name="ChevronRight" size={15} />
                </button>
              </div>
            </div>
          </>
        ) : (
          empty(
            archive
              ? "Nothing archived yet."
              : query || status !== "all"
                ? "No matching records."
                : "A fresh start.",
            query || status !== "all"
              ? "Try a different search or status."
              : "Create a record to get started.",
          )
        )}
      </section>
    );
  }
  function reports() {
    const collected = of("payments")
        .filter((p) => p.status === "Posted")
        .reduce((s, p) => s + Number(p.amount), 0),
      spent = of("expenses")
        .filter((p) => p.status === "Paid")
        .reduce((s, p) => s + Number(p.amount), 0);
    return (
      <>
        {stats()}
        <div className="report-numbers">
          <div>
            <small>Total received</small>
            <strong>{money(collected)}</strong>
          </div>
          <div>
            <small>Total paid expenses</small>
            <strong>{money(spent)}</strong>
          </div>
          <div>
            <small>Recorded cash flow</small>
            <strong>{money(collected - spent)}</strong>
          </div>
          <div>
            <small>Outstanding invoices</small>
            <strong>{money(outstanding)}</strong>
          </div>
        </div>
        <div className="two-col">
          {chart()}
          <section className="panel">
            <PanelHead title="Occupancy by property" sub="Live unit status" />
            {of("properties").map((p) => {
              const us = units.filter((u) => u.propertyId === p.id),
                n = us.filter((u) => u.status === "Occupied").length;
              return (
                <div className="report-row" key={p.id}>
                  <b>{p.name}</b>
                  <span>
                    {n}/{us.length} occupied
                  </span>
                  <div className="progress">
                    <i
                      style={{
                        width: (us.length ? (100 * n) / us.length : 0) + "%",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {!of("properties").length &&
              empty(
                "No portfolio data yet.",
                "Add properties and units to see occupancy.",
              )}
          </section>
        </div>
        <section className="panel">
          <PanelHead
            title="Budget vs recorded spend"
            sub="Expenses with matching property, year, and category"
          />
          {of("budgets").map((b) => {
            const actual = of("expenses")
              .filter(
                (e) =>
                  e.status === "Paid" &&
                  e.propertyId === b.propertyId &&
                  e.category === b.category &&
                  e.expenseDate?.startsWith(String(b.year)),
              )
              .reduce((s, e) => s + Number(e.amount), 0);
            return (
              <div className="report-row" key={b.id}>
                <b>{b.name}</b>
                <span>
                  {money(actual)} / {money(b.amount)}{" "}
                  <Badge
                    value={actual > b.amount ? "Over budget" : "Within budget"}
                  />
                </span>
                <div className="progress">
                  <i
                    style={{
                      width:
                        Math.min(100, (100 * actual) / Math.max(1, b.amount)) +
                        "%",
                    }}
                  />
                </div>
              </div>
            );
          })}
          {!of("budgets").length &&
            empty(
              "Plan ahead.",
              "Add a budget to compare it with recorded expenses.",
            )}
        </section>
      </>
    );
  }
  function calendar() {
    const [year, month] = calendarMonth.split("-").map(Number),
      days = new Date(year, month, 0).getDate(),
      offset = new Date(year, month - 1, 1).getDay();
    const dateFields = {
      leases: "endDate",
      invoices: "dueDate",
      maintenance: "dueDate",
      inspections: "inspectionDate",
      assets: "serviceDate",
      tasks: "dueDate",
      events: "eventDate",
      insurance: "expiryDate",
      keys: "returnDate",
      notices: "deliveryDate",
    };
    const events = active.filter(
      (r) =>
        dateFields[r.module] &&
        r[dateFields[r.module]]?.startsWith(calendarMonth),
    );
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Important dates</h2>
            <p>
              Dates shown as recorded; appointments use{" "}
              {state.settings.timezone}.
            </p>
          </div>
          <input
            aria-label="Calendar month"
            type="month"
            value={calendarMonth}
            onChange={(e) => {
              if (e.target.value) setCalendarMonth(e.target.value);
            }}
          />
        </div>
        <div className="calendar-week">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: offset }, (_, i) => (
            <div className="calendar-day off" key={"o" + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const key = `${calendarMonth}-${String(i + 1).padStart(2, "0")}`;
            return (
              <div
                className={
                  "calendar-day " +
                  (key === new Date().toISOString().slice(0, 10) ? "today" : "")
                }
                key={i}
              >
                <b>{i + 1}</b>
                {events
                  .filter((r) => r[dateFields[r.module]] === key)
                  .map((r) => (
                    <button
                      key={r.id}
                      title={`${moduleMap[r.module].label}: ${r.name}`}
                      onClick={() => setModal({ type: "detail", record: r })}
                    >
                      <span />
                      {r.time ? r.time + " " : ""}
                      {r.name}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
        <div className="panel-foot">
          {events.length} records with dates this month
        </div>
      </section>
    );
  }
  function teamPage() {
    return (
      <section className="panel">
        <PanelHead
          title="Your team"
          sub="Administrators manage accounts. Managers edit records. Viewers can read and export."
          aside={
            <button
              className="primary small"
              onClick={() => setModal({ type: "user" })}
            >
              <Icon name="UserPlus" size={15} />
              Add member
            </button>
          }
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Access</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    {u.id === user.id && <small> (you)</small>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <button
                      disabled={u.id === user.id || busy}
                      onClick={() => setModal({ type: "user", record: u })}
                    >
                      {u.role === "manager"
                        ? "Manager"
                        : u.role === "viewer"
                          ? "Viewer"
                          : u.role === "admin"
                            ? "Administrator"
                            : u.role === "agent"
                              ? "Agent"
                              : "Tenant"}
                      {u.id !== user.id && " · Manage"}
                    </button>
                  </td>
                  <td>
                    <Badge value={u.disabled ? "Disabled" : "Active"} />
                  </td>
                  <td>
                    {u.id !== user.id && (
                      <button
                        onClick={() => setModal({ type: "reset", record: u })}
                      >
                        Reset password
                      </button>
                    )}{" "}
                    {u.id !== user.id && (
                      <button
                        disabled={busy}
                        onClick={() => setModal({ type: "access", record: u })}
                      >
                        {u.disabled ? "Enable" : "Disable"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  function settingsPage() {
    return (
      <div className="settings-grid">
        <section className="panel">
          <PanelHead title="Company profile" sub="Your workspace preferences" />
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                "/settings",
                Object.fromEntries(new FormData(e.target)),
                "PUT",
              );
            }}
          >
            <Field label="Company name">
              <input
                name="company"
                defaultValue={state.settings.company}
                required
                maxLength={100}
                disabled={!isAdmin}
              />
            </Field>
            <Field label="Currency">
              <select
                name="currency"
                defaultValue={currency}
                disabled={!isAdmin}
              >
                {["CAD", "USD", "GBP", "EUR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Timezone">
              <input
                name="timezone"
                defaultValue={state.settings.timezone}
                required
                disabled={!isAdmin}
              />
            </Field>
            {isAdmin && (
              <button className="primary" disabled={busy}>
                Save preferences
              </button>
            )}
          </form>
        </section>
        <section className="panel">
          <PanelHead
            title="Account security"
            sub="Keep your access up to date"
          />
          <form
            className="settings-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await mutate(
                "/auth/password",
                Object.fromEntries(new FormData(e.target)),
                "POST",
                "Password changed; other sessions signed out",
              );
              if (result) e.target.reset();
            }}
          >
            <Field label="Current password">
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </Field>
            <p className="form-hint">
              Use at least 12 characters. Changing your password signs out your
              other sessions.
            </p>
            <button className="primary" disabled={busy}>
              Update password
            </button>
          </form>
        </section>
        {isAdmin && (
          <section className="panel">
            <PanelHead
              title="Workspace data"
              sub="Start fresh, explore, and keep a copy"
            />
            <div className="settings-form">
              <p className="form-hint">
                Records are stored on the server. Production uses PostgreSQL. A
                JSON export includes records, company settings, and activity; it
                excludes passwords and sessions. Keep exports private.
              </p>
              <button
                onClick={async () => {
                  try {
                    const d = await api("/backup");
                    download(
                      JSON.stringify(d, null, 2),
                      "arcland-records-backup.json",
                      "application/json",
                    );
                    tell("Records backup downloaded");
                  } catch (e) {
                    tell(e.message, "error");
                  }
                }}
              >
                <Icon name="Download" />
                Download records backup
              </button>
              <hr />
              <h3>Explore a sample portfolio</h3>
              <p className="form-hint">
                Load clearly fictional sample records into an empty workspace.
                No real resident details are included.
              </p>
              <button
                disabled={records.length > 0 || busy}
                onClick={() => setModal({ type: "demo" })}
              >
                <Icon name="Sprout" />
                Load sample portfolio
              </button>
            </div>
          </section>
        )}
        <section className="panel">
          <PanelHead
            title="What’s connected"
            sub="Clear boundaries for your team"
          />
          <div className="settings-form">
            <p className="form-hint">
              Payments are records of money received externally. Notices track
              preparation and external delivery. Document links point to your
              existing secure file system. This release does not charge cards,
              send emails, or store uploaded files.
            </p>
            <button onClick={() => go("features")}>
              <Icon name="Grid2X2" />
              Explore 200 capabilities
            </button>
          </div>
        </section>
      </div>
    );
  }
  function featurePage() {
    return (
      <>
        <div className="feature-banner">
          <Icon name="Blocks" size={30} />
          <div>
            <h2>20 modules. 200 documented capabilities.</h2>
            <p>
              Each module supports nine record workflows plus one domain action.
              Shared account and reporting tools are additional.
            </p>
          </div>
        </div>
        <div className="searchbox standalone">
          <Icon name="Search" />
          <input
            aria-label="Search features"
            placeholder="Find a capability…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="feature-grid">
          {modules
            .filter((m) =>
              featureCatalog.some(
                (f) =>
                  f.module === m.id &&
                  f.label.toLowerCase().includes(query.toLowerCase()),
              ),
            )
            .map((m) => (
              <section className="panel" key={m.id}>
                <PanelHead title={m.label} aside={<Icon name={m.icon} />} />
                <ol>
                  {featureCatalog
                    .filter((f) => f.module === m.id)
                    .map((f) => (
                      <li key={f.id}>
                        <Icon name="Check" size={13} />
                        {f.label.split(": ")[1]}
                      </li>
                    ))}
                </ol>
                <button className="feature-link" onClick={() => go(m.id)}>
                  Open {m.label.toLowerCase()}{" "}
                  <Icon name="ArrowUpRight" size={14} />
                </button>
              </section>
            ))}
        </div>
      </>
    );
  }
  let body = m ? (
    recordTable()
  ) : page === "overview" ? (
    overview()
  ) : page === "reports" ? (
    reports()
  ) : page === "calendar" ? (
    calendar()
  ) : page === "team" ? (
    teamPage()
  ) : page === "settings" ? (
    settingsPage()
  ) : page === "features" ? (
    featurePage()
  ) : (
    <section className="panel">
      <PanelHead
        title="Workspace activity"
        sub="Most recent 1,000 server-recorded events"
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Record</th>
              <th>By</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a.id}>
                <td>{a.action}</td>
                <td>{a.detail || a.module || "Workspace"}</td>
                <td>{a.actor_name}</td>
                <td className="muted">
                  {new Date(a.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!activity.length &&
        empty("Nothing to report.", "Your workspace updates will appear here.")}
    </section>
  );
  return (
    <>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Logo />
        <div className="workspace-label">
          <span className="workspace-dot" />
          Management workspace
          <Icon name="ChevronsUpDown" size={12} />
        </div>
        <div className="nav-scroll">
          <div className="nav-group">
            <small>WORKSPACE</small>
            {[
              ["overview", "Overview", "LayoutDashboard"],
              ["reports", "Insights", "ChartNoAxesCombined"],
              ["calendar", "Calendar", "CalendarDays"],
            ].map(([p, l, i]) => (
              <Nav key={p} {...{ p, l, i, page, go }} />
            ))}
          </div>
          {[
            "Portfolio",
            "Leasing",
            "Financials",
            "Operations",
            "Workspace",
          ].map((group) => (
            <div className="nav-group" key={group}>
              <small>
                {group === "Workspace" ? "COLLABORATION" : group.toUpperCase()}
              </small>
              {modules
                .filter((m) => m.group === group)
                .map((m) => (
                  <Nav
                    key={m.id}
                    p={m.id}
                    l={m.label}
                    i={m.icon}
                    {...{ page, go }}
                    count={m.id === "maintenance" ? work.length : undefined}
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          {isAdmin && (
            <button
              className={page === "team" ? "nav active" : "nav"}
              onClick={() => go("team")}
            >
              <Icon name="Users" />
              Team & access
            </button>
          )}
          <button className="nav" onClick={() => navigate("/")}>
            <Icon name="Building2" />
            Public homepage
          </button>
          <button
            className={page === "activity" ? "nav active" : "nav"}
            onClick={() => go("activity")}
          >
            <Icon name="History" />
            Activity log
          </button>
          <button
            className={page === "settings" ? "nav active" : "nav"}
            onClick={() => go("settings")}
          >
            <Icon name="Settings2" />
            Settings & help
          </button>
          <div className="profile">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <b>{user.name}</b>
              <small>
                {user.role === "admin"
                  ? "Administrator"
                  : user.role === "manager"
                    ? "Property manager"
                    : "Viewer"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={logout}
            >
              <Icon name="LogOut" size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header>
          <div className="crumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Icon name="Menu" />
            </button>
            <span>Workspace</span>
            <Icon name="ChevronRight" size={12} />
            <b>{pageTitle}</b>
          </div>
          <div className="header-right">
            <button
              className="header-search"
              onClick={() => setModal({ type: "search" })}
            >
              <Icon name="Search" size={16} />
              <span>Search workspace…</span>
              <kbd>⌕</kbd>
            </button>
            <button
              className="icon-button notification"
              aria-label="View attention items"
              onClick={() => go("maintenance")}
            >
              <Icon name="Bell" />
              {work.length > 0 && <i />}
            </button>
            {isAdmin && (
              <button
                className="avatar small-avatar"
                aria-label="Manage team"
                onClick={() => go("team")}
              >
                {user.name[0]}
              </button>
            )}
          </div>
        </header>
        <div className="content">
          <div className="title-row">
            <div>
              <div className="section-eyebrow">
                {m?.group || "YOUR WORKSPACE"}
              </div>
              <h1>{pageTitle}</h1>
              <p>{desc}</p>
            </div>
            <div className="title-actions">
              {m ? (
                <>
                  <button onClick={() => exportRecords(m, visible)}>
                    <Icon name="Download" size={15} />
                    Export CSV
                  </button>
                  {canEdit && (
                    <button
                      className="primary"
                      onClick={() => setModal({ type: "edit", module: m.id })}
                    >
                      <Icon name="Plus" size={17} />
                      Add {m.singular}
                    </button>
                  )}
                </>
              ) : page === "overview" ? (
                <>
                  <button onClick={() => go("reports")}>
                    <Icon name="ChartNoAxesCombined" size={15} />
                    View insights
                  </button>
                  {canEdit && (
                    <button
                      className="primary"
                      onClick={() =>
                        setModal({ type: "edit", module: "properties" })
                      }
                    >
                      <Icon name="Plus" size={17} />
                      Add property
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
          {error && !modal && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {body}
          <footer>
            <span>
              © {new Date().getFullYear()} {state.settings.company}
            </span>
            <span>
              <i />
              Thoughtfully managed. Confidently growing.
            </span>
          </footer>
        </div>
      </main>
      {modal && (
        <Modal
          key={modal.type + (modal.record?.id || "")}
          {...{
            modal,
            setModal,
            user,
            state,
            records,
            canEdit,
            isAdmin,
            busy,
            error,
            mutate,
            go,
            get,
            money,
            fieldValue,
            tell,
            refresh,
            setTeam,
          }}
        />
      )}
      {toast && (
        <div className={"toast " + toast.type} role="status">
          <Icon
            name={toast.type === "error" ? "CircleAlert" : "CircleCheck"}
            size={18}
          />
          {toast.message}
        </div>
      )}
    </>
  );
}
function Logo() {
  return (
    <div className="brand">
      <span className="logo-mark">
        <img src="/arcland-logo.png" alt="" />
      </span>
      <div>
        <b>ARCLAND</b>
        <small>PROPERTIES INC</small>
      </div>
    </div>
  );
}
function Badge({ value }) {
  const bad = [
    "Urgent",
    "Over budget",
    "Expired",
    "Lost",
    "Declined",
    "Disabled",
    "Rejected",
  ];
  const amber = [
    "Open",
    "Pending",
    "Draft",
    "Review due",
    "Renewal due",
    "Service due",
    "High",
    "To do",
    "Follow-up",
    "Ending",
  ];
  return (
    <span
      className={
        "badge " +
        (bad.includes(value)
          ? "red"
          : amber.includes(value)
            ? "amber"
            : "green")
      }
    >
      <i />
      {value}
    </span>
  );
}
function PanelHead({ title, sub, aside }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {aside}
    </div>
  );
}
function Field({ label, children, required }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {children}
    </label>
  );
}
function Nav({ p, l, i, page, go, count }) {
  return (
    <button
      className={"nav " + (page === p ? "active" : "")}
      onClick={() => go(p)}
    >
      <Icon name={i} size={17} />
      <span>{l}</span>
      {count > 0 && <b>{count}</b>}
    </button>
  );
}
function Auth({ auth, onLogin, onHome, error: initialError }) {
  const [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  function readActivationToken() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const value = params.get("activate");
    if (value)
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    return value;
  }
  const [activationToken, setActivationToken] = useState(readActivationToken);
  const [activationInfo, setActivationInfo] = useState(null);
  useEffect(() => {
    function consumeLink() {
      const value = readActivationToken();
      if (value) {
        setActivationToken(value);
        setActivationInfo(null);
        setError("");
      }
    }
    window.addEventListener("hashchange", consumeLink);
    return () => window.removeEventListener("hashchange", consumeLink);
  }, []);
  useEffect(() => {
    if (!activationToken) return;
    api("/auth/activation-info", {
      method: "POST",
      body: JSON.stringify({ activationToken }),
    })
      .then(setActivationInfo)
      .catch((e) => setError(e.message));
  }, [activationToken]);
  const activating = !!activationToken;
  const setup = !activating && auth?.needsSetup;
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Logo />
        <div className="auth-copy">
          <span className="eyebrow">ROOM TO GROW.</span>
          <h1>
            Better places.
            <br />
            Stronger connections.
          </h1>
          <p>
            A thoughtfully connected home for your properties, your people, and
            everything in between.
          </p>
          <div className="auth-art">
            <div className="tower">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="tower short">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="sun" />
            <div className="ground" />
          </div>
        </div>
        <small>ARCLAND PROPERTIES INC · MANAGEMENT WORKSPACE</small>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          {onHome && (
            <button className="auth-back" onClick={onHome}>
              ← Back to homepage
            </button>
          )}
          <span className="auth-badge">
            <Icon name="ShieldCheck" size={15} />
            Your secure workspace
          </span>
          <h2>
            {activating
              ? "Set your password."
              : setup
                ? "Build your foundation."
                : "Welcome back."}
          </h2>
          <p>
            {activating
              ? "Activate your administrator account with a password only you know."
              : setup
                ? "Create the first administrator account to get started."
                : "One secure sign-in for administrators, agents, and tenants."}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {activating && !activationInfo ? (
            <p>
              {error
                ? "Request a new activation link from your workspace administrator."
                : "Checking your activation link…"}
            </p>
          ) : !auth ? (
            <p>Unable to reach the server. Refresh to try again.</p>
          ) : setup && !auth.setupEnabled ? (
            <div className="error">
              Set SETUP_TOKEN in the server environment before creating your
              owner account.
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await onLogin(
                    await api(
                      activating
                        ? "/auth/activate"
                        : setup
                          ? "/auth/setup"
                          : "/auth/login",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          ...Object.fromEntries(new FormData(e.target)),
                          ...(activating ? { activationToken } : {}),
                        }),
                      },
                    ),
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {setup && (
                <>
                  <Field label="Your name">
                    <input
                      name="name"
                      required
                      maxLength={100}
                      autoComplete="name"
                      placeholder="Full name"
                    />
                  </Field>
                  <Field label="Setup token">
                    <input
                      name="setupToken"
                      type="password"
                      required
                      autoComplete="off"
                      placeholder="From your server environment"
                    />
                  </Field>
                </>
              )}
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  required
                  readOnly={activating}
                  defaultValue={activationInfo?.email || ""}
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  required
                  minLength={setup || activating ? 12 : 1}
                  maxLength={128}
                  autoComplete={
                    setup || activating ? "new-password" : "current-password"
                  }
                  placeholder={
                    setup || activating
                      ? "At least 12 characters"
                      : "Enter your password"
                  }
                />
              </Field>
              <button className="primary auth-submit" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : activating
                    ? "Activate account"
                    : setup
                      ? "Create workspace"
                      : "Sign in"}
                <Icon name="ArrowRight" size={17} />
              </button>
            </form>
          )}
          <p className="auth-foot">
            {activating
              ? "This private link works once and expires after 24 hours. Choose a password of at least 12 characters."
              : setup
                ? "Only the first account can be created here. Administrators add team members inside the workspace."
                : "Your account determines your dashboard. Need access? Contact your property administrator."}
          </p>
        </div>
        <small className="auth-bottom">
          <Icon name="LockKeyhole" size={13} />
          Private by design. Connected by purpose.
        </small>
      </div>
    </div>
  );
}
function Modal({
  modal,
  setModal,
  user,
  state,
  records,
  canEdit,
  isAdmin,
  busy,
  error,
  mutate,
  go,
  get,
  money,
  fieldValue,
  tell,
  refresh,
  setTeam,
}) {
  const [accountRole, setAccountRole] = useState(modal.record?.role || "agent");
  const [localError, setLocalError] = useState(""),
    [search, setSearch] = useState("");
  const close = () => setModal(null),
    record = modal.record
      ? records.find((r) => r.id === modal.record.id) || modal.record
      : null,
    m = moduleMap[modal.module || record?.module];
  useEffect(() => {
    const t = setTimeout(
      () =>
        document
          .querySelector(".modal input, .modal select, .modal button")
          ?.focus(),
      20,
    );
    return () => clearTimeout(t);
  }, []);
  let body, title, subtitle;
  if (modal.type === "edit") {
    title = record ? `Edit ${m.singular}` : `Add ${m.singular}`;
    subtitle = m.description;
    body = (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLocalError("");
          const fd = Object.fromEntries(new FormData(e.target));
          const status = fd._status;
          delete fd._status;
          await mutate(
            "/records/" + m.id + (record ? "/" + record.id : ""),
            { data: fd, status, version: record?.version },
            record ? "PATCH" : "POST",
          );
        }}
      >
        <div className="form-grid">
          {m.fields.map((f) => (
            <Field key={f.key} label={f.label} required={f.required}>
              {f.type === "reference" ? (
                <select
                  name={f.key}
                  required={f.required}
                  defaultValue={record?.[f.key] || ""}
                >
                  <option value="">
                    Select {moduleMap[f.module].singular}…
                  </option>
                  {records
                    .filter((r) => r.module === f.module && !r.archived)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              ) : f.type === "select" ? (
                <select
                  name={f.key}
                  defaultValue={record?.[f.key] || f.options[0]}
                >
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.key}
                  defaultValue={record?.[f.key] || ""}
                  required={f.required}
                  rows={3}
                  maxLength={10000}
                />
              ) : (
                <input
                  name={f.key}
                  type={
                    f.type === "money" || f.type === "number"
                      ? "number"
                      : f.type
                  }
                  min={f.min}
                  max={f.max}
                  step={
                    f.type === "money"
                      ? "0.01"
                      : f.type === "number"
                        ? "any"
                        : undefined
                  }
                  defaultValue={record?.[f.key] ?? ""}
                  required={f.required}
                  maxLength={500}
                />
              )}
            </Field>
          ))}
          <Field label="Status">
            <select
              name="_status"
              defaultValue={record?.status || m.statuses[0]}
            >
              {m.statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        {["payments", "notices", "documents"].includes(m.id) && (
          <p className="form-hint">
            {m.id === "payments"
              ? "This records an external payment. No funds are charged or transferred."
              : m.id === "notices"
                ? "Delivery happens outside this app. Status changes do not send messages."
                : "Use a secure HTTPS URL from your existing document system. No files are uploaded."}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy
              ? "Saving…"
              : record
                ? "Save changes"
                : "Create " + m.singular}
          </button>
        </div>
      </form>
    );
  }
  if (modal.type === "detail") {
    title = record.name;
    subtitle = m.label;
    body = (
      <>
        <div className="detail-status">
          <Badge value={record.status} />
          {record.archived && <span className="pill">Archived</span>}
          <small>Version {record.version}</small>
        </div>
        <dl className="details">
          {m.fields
            .filter((f) => f.key !== "name")
            .map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{fieldValue(f, record)}</dd>
              </div>
            ))}
        </dl>
        <div className="record-meta">
          Created {new Date(record.createdAt).toLocaleString()}
          <br />
          Last updated {new Date(record.updatedAt).toLocaleString()}
        </div>
        {canEdit && (
          <div className="detail-actions">
            {!record.archived && (
              <button
                onClick={() => setModal({ type: "edit", module: m.id, record })}
              >
                <Icon name="Pencil" size={15} />
                Edit details
              </button>
            )}
            {!record.archived && m.action.from.includes(record.status) && (
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  mutate(
                    `/records/${m.id}/${record.id}/action`,
                    { version: record.version },
                    "POST",
                    m.action.label + " — done",
                  )
                }
              >
                <Icon name="ArrowRight" size={15} />
                {m.action.label}
              </button>
            )}
            {isAdmin &&
              m.id === "payments" &&
              record.status === "Posted" &&
              !record.archived && (
                <button onClick={() => setModal({ type: "reverse", record })}>
                  <Icon name="RotateCcw" size={15} />
                  Reverse payment
                </button>
              )}
            <button
              className="danger-text"
              onClick={() =>
                setModal({
                  type: "confirm",
                  record,
                  operation: record.archived ? "restore" : "archive",
                })
              }
            >
              <Icon
                name={record.archived ? "ArchiveRestore" : "Archive"}
                size={15}
              />
              {record.archived ? "Restore record" : "Archive record"}
            </button>
          </div>
        )}
      </>
    );
  }
  if (modal.type === "confirm") {
    title = `${modal.operation === "archive" ? "Archive" : "Restore"} ${m.singular}?`;
    subtitle = record.name;
    body = (
      <>
        <p className="modal-copy">
          {modal.operation === "archive"
            ? "This moves the record out of the active workspace. Linked active records must be archived first. You can restore it later."
            : "The record will return to the active workspace. Required linked records must be active."}
        </p>
        <div className="modal-actions">
          <button onClick={close}>Cancel</button>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              mutate(`/records/${m.id}/${record.id}/${modal.operation}`, {
                version: record.version,
              })
            }
          >
            {busy
              ? "Saving…"
              : modal.operation === "archive"
                ? "Archive record"
                : "Restore record"}
          </button>
        </div>
      </>
    );
  }
  if (modal.type === "user") {
    title = record ? "Manage account access" : "Create a connected account";
    subtitle =
      "Administrators oversee the company. Agents work on assigned properties. Tenants see their own records.";
    body = (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const profile =
            accountRole === "tenant"
              ? { tenantId: fd.get("tenantId") }
              : accountRole === "agent"
                ? { propertyIds: fd.getAll("propertyIds") }
                : {};
          const payload = record
            ? { role: accountRole, disabled: record.disabled, profile }
            : {
                name: fd.get("name"),
                email: fd.get("email"),
                password: fd.get("password"),
                role: accountRole,
                profile,
              };
          const r = await mutate(
            "/users" + (record ? "/" + record.id : ""),
            payload,
            record ? "PATCH" : "POST",
          );
          if (r) setTeam((await api("/users")).users);
        }}
      >
        <Field label="Full name">
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={record?.name || ""}
            readOnly={!!record}
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            defaultValue={record?.email || ""}
            readOnly={!!record}
          />
        </Field>
        {!record && (
          <Field label="Initial password">
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </Field>
        )}
        <Field label="Role">
          <select
            name="role"
            aria-label="Role"
            value={accountRole}
            onChange={(e) => setAccountRole(e.target.value)}
          >
            <option value="agent">Agent — assigned properties</option>
            <option value="tenant">Tenant — own resident records</option>
            <option value="admin">Administrator — full access</option>
            <option value="viewer">Viewer — read and export</option>
            {accountRole === "manager" && (
              <option value="manager">Manager (existing account)</option>
            )}
          </select>
        </Field>
        {accountRole === "agent" && (
          <>
            <Field label="Assigned properties">
              <select
                name="propertyIds"
                aria-label="Assigned properties"
                multiple
                size={5}
                defaultValue={record?.profile?.propertyIds || []}
              >
                {records
                  .filter((r) => r.module === "properties" && !r.archived)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="form-hint">
              Use Ctrl or Command to select multiple properties. No selection
              means no property access.
            </p>
          </>
        )}
        {accountRole === "tenant" && (
          <>
            <Field label="Linked resident">
              <select
                name="tenantId"
                aria-label="Linked resident"
                required
                defaultValue={record?.profile?.tenantId || ""}
              >
                <option value="">Choose resident…</option>
                {records
                  .filter((r) => r.module === "tenants" && !r.archived)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.email}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="form-hint">
              Create the resident record first. This account will see only that
              resident’s records and requests.
            </p>
          </>
        )}
        <p className="form-hint">
          All roles use the same sign-in page. Share initial credentials
          privately; users can change their password in their dashboard.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {record ? "Save access" : "Create account"}
          </button>
        </div>
      </form>
    );
  }
  if (modal.type === "reverse") {
    title = "Reverse this payment?";
    subtitle =
      "The original payment stays in the ledger. Its invoice balance will be recalculated.";
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutate(
            "/payments/" + record.id + "/reverse",
            {
              version: record.version,
              reason: new FormData(e.target).get("reason"),
            },
            "POST",
            "Payment reversed",
          );
        }}
      >
        <Field label="Reason">
          <textarea
            name="reason"
            required
            minLength={5}
            maxLength={1000}
            rows={3}
          />
        </Field>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Reverse payment
          </button>
        </div>
      </form>
    );
  }
  if (modal.type === "reset") {
    title = "Reset member password";
    subtitle = record.name + " — this signs out all existing sessions.";
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutate("/users/" + record.id + "/reset-password", {
            password: new FormData(e.target).get("password"),
          });
        }}
      >
        <Field label="New password">
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
        </Field>
        <p className="form-hint">
          Share the new password privately with this member. They can change it
          in Settings.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Reset password
          </button>
        </div>
      </form>
    );
  }
  if (modal.type === "access") {
    title = `${record.disabled ? "Enable" : "Disable"} account?`;
    subtitle = record.name;
    body = (
      <>
        <p className="modal-copy">
          {record.disabled
            ? "This member will be able to sign in again."
            : "This member will be signed out and unable to sign in."}
        </p>
        <div className="modal-actions">
          <button onClick={close}>Cancel</button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              const r = await mutate(
                "/users/" + record.id,
                { role: record.role, disabled: !record.disabled },
                "PATCH",
              );
              if (r) setTeam((await api("/users")).users);
            }}
          >
            Confirm
          </button>
        </div>
      </>
    );
  }
  if (modal.type === "demo") {
    title = "Explore what’s possible.";
    subtitle = "Load a fictional sample portfolio";
    body = (
      <>
        <p className="modal-copy">
          This adds sample records across all 20 modules. It is only available
          while the workspace is empty.
        </p>
        <div className="modal-actions">
          <button onClick={close}>Cancel</button>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              mutate(
                "/demo",
                { confirm: "LOAD SAMPLE DATA" },
                "POST",
                "Sample portfolio loaded",
              )
            }
          >
            Load sample data
          </button>
        </div>
      </>
    );
  }
  if (modal.type === "search") {
    title = "Find your next step.";
    subtitle = "Search active records across all modules";
    const results = records
      .filter(
        (r) =>
          !r.archived &&
          [
            r.name,
            r.module,
            ...Object.values(r).filter((v) => typeof v === "string"),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .slice(0, 30);
    body = (
      <>
        <div className="searchbox">
          <Icon name="Search" />
          <input
            aria-label="Search workspace records"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a name, property, or record…"
          />
        </div>
        <div className="search-results">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                go(r.module);
                setModal({ type: "detail", record: r });
              }}
            >
              <Icon name={moduleMap[r.module].icon} />
              <div>
                <b>{r.name}</b>
                <small>{moduleMap[r.module].label}</small>
              </div>
              <Icon name="ArrowUpRight" size={15} />
            </button>
          ))}
          {!results.length && <p>No matching records.</p>}
        </div>
      </>
    );
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const a = [
              ...e.currentTarget.querySelectorAll(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href]",
              ),
            ];
            if (e.shiftKey && document.activeElement === a[0]) {
              e.preventDefault();
              a.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
              e.preventDefault();
              a[0]?.focus();
            }
          }
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="section-eyebrow">ARCLAND WORKSPACE</span>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={close}
          >
            <Icon name="X" />
          </button>
        </div>
        {(error || localError) && (
          <div className="error" role="alert">
            {localError || error}
          </div>
        )}
        {body}
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
