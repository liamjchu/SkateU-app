"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";

import { WAITLIST_EMAIL_STORAGE_KEY } from "../../constants/site";
import { normalizeWaitlistEmail } from "../../lib/waitlistEmail";

type SubmissionStatus =
  | "idle"
  | "success"
  | "alreadySubscribed"
  | "resent"
  | "emailUnsent"
  | "error"
  | "tooMany"
  | "needsAge";

function getStoredSubscribedEmail(): string | null {
  try {
    return window.localStorage.getItem(WAITLIST_EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeToStoredEmail(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);

  return () => window.removeEventListener("storage", onStoreChange);
}

function getServerStoredEmail(): null {
  return null;
}

function statusMessage(status: SubmissionStatus): string {
  switch (status) {
    case "success":
      return "You’re subscribed. Check your inbox and confirm your email address.";
    case "alreadySubscribed":
      return "You’re already subscribed. Check your inbox to confirm your email address.";
    case "resent":
      return "Confirmation email sent. Check your inbox.";
    case "emailUnsent":
      return "You’re on the list, but the confirmation email didn’t send. Resend it below.";
    case "needsAge":
      return "You must be at least 13 years old to join the waitlist.";
    case "tooMany":
      return "Too many tries from this network. Wait a minute and try again.";
    case "error":
      return "We couldn’t add you to the waitlist. Please try again.";
    default:
      return "No spam. Just the invite when we drop. You must be 13 or older.";
  }
}

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [confirmedAge13Plus, setConfirmedAge13Plus] = useState(false);
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmittedEmail, setLastSubmittedEmail] = useState("");
  const storedSubscribedEmail = useSyncExternalStore(
    subscribeToStoredEmail,
    getStoredSubscribedEmail,
    getServerStoredEmail
  );
  const displayedStatus =
    status === "idle" && email.length === 0 && storedSubscribedEmail
      ? "alreadySubscribed"
      : status;
  const resendEmail =
    lastSubmittedEmail ||
    (displayedStatus === "alreadySubscribed" ? storedSubscribedEmail : null);
  const canResend =
    Boolean(resendEmail) &&
    (displayedStatus === "success" ||
      displayedStatus === "alreadySubscribed" ||
      displayedStatus === "resent" ||
      displayedStatus === "emailUnsent");

  async function submitEmail(submittedEmail: string): Promise<SubmissionStatus> {
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: submittedEmail,
        confirmedAge13Plus: true,
      }),
    });

    if (response.status === 429) {
      return "tooMany";
    }

    if (!response.ok) {
      return "error";
    }

    const data = (await response.json().catch(() => null)) as
      | { emailSent?: boolean }
      | null;

    try {
      window.localStorage.setItem(WAITLIST_EMAIL_STORAGE_KEY, submittedEmail);
    } catch {
      // The current-session success message remains available without storage.
    }

    setLastSubmittedEmail(submittedEmail);
    return data?.emailSent === false ? "emailUnsent" : "success";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const submittedEmail = normalizeWaitlistEmail(email);

    if (storedSubscribedEmail === submittedEmail) {
      setStatus("alreadySubscribed");
      return;
    }

    if (!confirmedAge13Plus) {
      setStatus("needsAge");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");

    try {
      const nextStatus = await submitEmail(submittedEmail);
      if (nextStatus === "success" || nextStatus === "emailUnsent") {
        setEmail("");
      }
      setStatus(nextStatus);
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (isSubmitting || !resendEmail) {
      return;
    }

    setIsSubmitting(true);

    try {
      const nextStatus = await submitEmail(resendEmail);
      setStatus(nextStatus === "success" ? "resent" : nextStatus);
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isError =
    displayedStatus === "error" ||
    displayedStatus === "alreadySubscribed" ||
    displayedStatus === "needsAge" ||
    displayedStatus === "tooMany" ||
    displayedStatus === "emailUnsent";

  return (
    <>
      <form
        className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3"
        aria-label="Join the SkateU waitlist"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="flex w-full flex-col gap-3 rounded-2xl bg-surface p-2 sm:flex-row">
          <label className="sr-only" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Your email address"
            className="min-h-14 min-w-0 flex-1 rounded-2xl bg-field px-4 text-sm font-medium text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setStatus("idle");
            }}
            disabled={isSubmitting}
            aria-invalid={isError || undefined}
            required
          />
          <button
            type="submit"
            className="min-h-14 rounded-xl bg-accent px-6 text-sm font-bold text-brand transition-colors hover:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:bg-actionDisabled disabled:text-muted motion-reduce:transition-none"
            disabled={isSubmitting}
          >
            Get early access
          </button>
        </div>
        <label className="flex cursor-pointer items-start gap-3 px-1 text-left text-xs font-medium leading-5 text-muted">
          <input
            type="checkbox"
            name="confirmedAge13Plus"
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            checked={confirmedAge13Plus}
            onChange={(event) => {
              setConfirmedAge13Plus(event.target.checked);
              setStatus("idle");
            }}
            disabled={isSubmitting}
            required
          />
          <span>I confirm I am at least 13 years old.</span>
        </label>
      </form>
      <p
        className={
          isError
            ? "mt-4 text-xs font-medium text-errorText"
            : "mt-4 text-xs font-medium text-muted"
        }
        role={isError ? "alert" : "status"}
        aria-live="polite"
      >
        {statusMessage(displayedStatus)}
      </p>
      {canResend ? (
        <button
          type="button"
          className="mt-3 text-xs font-bold text-ink underline underline-offset-2 disabled:text-muted"
          onClick={() => void handleResend()}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending…" : "Resend confirmation email"}
        </button>
      ) : null}
    </>
  );
}
