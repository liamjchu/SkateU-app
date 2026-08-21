import type { LegalGate } from './legalAcceptance';

const AUTH_ENTRY_ROUTES = new Set([
  'login',
  'signup',
  'verify-otp',
  'forgot-password',
]);

export function isAuthEntryRoute(routeRoot: string | undefined): boolean {
  return typeof routeRoot === 'string' && AUTH_ENTRY_ROUTES.has(routeRoot);
}

export function shouldLeaveAuthEntryRoute(input: {
  userId: string | null;
  legalGate: LegalGate;
  passwordRecovery: boolean;
  routeRoot: string | undefined;
}): boolean {
  if (!input.userId || input.legalGate !== 'none' || input.passwordRecovery) {
    return false;
  }

  return isAuthEntryRoute(input.routeRoot);
}
