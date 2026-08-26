import { BetaAccess } from "./_components/beta-access";
import { SiteShell } from "./_components/site-shell";

export default function Home() {
  return (
    <SiteShell>
      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section
          id="top"
          aria-labelledby="hero-title"
          className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[920px] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[calc(100vh-6rem)] sm:py-16"
        >
          <div className="flex w-full flex-col items-center rounded-2xl border border-border-soft bg-field p-6 text-center sm:p-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand">
              <span aria-hidden className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-brand motion-safe:animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-brand" />
              </span>
              Beta is open
            </div>

            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-muted sm:tracking-[0.26em]">
              Your campus is a skatepark
            </p>
            <h1
              id="hero-title"
              className="mx-auto w-full max-w-[22rem] break-words text-[clamp(2.25rem,10vw,5.75rem)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-ink sm:max-w-[38rem] sm:text-[clamp(3rem,6vw,5.75rem)]"
            >
              <span className="block">Locals know the spots,</span>
              <span className="mt-2 block text-accent sm:mt-3">Now you do too</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-7 text-muted sm:mt-8 sm:text-lg">
              The all-in-one app for finding, liking, and sharing the spots worth skating at your school. Pick your phone and get into the beta.
            </p>

            <BetaAccess />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
