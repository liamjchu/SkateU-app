"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";

type SubmissionStatus = "idle" | "success" | "alreadySubscribed" | "error";

const subscribedEmailStorageKey = "skateu.waitlistEmail";

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getStoredSubscribedEmail(): string | null {
  try {
    return window.localStorage.getItem(subscribedEmailStorageKey);
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

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const storedSubscribedEmail = useSyncExternalStore(
    subscribeToStoredEmail,
    getStoredSubscribedEmail,
    getServerStoredEmail
  );
  const displayedStatus =
    status === "idle" && email.length === 0 && storedSubscribedEmail
      ? "alreadySubscribed"
      : status;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const submittedEmail = normalizedEmail(email);

    if (storedSubscribedEmail === submittedEmail) {
      setStatus("alreadySubscribed");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: submittedEmail }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      try {
        window.localStorage.setItem(subscribedEmailStorageKey, submittedEmail);
      } catch {
        // The current-session success message remains available without storage.
      }

      setEmail("");
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isError =
    displayedStatus === "error" || displayedStatus === "alreadySubscribed";

  return (
    <>
      <form
        className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 rounded-2xl bg-surface p-2 sm:mt-10 sm:flex-row"
        aria-label="Join the SkateU waitlist"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
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
          className="min-h-14 rounded-xl bg-accent px-6 text-sm font-bold text-brand transition-colors hover:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:ring-offset-2 focus:ring-offset-surface motion-reduce:transition-none"
          disabled={isSubmitting}
        >
          Get early access
        </button>
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
        {displayedStatus === "success"
          ? "You’re subscribed. Check your inbox and confirm your email address."
          : displayedStatus === "alreadySubscribed"
            ? "You’re already subscribed. Check your inbox to confirm your email address."
            : displayedStatus === "error"
              ? "We couldn’t add you to the waitlist. Please try again."
              : "No spam. Just the invite when we drop."}
      </p>
    </>
  );
}
