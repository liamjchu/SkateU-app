import { getSupabaseAdmin } from "../../lib/supabase-server";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function confirmationPage(title: string, message: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | SkateU</title></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token || !uuidPattern.test(token)) {
    return confirmationPage(
      "This confirmation link is invalid or expired.",
      "Request a new confirmation email from the SkateU landing page."
    );
  }

  try {
    const { data: confirmed, error } = await getSupabaseAdmin().rpc(
      "confirm_subscription",
      { p_token: token }
    );

    if (!error && confirmed) {
      return confirmationPage(
        "Your email is confirmed.",
        "Thanks for joining the SkateU waitlist."
      );
    }
  } catch {
    // Treat server and token failures identically to avoid exposing details.
  }

  return confirmationPage(
    "This confirmation link is invalid or expired.",
    "Request a new confirmation email from the SkateU landing page."
  );
}
