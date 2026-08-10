"use client";

import { type FormEvent, useState } from "react";

type SubmissionStatus = "idle" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
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
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setEmail("");
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isError = status === "error";

  return (
    <>
      <form
        className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 rounded-3xl border border-border-soft bg-surface p-2 sm:mt-10 sm:flex-row"
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
          className="min-h-14 min-w-0 flex-1 rounded-2xl bg-field px-4 text-sm font-medium text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface"
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
          className="min-h-14 rounded-2xl bg-darkGreen px-6 text-sm font-bold text-white transition-colors hover:bg-logoGreen focus:outline-none focus-visible:ring-2 focus-visible:ring-darkGreen focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none"
          disabled={isSubmitting}
        >
          Get early access
        </button>
      </form>
      <p
        className={
          isError
            ? "mt-4 text-xs font-medium text-red-600"
            : "mt-4 text-xs font-medium text-muted"
        }
        role={isError ? "alert" : "status"}
        aria-live="polite"
      >
        {status === "success"
          ? "You’re on the waitlist. We’ll be in touch."
          : isError
            ? "We couldn’t add you to the waitlist. Please try again."
            : "No spam. Just the invite when we drop."}
      </p>
    </>
  );
}
