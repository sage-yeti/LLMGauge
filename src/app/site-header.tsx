import Link from "next/link";
import { ThemeControl } from "./theme-control";

const primaryLinks = [
  { href: "/", label: "Check a model" },
  { href: "/recommendations", label: "What can my PC run?" },
  { href: "/gpu-compatibility", label: "Compare GPUs" },
  { href: "/models", label: "Models" },
  { href: "/gpus", label: "GPUs" },
  { href: "/guides", label: "Learn the basics" },
];

export function SiteNavigation() {
  return (
    <nav className="site-nav" aria-label="Primary navigation">
      {primaryLinks.map((link) => (
        <Link href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/" aria-label="LLMGauge home">
          <span className="site-brand-mark" aria-hidden="true">
            LG
          </span>
          <span>LLMGauge</span>
        </Link>
        <SiteNavigation />
        <ThemeControl />
      </div>
    </header>
  );
}
