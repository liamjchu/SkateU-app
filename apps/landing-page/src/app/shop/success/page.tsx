import type { Metadata } from "next";

import { SiteShell } from "../../_components/site-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thanks — SkateU",
  description: "Your SkateU shop order is in.",
  robots: "noindex",
};

export default function ShopSuccessPage() {
  return (
    <SiteShell>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 focus:outline-none"
      >
        <section
          aria-labelledby="success-title"
          className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[760px] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[calc(100vh-6rem)] sm:py-16"
        >
          <div className="flex w-full flex-col items-center rounded-2xl border border-border-soft bg-field p-6 text-center sm:p-10">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-muted sm:tracking-[0.26em]">
              Shop
            </p>
            <h1
              id="success-title"
              className="max-w-xl text-[clamp(1.75rem,6vw,3rem)] font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink"
            >
              Thanks — your order is in.
            </h1>
            <p className="mx-auto mt-6 max-w-md text-pretty text-base leading-7 text-muted sm:text-lg">
              Check your email for a receipt. We’ll ship to the address you entered
              at checkout.
            </p>
            <a
              href="/shop"
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-xl bg-accent px-6 text-sm font-bold text-brand transition-colors hover:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-field motion-reduce:transition-none"
            >
              Back to shop
            </a>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
