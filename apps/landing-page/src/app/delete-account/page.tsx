import type { Metadata } from "next";

import { SiteShell } from "../_components/site-shell";

export const metadata: Metadata = {
  title: "Delete your account — SkateU",
  description: "Request deletion of your SkateU account and associated data.",
};

const linkClassName = "font-semibold text-ink underline underline-offset-2";

export default function DeleteAccountPage() {
  return (
    <SiteShell>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 bg-surface/90 focus:outline-none"
      >
        <article className="mx-auto w-full max-w-[720px] px-5 py-12 sm:px-10 sm:py-16">
          <h1 className="font-black uppercase tracking-[-0.04em] text-[clamp(1.75rem,6vw,3rem)] leading-[0.95] text-ink">
            Delete your SkateU account
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-ink sm:text-lg">
            You can ask SkateU to delete your account and the data associated
            with it. You do not need to reinstall the app.
          </p>

          <h2 className="mt-10 text-xl font-black uppercase tracking-[-0.03em] text-ink">
            How to request deletion
          </h2>
          <ol className="mt-4 list-decimal space-y-4 pl-5 text-pretty text-base leading-7 text-ink sm:text-lg">
            <li>
              In the SkateU app, open Settings, tap Delete account, and confirm
              with the code we email you. If you signed in with Apple and hid
              your email, we send that code to Apple’s private relay address.
            </li>
            <li>
              Or email{" "}
              <a href="mailto:support@skateu.app" className={linkClassName}>
                support@skateu.app
              </a>{" "}
              from the address on the account and ask us to delete the account
              and associated data. We may need to verify that the request is
              from you.
            </li>
          </ol>

          <h2 className="mt-10 text-xl font-black uppercase tracking-[-0.03em] text-ink">
            What we delete
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-ink sm:text-lg">
            Deleting your account permanently removes your sign-in, profile,
            likes, follows, saved schools, XP, notification records,
            notification preferences, push tokens, spot removal requests,
            comment reports, profile reports, and account blocks. Unpublished
            spot drafts for that account are deleted from the device.
          </p>

          <h2 className="mt-10 text-xl font-black uppercase tracking-[-0.03em] text-ink">
            What we keep
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-ink sm:text-lg">
            Spots you added stay on SkateU and are no longer linked to you.
            Comments you posted stay on SkateU and are shown without your
            username. A local copy of saved schools can remain on a device until
            you remove the app or clear that list. After the account is deleted,
            that list is no longer tied to an account and is not synced.
            Hosting, moderation, and email providers may retain logs or content
            according to their own practices.
          </p>

          <p className="mt-10 text-pretty text-base leading-7 text-ink sm:text-lg">
            The full policy is in the{" "}
            <a href="/privacy" className={linkClassName}>
              Privacy Policy
            </a>
            .
          </p>
        </article>
      </main>
    </SiteShell>
  );
}
