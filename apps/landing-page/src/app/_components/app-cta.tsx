import { testFlightJoinUrl } from "../../constants/site";
import { WaitlistForm } from "./waitlist-form";

export function AppCta() {
  const testFlightUrl = testFlightJoinUrl();

  return (
    <section aria-labelledby="app-cta-title" className="mt-8 w-full text-left">
      <h2
        id="app-cta-title"
        className="text-lg font-black uppercase tracking-[-0.03em] text-ink"
      >
        Get SkateU on your phone
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Search a campus here. The iOS beta is where you add spots, photos, and likes.
      </p>
      {testFlightUrl ? (
        <a
          href={testFlightUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-brand"
        >
          Get the iOS beta
        </a>
      ) : (
        <p className="mt-4 text-sm font-medium text-muted">
          The TestFlight link is not on this site yet. Check back shortly.
        </p>
      )}
      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">
          Android beta
        </p>
        <WaitlistForm />
      </div>
    </section>
  );
}
