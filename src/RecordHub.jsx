import React, { useEffect, useState } from "react";
import {
  Tag,
  Flag,
  CalendarDays,
  ClipboardCheck,
  Check,
  Plus,
  X,
  Link2,
  Bell,
  Pin,
  Download,
  ChevronDown,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
export const emptyHubFilters = {
  tag: "",
  overdue: false,
  review: "",
  hasLinks: false,
  following: false,
  pinned: false,
};
export function useModuleHub(api, module, revision, userId) {
  const [data, setData] = useState({ records: [], followed: [] });
  useEffect(() => {
    setData({ records: [], followed: [] });
    if (!module) return;
    let live = true;
    api("/module-hub/" + module)
      .then((v) => {
        if (live) setData(v);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [module, revision, userId]);
  return data;
}
export function ModuleHubBar({
  api,
  module,
  data,
  filters,
  setFilters,
  canEdit,
  onRefresh,
}) {
  const [rename, setRename] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const tags = {};
  for (const r of data.records)
    for (const tag of r.tags || []) tags[tag] = (tags[tag] || 0) + 1;
  return (
    <div className="module-hub-bar">
      <div className="hub-filter-line">
        <Tag size={15} />
        <select
          aria-label="Filter record tags"
          value={filters.tag}
          onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
        >
          <option value="">All tags</option>
          {Object.entries(tags)
            .sort()
            .map(([tag, n]) => (
              <option key={tag} value={tag}>
                {tag} ({n})
              </option>
            ))}
        </select>
        <select
          aria-label="Filter review state"
          value={filters.review}
          onChange={(e) => setFilters({ ...filters, review: e.target.value })}
        >
          <option value="">Any review state</option>
          {["Not requested", "Pending", "Approved", "Changes requested"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
        {[
          ["overdue", "Overdue", CalendarDays],
          ["hasLinks", "Linked", Link2],
          ["following", "Following", Bell],
          ["pinned", "Pinned", Pin],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            className={filters[key] ? "active" : ""}
            aria-pressed={filters[key]}
            onClick={() => setFilters({ ...filters, [key]: !filters[key] })}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
        {canEdit && (
          <button onClick={() => setRename(!rename)}>Rename tag</button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rename && (
        <form
          className="tag-rename"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/module-hub/" + module + "/rename-tag", {
                method: "POST",
                body: JSON.stringify(
                  Object.fromEntries(new FormData(e.target)),
                ),
              });
              setRename(false);
              onRefresh();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <select name="from" required aria-label="Tag to rename">
            <option value="">Select tag…</option>
            {Object.keys(tags).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            name="to"
            required
            maxLength={30}
            aria-label="New tag name"
            placeholder="New tag name"
          />
          <button disabled={busy}>Rename across this module</button>
        </form>
      )}
    </div>
  );
}
export function RecordHub({
  api,
  record,
  records,
  modules,
  canEdit,
  onRefresh,
  onOpenRecord,
}) {
  const [open, setOpen] = useState(false),
    [hub, setHub] = useState(null),
    [users, setUsers] = useState([]),
    [tab, setTab] = useState("organize"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editItem, setEditItem] = useState(null);
  const base = `/record-hub/${record.module}/${record.id}`;
  async function load() {
    try {
      setHub(await api(base));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (open) {
      load();
      api("/hub/assignees")
        .then((d) => setUsers(d.users))
        .catch(() => {});
    }
  }, [record.id, open]);
  async function change(operation, fields = {}) {
    const previous = hub;
    if (operation === "completeChecklist")
      setHub((h) => ({
        ...h,
        data: {
          ...h.data,
          checklist: h.data.checklist.map((item) =>
            item.id === fields.itemId ? { ...item, done: fields.done } : item,
          ),
        },
      }));
    setBusy(true);
    setError("");
    try {
      await api(base, {
        method: "POST",
        body: JSON.stringify({ operation, version: hub.version, ...fields }),
      });
      await load();
      onRefresh();
      return true;
    } catch (e) {
      setHub(previous);
      setError(e.message);
      if (e.status === 409) await load();
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function follow() {
    setBusy(true);
    setError("");
    try {
      await api(base + "/follow", {
        method: hub.following ? "DELETE" : "POST",
        body: "{}",
      });
      await load();
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function brief() {
    const m = modules.find((m) => m.id === record.module);
    const get = (id) => records.find((r) => r.id === id)?.name || id;
    const rows = [
      record.name,
      `${m?.label || record.module} · ${record.status}`,
      "Internal company record brief",
      ...m.fields.map(
        (f) =>
          `${f.label}: ${f.type === "reference" ? get(record[f.key]) : (record[f.key] ?? "")}`,
      ),
      "",
      "TAGS: " + hub.data.tags.join(", "),
      "FOLLOW-UP: " +
        (hub.data.followUp.date || "Not scheduled") +
        " · " +
        hub.data.followUp.priority,
      "OWNER: " +
        (users.find((u) => u.id === hub.data.followUp.assigneeId)?.name ||
          "Unassigned"),
      "REVIEW: " + hub.data.review.status,
      hub.data.review.reason,
      "",
      "CHECKLIST",
      ...hub.data.checklist.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`),
      "",
      "RELATED RECORDS",
      ...hub.related.map((r) => r.name),
      "",
      "COMPLETENESS: " +
        (hub.health.complete
          ? "Required fields complete"
          : hub.health.missing.join(", ")),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "arcland-record-brief.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="record-hub">
      <button
        className="record-hub-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          <ClipboardCheck size={17} />
          Record workspace
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <>
          <p className="form-hint">
            Organize internal work, reviews, checklists, and follow-ups for this
            record.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!hub ? (
            <p>Loading workspace…</p>
          ) : (
            <>
              <div className="hub-tabs">
                {[
                  ["organize", "Organize"],
                  ["review", "Review"],
                  ["checklist", "Checklist"],
                  ["links", "Related"],
                  ["health", "Completeness"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={tab === key ? "active" : ""}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "organize" && (
                <>
                  <div className="record-tags">
                    {hub.data.tags.map((t) => (
                      <span key={t}>
                        {t}
                        {canEdit && (
                          <button
                            aria-label={"Remove tag " + t}
                            disabled={busy}
                            onClick={() => change("removeTag", { tag: t })}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </span>
                    ))}
                    {!hub.data.tags.length && <small>No tags yet.</small>}
                  </div>
                  {canEdit && (
                    <form
                      className="hub-inline"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const text = e.target.tag.value;
                        if (await change("addTag", { tag: text }))
                          e.target.reset();
                      }}
                    >
                      <input
                        name="tag"
                        maxLength={30}
                        required
                        aria-label="New record tag"
                        placeholder="Add a tag"
                      />
                      <button disabled={busy}>
                        <Plus size={13} />
                        Add tag
                      </button>
                    </form>
                  )}
                  <div className="hub-followup">
                    <h3>Follow-up</h3>
                    {canEdit ? (
                      <>
                        <form
                          className="hub-inline"
                          onSubmit={(e) => {
                            e.preventDefault();
                            change("followUpDate", {
                              date: e.target.date.value,
                            });
                          }}
                        >
                          <input
                            name="date"
                            type="date"
                            required
                            defaultValue={hub.data.followUp.date}
                            key={hub.data.followUp.date}
                            aria-label="Follow-up date"
                          />
                          <button disabled={busy}>Set date</button>
                          <button
                            type="button"
                            disabled={busy || !hub.data.followUp.date}
                            onClick={() => change("clearFollowUp")}
                          >
                            Clear date
                          </button>
                        </form>
                        <div className="hub-inline">
                          <label>
                            Priority
                            <select
                              aria-label="Follow-up priority"
                              value={hub.data.followUp.priority}
                              disabled={busy}
                              onChange={(e) =>
                                change("followUpPriority", {
                                  priority: e.target.value,
                                })
                              }
                            >
                              {["Low", "Normal", "High", "Urgent"].map((p) => (
                                <option key={p}>{p}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Assigned owner
                            <select
                              aria-label="Follow-up owner"
                              value={hub.data.followUp.assigneeId}
                              disabled={busy}
                              onChange={(e) =>
                                change("assignFollowUp", {
                                  assigneeId: e.target.value,
                                })
                              }
                            >
                              <option value="">Unassigned</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </>
                    ) : (
                      <p>
                        {hub.data.followUp.date || "No date"} ·{" "}
                        {hub.data.followUp.priority}
                      </p>
                    )}
                  </div>
                  <div className="hub-inline hub-bottom">
                    <button disabled={busy} onClick={follow}>
                      <Bell size={13} />
                      {hub.following ? "Unfollow record" : "Follow record"}
                    </button>
                    {canEdit && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          change(hub.data.pinned ? "unpin" : "pin")
                        }
                      >
                        <Pin size={13} />
                        {hub.data.pinned ? "Unpin record" : "Pin for staff"}
                      </button>
                    )}
                  </div>
                </>
              )}
              {tab === "review" && (
                <>
                  <div className="hub-review-state">
                    <span className="pill">{hub.data.review.status}</span>
                    {hub.data.review.by && (
                      <small>
                        {hub.data.review.by} ·{" "}
                        {new Date(hub.data.review.at).toLocaleString()}
                      </small>
                    )}
                  </div>
                  {canEdit && (
                    <div className="hub-inline">
                      <button
                        disabled={busy}
                        onClick={() => change("requestReview")}
                      >
                        Request review
                      </button>
                      <button
                        disabled={
                          busy ||
                          !["Pending", "Changes requested"].includes(
                            hub.data.review.status,
                          )
                        }
                        onClick={() => change("approveReview")}
                      >
                        Approve review
                      </button>
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      change("reviewReason", { reason: e.target.reason.value });
                    }}
                  >
                    <label className="field">
                      <span>Review notes / change reason</span>
                      <textarea
                        name="reason"
                        aria-label="Review reason"
                        readOnly={!canEdit}
                        rows={3}
                        maxLength={2000}
                        defaultValue={hub.data.review.reason}
                        key={hub.data.review.reason}
                      />
                    </label>
                    {canEdit && (
                      <div className="hub-inline">
                        <button disabled={busy}>Save review notes</button>
                        <button
                          type="button"
                          disabled={
                            busy ||
                            !["Pending", "Approved"].includes(
                              hub.data.review.status,
                            )
                          }
                          onClick={(e) =>
                            change("requestChanges", {
                              reason: e.currentTarget.form.reason.value,
                            })
                          }
                        >
                          Request changes
                        </button>
                      </div>
                    )}
                  </form>
                </>
              )}
              {tab === "checklist" && (
                <>
                  <div className="hub-check-progress">
                    <b>
                      {hub.health.checklistDone} of {hub.health.checklistTotal}{" "}
                      complete
                    </b>
                    <div className="progress">
                      <i
                        style={{
                          width:
                            (hub.health.checklistTotal
                              ? (100 * hub.health.checklistDone) /
                                hub.health.checklistTotal
                              : 0) + "%",
                        }}
                      />
                    </div>
                  </div>
                  <div className="hub-checklist">
                    {hub.data.checklist.map((i) => (
                      <div key={i.id}>
                        <input
                          aria-label={"Complete " + i.text}
                          type="checkbox"
                          checked={i.done}
                          disabled={!canEdit || busy}
                          onChange={(e) =>
                            change("completeChecklist", {
                              itemId: i.id,
                              done: e.target.checked,
                            })
                          }
                        />
                        {editItem === i.id ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (
                                await change("editChecklist", {
                                  itemId: i.id,
                                  text: e.target.text.value,
                                })
                              )
                                setEditItem(null);
                            }}
                          >
                            <input
                              name="text"
                              defaultValue={i.text}
                              required
                              maxLength={250}
                              aria-label="Edit checklist text"
                            />
                            <button disabled={busy}>Save item</button>
                          </form>
                        ) : (
                          <span className={i.done ? "done" : ""}>{i.text}</span>
                        )}
                        {canEdit && (
                          <>
                            <button
                              className="link"
                              onClick={() =>
                                setEditItem(editItem === i.id ? null : i.id)
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="link"
                              aria-label={"Remove checklist " + i.text}
                              disabled={busy}
                              onClick={() =>
                                change("removeChecklist", { itemId: i.id })
                              }
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {canEdit && (
                    <form
                      className="hub-inline"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await change("addChecklist", {
                            text: e.target.text.value,
                          })
                        )
                          e.target.reset();
                      }}
                    >
                      <input
                        name="text"
                        required
                        maxLength={250}
                        aria-label="New checklist item"
                        placeholder="Add the next step"
                      />
                      <button disabled={busy}>Add checklist item</button>
                    </form>
                  )}
                </>
              )}
              {tab === "links" && (
                <>
                  <h3>Related records</h3>
                  <div className="hub-links">
                    {hub.related.map((r) => (
                      <div key={r.id}>
                        <button
                          className="link"
                          onClick={() => onOpenRecord(r.id)}
                        >
                          {r.name}
                          <ArrowUpRight size={12} />
                        </button>
                        {canEdit && (
                          <button
                            className="link"
                            aria-label={"Unlink " + r.name}
                            disabled={busy}
                            onClick={() =>
                              change("removeLink", { targetId: r.id })
                            }
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canEdit && (
                    <form
                      className="hub-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        change("addLink", {
                          targetId: e.target.targetId.value,
                        });
                      }}
                    >
                      <select
                        name="targetId"
                        required
                        aria-label="Related record"
                      >
                        <option value="">Choose a related record…</option>
                        {records
                          .filter(
                            (r) =>
                              !r.archived &&
                              r.id !== record.id &&
                              !hub.data.links.includes(r.id),
                          )
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.module} · {r.name}
                            </option>
                          ))}
                      </select>
                      <button disabled={busy}>Link record</button>
                    </form>
                  )}
                  <h3 className="inbound-title">Linked from</h3>
                  {hub.inbound.length ? (
                    hub.inbound.map((r) => (
                      <button
                        className="link inbound-link"
                        key={r.id}
                        onClick={() => onOpenRecord(r.id)}
                      >
                        {r.name}
                        <ArrowUpRight size={13} />
                      </button>
                    ))
                  ) : (
                    <p className="form-hint">No inbound links.</p>
                  )}
                </>
              )}
              {tab === "health" && (
                <div className="hub-health">
                  <span className={hub.health.complete ? "pill" : "pill amber"}>
                    {hub.health.complete
                      ? "Required fields complete"
                      : "Missing required information"}
                  </span>
                  {hub.health.missing.map((t) => (
                    <p key={t}>Missing: {t}</p>
                  ))}
                  <p>
                    {hub.health.checklistDone}/{hub.health.checklistTotal}{" "}
                    checklist steps complete
                  </p>
                  <p>
                    Follow-up:{" "}
                    {hub.health.overdue
                      ? "Overdue"
                      : hub.data.followUp.date || "Not scheduled"}
                  </p>
                  <p>
                    {hub.health.unavailableLinks} unavailable or archived
                    related links
                  </p>
                  <p className="form-hint">
                    This checks record completeness, not property safety,
                    compliance, or financial accuracy.
                  </p>
                </div>
              )}
              <button className="hub-export" onClick={brief}>
                <Download size={14} />
                Download internal brief
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
export function FollowedUpdates({ api, onOpenRecord }) {
  const [updates, setUpdates] = useState(null),
    [error, setError] = useState("");
  const load = () =>
    api("/hub/updates")
      .then((d) => setUpdates(d.updates))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="followed-updates">
      <p className="form-hint">
        Updates to records you follow. These are in-app updates; no emails are
        sent.
      </p>
      {error && <p className="error">{error}</p>}
      {updates === null ? (
        <p>Loading…</p>
      ) : updates.length ? (
        <>
          <button
            onClick={async () => {
              try {
                await api("/hub/updates/read", {
                  method: "POST",
                  body: JSON.stringify({ ids: updates.map((r) => r.id) }),
                });
                load();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Mark all updates read
          </button>
          {updates.map((r) => (
            <article key={r.id}>
              <div>
                <b>{r.name}</b>
                <small>
                  {r.module} · {new Date(r.changedAt).toLocaleString()}
                </small>
              </div>
              <button
                className="link"
                onClick={async () => {
                  try {
                    await api("/hub/updates/read", {
                      method: "POST",
                      body: JSON.stringify({ ids: [r.id] }),
                    });
                    onOpenRecord(r.id);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Open record
                <ArrowUpRight size={13} />
              </button>
            </article>
          ))}
        </>
      ) : (
        <div className="portal-empty">
          <Check size={28} />
          <h3>You’re all caught up.</h3>
          <p>Follow records from their workspace to see future changes here.</p>
        </div>
      )}
    </div>
  );
}
