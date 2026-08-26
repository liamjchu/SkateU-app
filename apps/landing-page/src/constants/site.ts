export const SITE_TITLE = "SkateU — Every school is a skatepark.";
export const SITE_DESCRIPTION =
  "The all-in-one skate spot map for your campus. Join the SkateU beta.";

export const WAITLIST_EMAIL_STORAGE_KEY = "skateu.waitlistEmail";
export const WAITLIST_MAX_BODY_BYTES = 4_096;

export const DEFAULT_TESTFLIGHT_JOIN_URL =
  "https://testflight.apple.com/join/GPHRqSmN";

export function testFlightJoinUrl(
  value = process.env.NEXT_PUBLIC_TESTFLIGHT_URL
): string | null {
  const trimmed = value?.trim() || DEFAULT_TESTFLIGHT_JOIN_URL;

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:") {
      return null;
    }

    if (url.hostname !== "testflight.apple.com") {
      return null;
    }

    if (!url.pathname.startsWith("/join/")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
