import type { Metadata } from "next";

import { SiteShell } from "../_components/site-shell";
import { LegalDocument } from "../../lib/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy — SkateU",
  description: "Privacy Policy for the SkateU campus skate-spot app.",
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <main id="main-content" tabIndex={-1} className="relative z-10 bg-surface/90 focus:outline-none">
        <LegalDocument filename="privacy-policy.md" />
      </main>
    </SiteShell>
  );
}
