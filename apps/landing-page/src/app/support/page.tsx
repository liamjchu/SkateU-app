import type { Metadata } from "next";

import { SiteShell } from "../_components/site-shell";

export const metadata: Metadata = {
  title: "Support — SkateU",
  description: "Contact SkateU support.",
};

export default function SupportPage() {
  return (
    <SiteShell>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 bg-surface/90 focus:outline-none"
      >
        <article className="mx-auto w-full max-w-[720px] px-5 py-12 sm:px-10 sm:py-16">
          <h1 className="font-black uppercase tracking-[-0.04em] text-[clamp(1.75rem,6vw,3rem)] leading-[0.95] text-ink">
            Support
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-ink sm:text-lg">
            Questions, privacy requests, or help with your account: email{" "}
            <a
              href="mailto:support@skateu.app"
              className="font-semibold text-ink underline underline-offset-2"
            >
              support@skateu.app
            </a>
            .
          </p>
          <p className="mt-4 text-pretty text-base leading-7 text-ink sm:text-lg">
            In the app, signed-in users can also open Settings → Help & Support,
            report a comment or profile, request that a spot be removed, or
            delete their account.
          </p>
        </article>
      </main>
    </SiteShell>
  );
}
