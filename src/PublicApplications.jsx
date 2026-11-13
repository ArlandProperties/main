import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  MapPin,
  Check,
  ClipboardList,
  ShieldCheck,
  KeyRound,
  Search,
  ChevronRight,
} from "lucide-react";
export function PublicHeader({
  Logo,
  user,
  onSignIn,
  onDashboard,
  onApply,
  active,
}) {
  return (
    <nav className="home-nav">
      <a href="/" aria-label="Arcland homepage">
        <Logo />
      </a>
      <div className="home-nav-links">
        <a href="/#services">Our services</a>
        <a href="/#rentals">Available rentals</a>
        <a href="/#faq">FAQs</a>
        <button
          className={active === "applications" ? "public-nav-active" : ""}
          onClick={() => onApply()}
        >
          Applications
        </button>
      </div>
      <button className="primary" onClick={user ? onDashboard : onSignIn}>
        {user ? "My dashboard" : "Sign in"}
        <ArrowUpRight size={16} />
      </button>
    </nav>
  );
}
export function AvailableRentals({ api, onApply }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [bedrooms, setBedrooms] = useState("all");
  useEffect(() => {
    api("/public/rentals")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const rentals = (data?.rentals || []).filter(
    (r) =>
      (r.name + " " + r.city + " " + r.property)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (bedrooms === "all" ||
        (bedrooms === "3+"
          ? r.bedrooms >= 3
          : Number(bedrooms) === r.bedrooms)),
  );
  const money = (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: data?.currency || "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <section className="home-section" id="rentals">
      <div className="home-section-head">
        <div>
          <span className="home-eyebrow">FIND YOUR NEXT CHAPTER</span>
          <h2>A place to call your own.</h2>
        </div>
        <p>
          Explore published rental availability, or start a general application
          and tell our leasing team what you’re looking for.
        </p>
      </div>
      <div className="rental-filters">
        <label>
          <Search size={16} />
          <input
            aria-label="Search available rentals"
            placeholder="Search by property or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter rental bedrooms"
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value)}
        >
          <option value="all">Any bedrooms</option>
          <option value="0">Studio</option>
          <option value="1">1 bedroom</option>
          <option value="2">2 bedrooms</option>
          <option value="3+">3+ bedrooms</option>
        </select>
      </div>
      {error ? (
        <p className="public-message">
          We couldn’t load availability. You can still start a general
          application below.
        </p>
      ) : !data ? (
        <p className="public-message">Checking availability…</p>
      ) : rentals.length ? (
        <div className="public-rentals">
          {rentals.map((r) => (
            <article key={r.id}>
              <div className="rental-visual">
                <Building2 size={55} strokeWidth={0.8} />
                <span>AVAILABLE TO APPLY</span>
              </div>
              <div className="rental-body">
                <p>{r.type}</p>
                <h3>{r.name}</h3>
                <small>
                  <MapPin size={12} />
                  {[r.city, r.region].filter(Boolean).join(", ") || r.property}
                </small>
                <div className="rental-facts">
                  <span>
                    {r.bedrooms === 0 ? "Studio" : r.bedrooms + " beds"}
                  </span>
                  <span>{r.bathrooms} baths</span>
                  {r.area > 0 && <span>{r.area} sq ft</span>}
                </div>
                <div className="rental-bottom">
                  <b>
                    {money(r.rent)}
                    <small>/ month</small>
                  </b>
                  <button onClick={() => onApply(r.id)}>
                    Apply
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rental-empty">
          <Building2 size={32} />
          <h3>
            {query || bedrooms !== "all"
              ? "No rentals match these filters."
              : "Your next home could be on the horizon."}
          </h3>
          <p>
            {query || bedrooms !== "all"
              ? "Try another search or start a general application."
              : "There are no published rentals at the moment. Submit a general application to share your preferences with our team."}
          </p>
          <button className="primary" onClick={() => onApply()}>
            Start a general application
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
export default function PublicApplications({
  Logo,
  user,
  api,
  onHome,
  onSignIn,
  onDashboard,
  onApply,
}) {
  const [rentals, setRentals] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null);
  useEffect(() => {
    api("/public/rentals")
      .then((d) => setRentals(d.rentals))
      .catch(() => {});
  }, []);
  const initialUnit =
    new URLSearchParams(window.location.search).get("unit") || "";
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="public-home">
      <PublicHeader
        {...{ Logo, user, onSignIn, onDashboard, onApply }}
        active="applications"
      />
      <div className="application-intro">
        <span className="home-eyebrow">PROSPECTIVE TENANTS</span>
        <h1>
          Your next chapter
          <br />
          <em>starts here.</em>
        </h1>
        <p>
          Tell us a little about yourself and the home you’re looking for. Our
          leasing team will review your application and contact you about next
          steps.
        </p>
      </div>
      <div className="application-layout">
        <aside className="application-guide">
          <div>
            <ClipboardList size={24} />
            <h2>A thoughtful first step.</h2>
            <p>
              This preliminary application starts a conversation. It does not
              create a lease or reserve a unit.
            </p>
          </div>
          <ol>
            {[
              [
                "Share your details",
                "Let us know how to reach you and when you’d like to move.",
              ],
              [
                "Leasing team review",
                "Your application is reviewed against current availability.",
              ],
              [
                "Connect & explore",
                "Our team will contact you about a viewing or additional steps.",
              ],
            ].map(([h, p], i) => (
              <li key={h}>
                <span>{i + 1}</span>
                <div>
                  <b>{h}</b>
                  <p>{p}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="application-privacy">
            <ShieldCheck size={21} />
            <h3>Your information, considered.</h3>
            <p>
              Only your contact details and rental preferences are requested
              here. Please don’t include identification numbers, financial
              documents, or banking details.
            </p>
          </div>
          <button className="link" onClick={onSignIn}>
            Already a tenant? Sign in <ArrowUpRight size={14} />
          </button>
        </aside>
        <section className="application-form-card">
          {result ? (
            <div className="application-success" role="status">
              <span>
                <Check size={32} />
              </span>
              <h2>We’ve received your application.</h2>
              <p>Keep this reference for your records:</p>
              <strong>{result.reference}</strong>
              <p>
                Our leasing team will review your details and contact you using
                the information you provided. No email confirmation is sent
                automatically.
              </p>
              <button className="primary" onClick={onHome}>
                Return to homepage
                <ArrowRight size={16} />
              </button>
              <button className="link" onClick={() => window.print()}>
                Print confirmation
              </button>
            </div>
          ) : (
            <>
              <div className="application-form-heading">
                <span className="home-eyebrow">RENTAL APPLICATION</span>
                <h2>Make an introduction.</h2>
                <p>Fields marked * are required. No account is needed.</p>
              </div>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  setBusy(true);
                  const f = Object.fromEntries(new FormData(e.target));
                  try {
                    setResult(
                      await api("/public/applications", {
                        method: "POST",
                        body: JSON.stringify({
                          ...f,
                          householdSize: Number(f.householdSize),
                          consent: f.consent === "on",
                        }),
                      }),
                    );
                    window.scrollTo(0, 0);
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-grid">
                  <label className="field">
                    <span>Full name *</span>
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label className="field">
                    <span>Email address *</span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                    />
                  </label>
                  <label className="field">
                    <span>Phone number *</span>
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={6}
                      maxLength={40}
                    />
                  </label>
                  <label className="field">
                    <span>Preferred contact *</span>
                    <select
                      name="contactMethod"
                      aria-label="Preferred contact"
                      required
                    >
                      <option>Email</option>
                      <option>Phone</option>
                    </select>
                  </label>
                  <label className="field full-field">
                    <span>Rental preference</span>
                    <select
                      name="unitId"
                      aria-label="Rental preference"
                      defaultValue={initialUnit}
                      key={rentals.length}
                    >
                      <option value="">
                        General application — no specific unit
                      </option>
                      {rentals.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {r.city || r.property}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Preferred move-in date *</span>
                    <input
                      name="desiredMoveIn"
                      type="date"
                      min={today}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Household size *</span>
                    <input
                      name="householdSize"
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      defaultValue={1}
                      required
                    />
                  </label>
                  <label className="field full-field">
                    <span>Anything you’d like us to know?</span>
                    <textarea
                      name="message"
                      rows={4}
                      maxLength={2000}
                      placeholder="Share your rental preferences or a question for the leasing team."
                    />
                  </label>
                </div>
                <label className="application-honeypot" aria-hidden="true">
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
                <label className="application-consent">
                  <input name="consent" type="checkbox" required />
                  <span>
                    I consent to Arcland Properties Inc collecting these details
                    to review my rental application and contact me about it. *
                  </span>
                </label>
                <p className="form-hint">
                  Submitting this form does not guarantee approval or
                  availability. Applications are reviewed by the leasing team;
                  there is no automatic eligibility decision.
                </p>
                <button className="primary application-submit" disabled={busy}>
                  {busy ? "Submitting…" : "Submit application"}
                  <ArrowRight size={17} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
      <footer className="home-footer">
        <Logo />
        <small>© {new Date().getFullYear()} Arcland Properties Inc</small>
        <button className="link" onClick={onHome}>
          Back to homepage
        </button>
      </footer>
    </div>
  );
}
