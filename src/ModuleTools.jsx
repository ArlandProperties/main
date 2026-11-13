import React, { useEffect, useRef, useState } from "react";
import {
  Star,
  Plus,
  History,
  MessageSquare,
  Copy,
  SlidersHorizontal,
  Bookmark,
  Check,
  X,
} from "lucide-react";
export const defaultView = {
  field: "",
  match: "",
  from: "",
  to: "",
  numeric: "version",
  min: "",
  max: "",
  bookmarksOnly: false,
};
export function useModulePreferences(api, module, userId) {
  const [value, setValue] = useState({}),
    [ready, setReady] = useState(false);
  const latest = useRef({}),
    queue = useRef(Promise.resolve());
  useEffect(() => {
    latest.current = {};
    setValue({});
    setReady(false);
    if (!module) return;
    let live = true;
    api("/preferences/" + module)
      .then((p) => {
        if (live) {
          latest.current = p;
          setValue(p);
          setReady(true);
        }
      })
      .catch(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [module, userId]);
  async function update(patch) {
    const next = { ...latest.current, ...patch };
    delete next.saveError;
    latest.current = next;
    setValue(next);
    queue.current = queue.current
      .catch(() => {})
      .then(() =>
        api("/preferences/" + module, {
          method: "PUT",
          body: JSON.stringify(next),
        }),
      );
    try {
      await queue.current;
    } catch (e) {
      setValue((v) => ({
        ...v,
        saveError: "Preferences could not be saved: " + e.message,
      }));
    }
    return next;
  }
  return [value, update, ready];
}
export function AdvancedModuleBar({
  m,
  records,
  view,
  setView,
  prefs,
  updatePrefs,
  selected,
  setSelected,
  bulk,
  canEdit,
  onClone,
  selectionRows,
  ready,
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState("");
  const fields = m.fields.filter(
      (f) => !["textarea", "reference", "url"].includes(f.type),
    ),
    numeric = [
      { key: "version", label: "Record version" },
      ...m.fields.filter((f) => ["number", "money"].includes(f.type)),
    ];
  function apply(v) {
    setView({ ...defaultView, ...v });
    setSelected([]);
  }
  return (
    <div className="advanced-module">
      {prefs.saveError && (
        <p className="error" role="alert">
          {prefs.saveError}
        </p>
      )}
      <div className="advanced-top">
        <button onClick={() => setOpen(!open)}>
          <SlidersHorizontal size={14} />
          Advanced tools
        </button>
        <select
          aria-label="Saved views"
          disabled={!ready}
          defaultValue=""
          onChange={(e) => {
            const saved = (prefs.views || []).find(
              (v) => v.name === e.target.value,
            );
            if (saved) apply(saved.view);
            e.target.value = "";
          }}
        >
          <option value="">Saved views</option>
          {(prefs.views || []).map((v) => (
            <option key={v.name}>{v.name}</option>
          ))}
        </select>
        <button
          className={view.bookmarksOnly ? "soft active" : "soft"}
          onClick={() => apply({ ...view, bookmarksOnly: !view.bookmarksOnly })}
        >
          <Star size={13} />
          Bookmarked
        </button>
        <select
          aria-label="Table density"
          disabled={!ready}
          value={prefs.density || "comfortable"}
          onChange={(e) => updatePrefs({ density: e.target.value })}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
        <select
          aria-label="Records per page"
          disabled={!ready}
          value={prefs.pageSize || 12}
          onChange={(e) => updatePrefs({ pageSize: Number(e.target.value) })}
        >
          {[12, 24, 48, 100].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>
      {open && (
        <div className="advanced-fields">
          <label>
            Field filter
            <select
              aria-label="Filter field"
              value={view.field}
              onChange={(e) => apply({ ...view, field: e.target.value })}
            >
              <option value="">Any field</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contains
            <input
              aria-label="Field contains"
              value={view.match}
              onChange={(e) => apply({ ...view, match: e.target.value })}
            />
          </label>
          <label>
            Created from
            <input
              type="date"
              value={view.from}
              onChange={(e) => apply({ ...view, from: e.target.value })}
            />
          </label>
          <label>
            Created through
            <input
              type="date"
              value={view.to}
              onChange={(e) => apply({ ...view, to: e.target.value })}
            />
          </label>
          <label>
            Numeric field
            <select
              value={view.numeric}
              onChange={(e) => apply({ ...view, numeric: e.target.value })}
            >
              {numeric.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minimum
            <input
              type="number"
              value={view.min}
              onChange={(e) => apply({ ...view, min: e.target.value })}
            />
          </label>
          <label>
            Maximum
            <input
              type="number"
              value={view.max}
              onChange={(e) => apply({ ...view, max: e.target.value })}
            />
          </label>
          <div className="view-save">
            <input
              aria-label="New view name"
              maxLength={60}
              value={name}
              placeholder="Name this view"
              onChange={(e) => setName(e.target.value)}
            />
            <button
              disabled={!name.trim() || !ready}
              onClick={() => {
                updatePrefs({
                  views: [
                    ...(prefs.views || []).filter(
                      (v) => v.name !== name.trim(),
                    ),
                    { name: name.trim(), view },
                  ].slice(-20),
                });
                setName("");
              }}
            >
              Save view
            </button>
            <button onClick={() => apply(defaultView)}>Reset filters</button>
          </div>
          <div className="column-choices">
            <b>Visible columns</b>
            {m.fields
              .filter((f) => f.key !== "name" && f.type !== "textarea")
              .map((f) => (
                <label key={f.key}>
                  <input
                    type="checkbox"
                    checked={(
                      prefs.columns ||
                      m.fields
                        .filter(
                          (f) => f.key !== "name" && f.type !== "textarea",
                        )
                        .slice(0, 3)
                        .map((f) => f.key)
                    ).includes(f.key)}
                    onChange={(e) => {
                      const cols =
                        prefs.columns ||
                        m.fields
                          .filter(
                            (f) => f.key !== "name" && f.type !== "textarea",
                          )
                          .slice(0, 3)
                          .map((f) => f.key);
                      updatePrefs({
                        columns: e.target.checked
                          ? [...cols, f.key]
                          : cols.filter((k) => k !== f.key),
                      });
                    }}
                  />
                  {f.label}
                </label>
              ))}
          </div>
        </div>
      )}
      {selected.length > 0 && (
        <div className="bulk-bar">
          <b>{selected.length} selected</b>
          <button onClick={() => setSelected([])}>Clear</button>
          {canEdit && (
            <>
              <button onClick={() => bulk("archive")}>Bulk archive</button>
              <button onClick={() => bulk("restore")}>Bulk restore</button>
              <select
                aria-label="Bulk status"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) bulk("status", e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">Change status…</option>
                {m.statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </>
          )}
          {selected.length === 1 && canEdit && (
            <button
              onClick={() =>
                onClone(selectionRows.find((r) => r.id === selected[0]))
              }
            >
              <Copy size={13} />
              Duplicate selected
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export function RecordCollaboration({ api, record, canEdit }) {
  const [data, setData] = useState(null),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("comments");
  async function load() {
    try {
      setData(await api(`/record-tools/${record.module}/${record.id}`));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [record.id, record.version]);
  return (
    <section className="record-collaboration">
      <div>
        <button onClick={() => setTab("comments")}>
          <MessageSquare size={14} />
          Internal comments
        </button>
        <button onClick={() => setTab("history")}>
          <History size={14} />
          Record history
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {!data ? (
        <p className="form-hint">Loading record tools…</p>
      ) : tab === "comments" ? (
        <>
          {data.comments.length ? (
            data.comments.map((c) => (
              <article key={c.id}>
                <b>{c.author_name}</b>
                <small>{new Date(c.created_at).toLocaleString()}</small>
                <p>{c.body}</p>
              </article>
            ))
          ) : (
            <p className="form-hint">
              No internal comments yet. Comments are visible to company staff;
              they are not shared with tenant accounts.
            </p>
          )}
          {canEdit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api(
                    `/record-tools/${record.module}/${record.id}/comments`,
                    { method: "POST", body: JSON.stringify({ body }) },
                  );
                  setBody("");
                  await load();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <textarea
                aria-label="Internal comment"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                required
                rows={3}
              />
              <button disabled={busy || !body.trim()}>Add comment</button>
            </form>
          )}
        </>
      ) : (
        <>
          {data.history.length ? (
            data.history.map((h) => (
              <article key={h.id}>
                <b>{h.action}</b>
                <small>
                  {h.actor_name} · {new Date(h.created_at).toLocaleString()}
                </small>
                <p>{h.detail}</p>
              </article>
            ))
          ) : (
            <p className="form-hint">No recorded history.</p>
          )}
        </>
      )}
    </section>
  );
}
