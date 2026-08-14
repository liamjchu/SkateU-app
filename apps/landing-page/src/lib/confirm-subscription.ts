import { getSupabaseAdmin } from "./supabase-server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function waitlistTokenFromSearchParam(
  token: string | string[] | undefined
): string | null {
  if (typeof token !== "string") {
    return null;
  }

  return uuidPattern.test(token) ? token : null;
}

export async function confirmSubscription(token: string | null): Promise<boolean> {
  if (!token) {
    return false;
  }

  try {
    const { data: confirmed, error } = await getSupabaseAdmin().rpc(
      "confirm_subscription",
      { p_token: token }
    );

    return !error && Boolean(confirmed);
  } catch {
    return false;
  }
}
