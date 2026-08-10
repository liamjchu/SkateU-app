import Image from "next/image";
import { IMAGES } from "../constants/images";
import { WaitlistForm } from "./_components/waitlist-form";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-field text-ink">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-xl bg-surface px-4 py-3 text-sm font-bold text-brand shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 motion-reduce:transition-none"
      >
        Skip to content
      </a>

      <Image
        aria-hidden
        src={IMAGES.campusMap}
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover object-[58%_center] opacity-80"
      />
      <div aria-hidden className="absolute inset-0 bg-darkGreen/45" />

      <header className="relative z-10 bg-darkGreen">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-2 px-5 sm:h-24 sm:px-10 lg:px-16">
          <a
            href="#top"
            className="flex h-14 shrink-0 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-darkGreen"
            aria-label="SkateU home"
          >
            <Image
              src={IMAGES.brandLockup}
              alt=""
              className="-ml-[21px] h-14 w-[177px] object-contain"
              priority
            />
          </a>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section
          id="top"
          aria-labelledby="hero-title"
          className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[760px] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[calc(100vh-6rem)] sm:py-16"
        >
          <div className="flex w-full flex-col items-center rounded-3xl border border-borderColor bg-white p-6 text-center shadow-[0_16px_48px_rgba(23,58,53,0.18)] backdrop-blur-md sm:p-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-darkGreen bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-darkGreen">
              <span aria-hidden className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-logoGreen motion-safe:animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-logoGreen" />
              </span>
              Dropping soon
            </div>

            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-muted sm:tracking-[0.26em]">
              Your campus is a skatepark
            </p>
            <h1
              id="hero-title"
              className="mx-auto w-full max-w-[22rem] break-words text-[clamp(2.25rem,10vw,5.75rem)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-darkGreen sm:max-w-[38rem] sm:text-[clamp(3rem,6vw,5.75rem)]"
            >
              <span className="block">Locals know the spots,</span>
              <span className="mt-2 block text-[#52736c] sm:mt-3">Now you do too</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-7 text-muted sm:mt-8 sm:text-lg">
              The all-in-one app for finding, rating, and sharing the spots worth skating at your school.
            </p>

            <WaitlistForm />
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/40 bg-darkGreen text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-2 px-5 py-5 text-center text-[11px] font-bold uppercase tracking-[0.12em] sm:flex-row sm:justify-between sm:px-10 sm:text-left sm:tracking-[0.16em] lg:px-16">
          <span>© 2026 SkateU</span>
          <span>Find a new campus skate spot</span>
        </div>
      </footer>
    </div>
  );
}
