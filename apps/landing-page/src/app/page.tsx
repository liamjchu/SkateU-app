import { AppCta } from "./_components/app-cta";
import { SchoolSearch } from "./_components/school-search";
import { SiteShell } from "./_components/site-shell";

export default function Home() {
  return (
    <SiteShell>
      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section
          aria-labelledby="hero-title"
          className="mx-auto flex w-full max-w-xl flex-col px-5 py-10 sm:py-16"
        >
          <h1
            id="hero-title"
            className="text-[clamp(2.25rem,8vw,3.5rem)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink"
          >
            Find skate spots on your campus.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Search your school and see the spots skaters have added.
          </p>
          <a href="/map" className="mt-4 inline-flex min-h-11 items-center font-bold text-brand">
            Open the map
          </a>
          <div className="mt-6">
            <SchoolSearch />
          </div>
          <AppCta />
        </section>
      </main>
    </SiteShell>
  );
}
