import React from "react";
import { PublicHeader, AvailableRentals } from "./PublicApplications.jsx";
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  Leaf,
  ShieldCheck,
  KeyRound,
  Users,
  ChevronDown,
  Check,
  MapPin,
} from "lucide-react";
export default function Home({
  Logo,
  user,
  onSignIn,
  onDashboard,
  onApply,
  api,
}) {
  return (
    <div className="public-home">
      <PublicHeader {...{ Logo, user, onSignIn, onDashboard, onApply }} />
      <section className="home-hero">
        <div className="hero-copy">
          <span className="home-eyebrow">
            <span />
            ARCLAND PROPERTIES INC
          </span>
          <h1>
            Better properties.
            <br />
            <em>Better possibilities.</em>
          </h1>
          <p>
            Thoughtful property management, built around people. We help owners,
            agents, and residents feel at home with what comes next.
          </p>
          <div className="hero-actions">
            <a className="home-button" href="#services">
              Discover our approach <ArrowUpRight size={17} />
            </a>
            <button className="home-text-button" onClick={onSignIn}>
              Access your portal <ArrowRight size={16} />
            </button>
          </div>
          <div className="hero-trust">
            <span>
              <ShieldCheck size={17} />
              Considered care.
            </span>
            <span>
              <Leaf size={17} />
              Lasting value.
            </span>
          </div>
        </div>
        <div className="hero-image">
          <img
            src="/home-hero.jpg"
            alt="Contemporary residential property framed by landscaped gardens"
          />
          <div className="hero-caption">
            <span className="caption-icon">
              <Building2 size={24} />
            </span>
            <div>
              <small>A PLACE FOR EVERY POSSIBILITY</small>
              <b>
                Properties cared for.
                <br />
                People looked after.
              </b>
            </div>
          </div>
          <div className="image-label">
            <span />
            THE ARCLAND APPROACH
          </div>
        </div>
      </section>
      <div className="home-strip">
        <span>Property management, with perspective.</span>
        <div>
          Owners <i /> Agents <i /> Residents
        </div>
        <a href="#services" aria-label="Explore services">
          <ChevronDown size={18} />
        </a>
      </div>
      <section className="home-section" id="services">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">WHAT WE DO</span>
            <h2>
              A little more care.
              <br />A lot more confidence.
            </h2>
          </div>
          <p>
            From the everyday details to the bigger picture, we bring people and
            property together in one connected experience.
          </p>
        </div>
        <div className="home-service-grid">
          {[
            [
              Building2,
              "Property management",
              "Clear oversight of buildings, spaces, and the work that keeps them running.",
            ],
            [
              KeyRound,
              "Leasing & resident care",
              "A considered experience from lease coordination to feeling settled in.",
            ],
            [
              ShieldCheck,
              "Operations & maintenance",
              "Keep requests moving, responsibilities clear, and important records close.",
            ],
          ].map(([Icon, title, text], i) => (
            <article key={title}>
              <span className="service-number">0{i + 1}</span>
              <Icon size={27} strokeWidth={1.4} />
              <h3>{title}</h3>
              <p>{text}</p>
              <a href="#portals" aria-label={"Explore " + title}>
                <ArrowUpRight size={20} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <AvailableRentals api={api} onApply={onApply} />
      <section className="home-approach" id="approach">
        <div className="approach-art">
          <div className="arch-window">
            <Building2 size={105} strokeWidth={0.6} />
            <Leaf size={55} strokeWidth={0.8} />
          </div>
          <span>
            BUILT ON CARE.
            <br />
            GROUNDED IN TRUST.
          </span>
        </div>
        <div>
          <span className="home-eyebrow">THE WAY WE WORK</span>
          <h2>
            Good management
            <br />
            starts with connection.
          </h2>
          <p>
            We believe a well-managed property is more than a building. It’s a
            place where people can move forward with confidence.
          </p>
          <ul>
            {[
              "Clear information, close at hand",
              "Thoughtful coordination, every day",
              "One connected home for your property experience",
            ].map((t) => (
              <li key={t}>
                <Check size={16} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="home-section" id="portals">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">YOUR PLACE, CONNECTED</span>
            <h2>
              One sign-in.
              <br />A space that’s yours.
            </h2>
          </div>
          <p>
            Your account opens the dashboard designed for your role. Simple
            access, with the right information in the right hands.
          </p>
        </div>
        <div className="home-portal-grid">
          {[
            [
              ShieldCheck,
              "Administrators",
              "Oversee your portfolio, manage accounts, and keep your team aligned.",
            ],
            [
              Users,
              "Agents",
              "Coordinate assigned properties, leasing activity, and the work ahead.",
            ],
            [
              KeyRound,
              "Tenants",
              "Find your lease and statements, read notices, and request maintenance.",
            ],
          ].map(([Icon, title, text]) => (
            <article key={title}>
              <Icon size={23} />
              <h3>{title}</h3>
              <p>{text}</p>
              <button onClick={user ? onDashboard : onSignIn}>
                Enter your portal <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="home-section home-steps">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">A CLEAR PATH FORWARD</span>
            <h2>
              From looking
              <br />
              to feeling at home.
            </h2>
          </div>
          <button className="primary" onClick={() => onApply()}>
            Start your application <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="home-step-grid">
          {[
            [
              "01",
              "Explore your options",
              "Browse published rentals and consider what fits your next chapter.",
            ],
            [
              "02",
              "Make an introduction",
              "Share your contact details and preferences through a preliminary application.",
            ],
            [
              "03",
              "Connect with our team",
              "Discuss availability, arrange a viewing, and learn about next steps.",
            ],
            [
              "04",
              "Settle in, connected",
              "Approved residents receive access to their own secure tenant dashboard.",
            ],
          ].map(([n, h, p]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="home-section home-faq" id="faq">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">A FEW HELPFUL ANSWERS</span>
            <h2>
              Good questions.
              <br />
              Clearer next steps.
            </h2>
          </div>
          <p>
            A little clarity before your next move. Our team can answer
            property-specific questions during the leasing process.
          </p>
        </div>
        <div className="faq-list">
          {[
            [
              "How do I apply for a rental?",
              "Open the Applications tab, select a published rental or a general application, and submit your contact details and preferences.",
            ],
            [
              "Do I need an account to apply?",
              "No. Prospective tenants can apply without an account. Approved residents receive an account from the property administrator.",
            ],
            [
              "Does an application reserve a unit?",
              "No. A preliminary application does not reserve a unit or create a lease. The leasing team will discuss availability and the next steps with you.",
            ],
            [
              "How will I hear back?",
              "The leasing team will contact you using the email address or phone number you provide. Save the confirmation reference shown after submission.",
            ],
            [
              "What information should I provide?",
              "Your name, contact details, preferred move-in date, household size, and rental preferences. Do not include identification numbers, bank details, or financial documents in the public form.",
            ],
            [
              "How do existing tenants request maintenance?",
              "Sign in to your tenant dashboard and submit a maintenance request. For an emergency, contact local emergency services; portal requests are not an emergency service.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={16} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="home-cta">
        <span className="home-eyebrow">HERE FOR WHAT’S NEXT</span>
        <h2>Make yourself at home.</h2>
        <p>
          Already part of Arcland? Your connected workspace is ready when you
          are.
        </p>
        <button onClick={user ? onDashboard : onSignIn}>
          {user ? "Open my dashboard" : "Sign in to your account"}
          <ArrowUpRight size={17} />
        </button>
      </section>
      <footer className="home-footer">
        <Logo />
        <span>Thoughtfully managed. Confidently growing.</span>
        <small>© {new Date().getFullYear()} Arcland Properties Inc</small>
      </footer>
    </div>
  );
}
