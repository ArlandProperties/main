import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Heart,
  Home,
  Sun,
  Briefcase,
  Check,
  Plus,
  Minus,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Wallet,
} from "lucide-react";
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};
export function HeroExperience() {
  const [open, setOpen] = useState(false),
    [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    function key(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", key);
    document.querySelector(".photo-viewer button:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [open]);
  return (
    <div className="hero-experience">
      <div className="hero-photo-frame">
        <button
          aria-label="View clear property photo"
          onClick={() => {
            setOpen(true);
            setZoom(1);
          }}
        >
          <img
            src="/home-hero-clear.webp"
            alt="Bright contemporary limestone home with navy window frames and a welcoming front entrance"
            fetchPriority="high"
          />
          <span className="photo-open">
            <Search size={15} />
            Take a closer look
          </span>
        </button>
        <span className="hero-photo-label">
          <Sparkles size={13} />A fresh perspective.
        </span>
      </div>
      <div className="hero-photo-caption">
        <span>
          <Home size={19} />
        </span>
        <div>
          <b>A place with possibility.</b>
          <small>Illustrative architecture · The Arcland approach</small>
        </div>
        <span className="photo-caption-dot" />
      </div>
      {open && (
        <div
          className="photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Property photo viewer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              const a = [
                ...e.currentTarget.querySelectorAll("button:not(:disabled)"),
              ];
              if (e.shiftKey && document.activeElement === a[0]) {
                e.preventDefault();
                a.at(-1).focus();
              } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
                e.preventDefault();
                a[0].focus();
              }
            }
          }}
        >
          <div className="photo-viewer-toolbar">
            <span>Explore the details</span>
            <div>
              <button
                aria-label="Zoom out"
                disabled={zoom <= 1}
                onClick={() => setZoom(Math.max(1, zoom - 0.25))}
              >
                <Minus size={18} />
              </button>
              <b>{Math.round(zoom * 100)}%</b>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 2}
                onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              >
                <Plus size={18} />
              </button>
              <button
                aria-label="Close photo viewer"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="photo-viewer-image">
            <img
              src="/home-hero-clear.webp"
              alt="Detailed view of the home's bright architectural facade"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
export function HomePlayground({ api, onApply }) {
  const [step, setStep] = useState(0),
    [answers, setAnswers] = useState({
      space: "2",
      budget: 2400,
      vibe: "Calm & cozy",
    }),
    [rentals, setRentals] = useState([]),
    [costs, setCosts] = useState({
      rent: 2000,
      utilities: 150,
      internet: 70,
      insurance: 30,
      moving: 400,
      furnishing: 500,
    }),
    [done, setDone] = useState(() => read("arcland-moving-checklist", []));
  useEffect(() => {
    api("/public/rentals")
      .then((d) => setRentals(d.rentals))
      .catch(() => {});
  }, []);
  const tasks = [
    "Choose your target move date",
    "Review the lease details",
    "Plan utilities and internet",
    "Measure your furniture",
    "Arrange your moving day",
    "Confirm your key collection",
  ];
  const monthly =
      Number(costs.rent) +
      Number(costs.utilities) +
      Number(costs.internet) +
      Number(costs.insurance),
    oneTime = Number(costs.moving) + Number(costs.furnishing);
  const matches = rentals.filter(
    (r) => r.bedrooms >= Number(answers.space) && r.rent <= answers.budget,
  );
  const money = (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <>
      <section className="home-section home-personality" id="home-vibe">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">
              <Sparkles size={13} />A LITTLE DISCOVERY
            </span>
            <h2>
              What feels
              <br />
              <em>like you?</em>
            </h2>
          </div>
          <p>
            Three quick choices. A little inspiration for your next home. This
            is a preference guide, not an eligibility or approval decision.
          </p>
        </div>
        <div className="vibe-card">
          <div className="vibe-art">
            <span className="vibe-orbit orbit-one" />
            <span className="vibe-orbit orbit-two" />
            <div className="vibe-house">
              <Home size={85} strokeWidth={0.9} />
              <Sparkles size={25} />
            </div>
            <span className="vibe-art-label">
              A HOME THAT FITS YOUR RHYTHM.
            </span>
          </div>
          <div className="vibe-content">
            <div className="vibe-progress">
              {[0, 1, 2].map((n) => (
                <span key={n} className={step >= n ? "done" : ""} />
              ))}
            </div>
            {step < 3 ? (
              <>
                <small>YOUR HOME PREFERENCES · {step + 1} OF 3</small>
                <h3>
                  {
                    [
                      "How much room feels right?",
                      "What monthly rent fits your plan?",
                      "What’s your home vibe?",
                    ][step]
                  }
                </h3>
                {step === 0 ? (
                  <div className="vibe-options">
                    {[
                      ["0", "A smart studio"],
                      ["1", "One bedroom"],
                      ["2", "Two bedrooms"],
                      ["3", "Room to spread out"],
                    ].map(([v, t]) => (
                      <button
                        key={v}
                        className={answers.space === v ? "selected" : ""}
                        aria-pressed={answers.space === v}
                        onClick={() => setAnswers({ ...answers, space: v })}
                      >
                        <Home size={18} />
                        {t}
                        {answers.space === v && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                ) : step === 1 ? (
                  <div className="vibe-budget">
                    <strong>
                      {money(answers.budget)}
                      <small>/month</small>
                    </strong>
                    <input
                      type="range"
                      aria-label="Preferred monthly rent"
                      min={700}
                      max={6000}
                      step={50}
                      value={answers.budget}
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          budget: Number(e.target.value),
                        })
                      }
                    />
                    <div>
                      <span>$700</span>
                      <span>$6,000</span>
                    </div>
                  </div>
                ) : (
                  <div className="vibe-options">
                    {[
                      [Sun, "Calm & cozy"],
                      [Briefcase, "Work & unwind"],
                      [Sparkles, "A little city energy"],
                    ].map(([Icon, t]) => (
                      <button
                        key={t}
                        className={answers.vibe === t ? "selected" : ""}
                        aria-pressed={answers.vibe === t}
                        onClick={() => setAnswers({ ...answers, vibe: t })}
                      >
                        <Icon size={18} />
                        {t}
                        {answers.vibe === t && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                )}
                <div className="vibe-actions">
                  {step > 0 ? (
                    <button onClick={() => setStep(step - 1)}>
                      <ChevronLeft size={15} />
                      Back
                    </button>
                  ) : (
                    <span />
                  )}
                  <button className="primary" onClick={() => setStep(step + 1)}>
                    {step === 2 ? "Find my vibe" : "Next"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : (
              <div className="vibe-result">
                <span>
                  <Sparkles size={30} />
                </span>
                <small>YOUR NEXT CHAPTER</small>
                <h3>{answers.vibe}</h3>
                <p>
                  {answers.space === "0"
                    ? "A thoughtfully arranged studio"
                    : answers.space + "+ bedrooms"}{" "}
                  · Up to {money(answers.budget)} monthly rent.
                </p>
                <p>
                  {matches.length
                    ? `${matches.length} published rental${matches.length === 1 ? "" : "s"} match your space and budget preferences.`
                    : "No published rentals match these preferences right now. You can still share your preferences in a general application."}
                </p>
                <button
                  className="primary"
                  onClick={() => onApply(matches[0]?.id)}
                >
                  Start exploring
                  <ArrowUpRight size={15} />
                </button>
                <button className="link" onClick={() => setStep(0)}>
                  Try another vibe
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="home-section moving-tools" id="moving-tools">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">
              SMALL PLANS. BIG POSSIBILITIES.
            </span>
            <h2>
              Make your move
              <br />
              <em>feel lighter.</em>
            </h2>
          </div>
          <p>
            A couple of useful tools for the journey. Your estimates stay in
            your browser and are not part of a rental application.
          </p>
        </div>
        <div className="moving-tool-grid">
          <article className="move-cost-card">
            <div className="tool-heading">
              <span>
                <Wallet size={21} />
              </span>
              <div>
                <h3>Your moving-cost planner</h3>
                <p>Adjust the numbers to fit your plans. All amounts CAD.</p>
              </div>
            </div>
            <div className="cost-fields">
              {[
                ["rent", "Monthly rent"],
                ["utilities", "Utilities / month"],
                ["internet", "Internet / month"],
                ["insurance", "Insurance / month"],
                ["moving", "One-time moving"],
                ["furnishing", "One-time furnishing"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <div>
                    <span>$</span>
                    <input
                      aria-label={label}
                      type="number"
                      min={0}
                      max={100000}
                      step={10}
                      value={costs[key]}
                      onChange={(e) =>
                        setCosts({
                          ...costs,
                          [key]: Math.max(
                            0,
                            Math.min(100000, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </div>
                </label>
              ))}
            </div>
            <div className="cost-results">
              <div>
                <small>MONTHLY ESTIMATE</small>
                <b>{money(monthly)}</b>
              </div>
              <div>
                <small>ONE-TIME ESTIMATE</small>
                <b>{money(oneTime)}</b>
              </div>
            </div>
            <p className="tool-note">
              Planning estimates only. Actual charges, deposits, and lease terms
              are confirmed separately.
            </p>
          </article>
          <article className="move-check-card">
            <div className="tool-heading">
              <span>
                <ClipboardCheck size={22} />
              </span>
              <div>
                <h3>Your move, one step at a time</h3>
                <p>A little progress looks good on you.</p>
              </div>
            </div>
            <div className="move-check-progress">
              <span>
                {done.length} of {tasks.length} ready
              </span>
              <strong>{Math.round((done.length / tasks.length) * 100)}%</strong>
              <div>
                <i
                  style={{ width: (100 * done.length) / tasks.length + "%" }}
                />
              </div>
            </div>
            <div className="moving-checklist">
              {tasks.map((task, i) => (
                <label key={task} className={done.includes(i) ? "done" : ""}>
                  <input
                    type="checkbox"
                    checked={done.includes(i)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...done, i]
                        : done.filter((v) => v !== i);
                      setDone(next);
                      try {
                        localStorage.setItem(
                          "arcland-moving-checklist",
                          JSON.stringify(next),
                        );
                      } catch {}
                    }}
                  />
                  <span>{task}</span>
                  <Check size={16} />
                </label>
              ))}
            </div>
            {done.length === tasks.length ? (
              <p className="check-celebration">
                <Sparkles size={18} />
                Look at you, making moves!
              </p>
            ) : (
              <p className="tool-note">
                This checklist is saved on this browser. Tick things off at your
                own pace.
              </p>
            )}
            <button
              className="link"
              onClick={() => {
                setDone([]);
                try {
                  localStorage.removeItem("arcland-moving-checklist");
                } catch {}
              }}
            >
              Reset my checklist
            </button>
          </article>
        </div>
      </section>
    </>
  );
}
export function RentalCompare({ rentals, currency = "CAD", onApply }) {
  const [favorites, setFavorites] = useState(() =>
      read("arcland-rental-favorites", []),
    ),
    [selected, setSelected] = useState([]),
    [open, setOpen] = useState(false),
    [only, setOnly] = useState(false);
  const fav = rentals.filter((r) => favorites.includes(r.id)),
    compared = rentals.filter((r) => selected.includes(r.id));
  const money = (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    document.querySelector(".rental-comparison button")?.focus();
    return () => before?.focus();
  }, [open]);
  useEffect(() => {
    function esc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  return (
    <div className="rental-shortlist">
      <div className="shortlist-heading">
        <div>
          <Heart size={17} />
          <b>Make a little shortlist.</b>
          <span>
            Save favourites and compare up to three published rentals.
          </span>
        </div>
        <button aria-pressed={only} onClick={() => setOnly(!only)}>
          {only ? "Show all" : "My favourites"} ({fav.length})
        </button>
      </div>
      {rentals.length ? (
        <div className="shortlist-cards">
          {(only ? fav : rentals).map((r) => (
            <article key={r.id}>
              <div>
                <h3>{r.name}</h3>
                <p>
                  {r.city || r.property} · {money(r.rent)}/mo
                </p>
              </div>
              <button
                className={
                  favorites.includes(r.id) ? "favorite active" : "favorite"
                }
                aria-label={"Save rental " + r.name}
                aria-pressed={favorites.includes(r.id)}
                onClick={() => {
                  const next = favorites.includes(r.id)
                    ? favorites.filter((id) => id !== r.id)
                    : [...favorites, r.id];
                  setFavorites(next);
                  try {
                    localStorage.setItem(
                      "arcland-rental-favorites",
                      JSON.stringify(next),
                    );
                  } catch {}
                }}
              >
                <Heart
                  size={17}
                  fill={favorites.includes(r.id) ? "currentColor" : "none"}
                />
              </button>
              <label>
                <input
                  type="checkbox"
                  aria-label={"Compare " + r.name}
                  checked={selected.includes(r.id)}
                  disabled={!selected.includes(r.id) && selected.length >= 3}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, r.id]
                        : selected.filter((id) => id !== r.id),
                    )
                  }
                />
                Compare
              </label>
            </article>
          ))}
        </div>
      ) : (
        <p className="tool-note">
          Shortlisting becomes available as rentals are published. Your
          favourites stay on this browser.
        </p>
      )}
      {selected.length > 0 && (
        <div className="compare-launch">
          <span>{selected.length} selected</span>
          <button className="primary" onClick={() => setOpen(true)}>
            Compare my picks
            <ArrowRight size={15} />
          </button>
          <button className="link" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}
      {open && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            className="rental-comparison"
            role="dialog"
            aria-modal="true"
            aria-label="Compare rental shortlist"
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const a = [
                  ...e.currentTarget.querySelectorAll("button:not(:disabled)"),
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
                <span className="home-eyebrow">
                  YOUR POSSIBILITIES, SIDE BY SIDE
                </span>
                <h2>A little perspective.</h2>
              </div>
              <button
                aria-label="Close rental comparison"
                onClick={() => setOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="comparison-grid">
              {compared.map((r) => (
                <article key={r.id}>
                  <Home size={25} />
                  <h3>{r.name}</h3>
                  <p>{r.city || r.property}</p>
                  <strong>
                    {money(r.rent)}
                    <small>/month</small>
                  </strong>
                  <dl>
                    <div>
                      <dt>Bedrooms</dt>
                      <dd>{r.bedrooms || "Studio"}</dd>
                    </div>
                    <div>
                      <dt>Bathrooms</dt>
                      <dd>{r.bathrooms}</dd>
                    </div>
                    <div>
                      <dt>Area</dt>
                      <dd>{r.area ? r.area + " sq ft" : "Ask our team"}</dd>
                    </div>
                  </dl>
                  <button className="primary" onClick={() => onApply(r.id)}>
                    Apply for this rental
                    <ArrowUpRight size={14} />
                  </button>
                </article>
              ))}
            </div>
            <p className="tool-note">
              Published details are subject to confirmation by the leasing team.
              No unit is reserved by comparing or saving it.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
