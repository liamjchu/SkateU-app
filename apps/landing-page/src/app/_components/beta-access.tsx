import { testFlightJoinUrl } from "../../constants/site";
import { WaitlistForm } from "./waitlist-form";

export function BetaAccess() {
  const testFlightUrl = testFlightJoinUrl();

  return (
    <div className="mt-8 grid w-full gap-4 text-left sm:grid-cols-2">
      <article className="flex flex-col rounded-2xl bg-surface p-5 sm:p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">
          iPhone
        </p>
        <h2 className="mt-2 text-xl font-black uppercase tracking-[-0.03em] text-ink">
          Install with TestFlight
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Tap the link, install Apple’s TestFlight app if you need it, then
          install SkateU. Use the Apple ID on that iPhone.
        </p>
        {testFlightUrl ? (
          <a
            href={testFlightUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-14 items-center justify-center rounded-xl bg-accent px-6 text-center text-sm font-bold text-brand transition-colors hover:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
          >
            Get the iOS beta
          </a>
        ) : (
          <p className="mt-5 text-sm font-medium text-muted">
            The TestFlight link is not on this site yet. Check back shortly.
          </p>
        )}
        <p className="mt-4 text-xs font-medium leading-5 text-muted">
          You must be 13 or older. Apple handles TestFlight under Apple’s
          privacy policy.
        </p>
      </article>

      <article className="flex flex-col rounded-2xl bg-surface p-5 sm:p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">
          Android
        </p>
        <h2 className="mt-2 text-xl font-black uppercase tracking-[-0.03em] text-ink">
          Send your Play email
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Google needs your tester email before you can download the beta. Use
          the Google account on that phone. After you confirm, we add you to
          the Play test.
        </p>
        <WaitlistForm />
      </article>
    </div>
  );
}
