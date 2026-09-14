import { rewriteRetiredAcceptLegalPath } from '../lib/legalAcceptance';

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    return rewriteRetiredAcceptLegalPath(path);
  } catch {
    return path;
  }
}
