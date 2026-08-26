import {
    CAMPUS_USER_LOCATION_ZOOM,
    buildGoToUserLocationJavascript,
    buildSetUserLocationJavascript,
    CLEAR_USER_LOCATION_JAVASCRIPT,
    getLeafletUserLocationScript,
} from '../leafletUserLocation';

describe('leafletUserLocation javascript helpers', () => {
  it('builds a finite setUserLocation call', () => {
    expect(buildSetUserLocationJavascript(41.82, -71.4, 12.5)).toBe(
      'window.setUserLocation(41.82,-71.4,12.5); true;'
    );
  });

  it('uses a zero radius when accuracy is missing', () => {
    expect(buildSetUserLocationJavascript(41.82, -71.4, null)).toBe(
      'window.setUserLocation(41.82,-71.4,0); true;'
    );
  });

  it('skips non-finite coordinates', () => {
    expect(buildSetUserLocationJavascript(Number.NaN, -71.4, 8)).toBe('true;');
  });

  it('builds go-to-user-location calls', () => {
    expect(buildGoToUserLocationJavascript()).toBe(
      'if (window.goToUserLocation) { window.goToUserLocation(); } true;'
    );
    expect(buildGoToUserLocationJavascript(CAMPUS_USER_LOCATION_ZOOM)).toBe(
      'if (window.goToUserLocation) { window.goToUserLocation(17); } true;'
    );
  });

  it('includes Leaflet user-location APIs', () => {
    const script = getLeafletUserLocationScript();
    expect(script).toContain('window.setUserLocation');
    expect(script).toContain('window.clearUserLocation');
    expect(script).toContain('window.goToUserLocation');
    expect(CLEAR_USER_LOCATION_JAVASCRIPT).toContain('clearUserLocation');
  });
});
