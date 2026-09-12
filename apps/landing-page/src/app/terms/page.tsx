import type { Metadata } from "next";

import { SiteShell } from "../_components/site-shell";
import { LegalDocument } from "../../lib/legal-document";

export const metadata: Metadata = {
  title: "Terms of Use — SkateU",
  description: "Terms of Use for the SkateU campus skate-spot app.",
};

export default function TermsPage() {
  return (
    <SiteShell>
      <main id="main-content" tabIndex={-1} className="relative z-10 bg-surface/90 focus:outline-none">
        <LegalDocument filename="terms-of-use.md" />
      </main>
    </SiteShell>
  );
}
