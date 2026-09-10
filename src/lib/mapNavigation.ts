import type { Router } from 'expo-router';
import { captureAnalyticsEvent } from './analytics';
import { schoolToMapParams, spotToMapParams } from './mapFocus';
import { guardedNavigate } from './navigationGuard';
import { useMapFocusStore } from '../store/mapFocusStore';
import type { School } from '../types/school';
import type { Spot } from '../types/spot';

export function openSchoolOnMap(router: Router, school: School): void {
  captureAnalyticsEvent('school_opened', { school_id: school.id });
  useMapFocusStore.getState().setSchoolFocus(school);
  guardedNavigate(`map:${school.id}`, () => {
    router.navigate({
      pathname: '/map',
      params: schoolToMapParams(school),
    });
  });
}

export function openSpotOnMap(router: Router, spot: Spot): boolean {
  if (!spot.schoolId) {
    return false;
  }

  captureAnalyticsEvent('school_opened', { school_id: spot.schoolId });
  useMapFocusStore.getState().setSpotFocus(spot);
  guardedNavigate(`map-spot:${spot.id}`, () => {
    router.navigate({
      pathname: '/map',
      params: spotToMapParams(spot),
    });
  });
  return true;
}
