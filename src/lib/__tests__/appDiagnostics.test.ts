import { collectClientDiagnostics } from '../appDiagnostics';
import { METADATA_VALUE_MAX } from '../userFeedback';

describe('collectClientDiagnostics', () => {
  it('returns clipped string fields the server allowlists', () => {
    const diagnostics = collectClientDiagnostics('/help/bug');
    const keys = [
      'appVersion',
      'buildNumber',
      'platform',
      'osVersion',
      'deviceModel',
      'route',
    ] as const;

    for (const key of keys) {
      expect(typeof diagnostics[key]).toBe('string');
      expect(diagnostics[key].length).toBeLessThanOrEqual(METADATA_VALUE_MAX);
    }

    expect(diagnostics.platform.length).toBeGreaterThan(0);
    expect(diagnostics.route).toBe('/help/bug');
  });
});
