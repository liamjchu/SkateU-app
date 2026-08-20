const controlOrWhitespace = /[\s\u0000-\u001f\u007f]/;

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isWaitlistEmail(email: string): boolean {
  if (email.length === 0 || email.length > 254) {
    return false;
  }

  if (controlOrWhitespace.test(email)) {
    return false;
  }

  const separator = email.indexOf("@");
  if (separator <= 0 || separator !== email.lastIndexOf("@")) {
    return false;
  }

  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);

  if (local.length === 0 || local.length > 64 || domain.length < 3) {
    return false;
  }

  if (
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return false;
  }

  return true;
}
