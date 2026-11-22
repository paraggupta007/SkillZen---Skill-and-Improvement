// Public developer contact page: direct links only, no contact form or data collection.
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  GraduationCap,
  Linkedin,
  Mail,
  Sparkles,
} from "lucide-react";
import { Brand } from "../components/layout";
import { Eyebrow } from "../components/ui";

/** Let visitors contact SkillZen's developer without creating an account. */
export function ContactPage() {
  return (
    <div className="contact-page">
      <header className="contact-header">
        <Brand />
        <Link className="back-link" to="/">
          <ArrowLeft size={15} /> Back to home
        </Link>
      </header>
      <main className="contact-main">
        <div className="contact-intro">
          <Eyebrow>THE PERSON BEHIND SKILLZEN</Eyebrow>
          <h1>
            Let’s connect<span className="heading-dot">.</span>
          </h1>
          <p>
            Have a question, an idea, or feedback about SkillZen? I’d love to
            hear from you.
          </p>
        </div>
        <section className="contact-card" aria-labelledby="developer-name">
          <div className="contact-profile">
            <div className="contact-avatar" aria-hidden="true">
              PG
              <Sparkles size={20} />
            </div>
            <div>
              <span className="contact-kicker">
                DEVELOPER &amp; PROJECT OWNER
              </span>
              <h2 id="developer-name">Parag Gupta</h2>
              <p>Building a thoughtful space to practice, learn and improve.</p>
            </div>
          </div>
          <div className="contact-education">
            <GraduationCap size={20} aria-hidden="true" />
            <div>
              <strong>B.Tech · Batch 2027</strong>
              <span>GL Bajaj Institute of Engineering and Technology</span>
            </div>
          </div>
          <div className="contact-links">
            <a className="contact-link" href="mailto:paragpggupta@gmail.com">
              <span className="contact-link-icon">
                <Mail size={20} />
              </span>
              <span>
                <small>EMAIL</small>
                <strong>paragpggupta@gmail.com</strong>
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
            <a
              className="contact-link"
              href="https://www.linkedin.com/in/parag-gupta-modinagar/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="contact-link-icon">
                <Linkedin size={20} />
              </span>
              <span>
                <small>LINKEDIN</small>
                <strong>Connect with Parag</strong>
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <p className="contact-note">
            Email opens your mail app. LinkedIn opens in a new tab. Please avoid
            sharing passwords or sensitive information.
          </p>
        </section>
      </main>
      <footer className="contact-footer">
        Built for practice. Made for progress.{" "}
        <span>© {new Date().getFullYear()} SkillZen</span>
      </footer>
    </div>
  );
}
