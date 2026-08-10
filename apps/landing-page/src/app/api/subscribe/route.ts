import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../lib/supabase-server";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const failureResponse = () =>
  NextResponse.json({ error: "Unable to join the waitlist." }, { status: 500 });

async function handleSubscription(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return failureResponse();
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("email" in payload) ||
    typeof payload.email !== "string"
  ) {
    return failureResponse();
  }

  const email = payload.email.trim().toLowerCase();

  if (
    email.length === 0 ||
    email.length > 254 ||
    !emailPattern.test(email)
  ) {
    return failureResponse();
  }

  const { error: subscribeError } = await supabaseAdmin.rpc("subscribe_email", {
    p_email: email,
  });

  if (subscribeError) {
    return failureResponse();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const dispatchSecret = process.env.SUBSCRIPTION_DISPATCH_SECRET;

  if (!supabaseUrl || !anonKey || !dispatchSecret) {
    return failureResponse();
  }

  const dispatchResponse = await fetch(
    new URL("/functions/v1/send-confirmation", supabaseUrl),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        "x-subscription-dispatch-secret": dispatchSecret,
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
    }
  );

  if (!dispatchResponse.ok) {
    return failureResponse();
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  try {
    return await handleSubscription(request);
  } catch {
    return failureResponse();
  }
}
