import { useWindowDimensions } from 'react-native';

export const TABLET_MIN_WIDTH = 768;
export const TABLET_MIN_HEIGHT = 600;
export const TABLET_SHEET_INSET = 24;
export const TABLET_SHEET_MAX_WIDTH = 520;

export function isTabletLayout(width: number, height: number): boolean {
  return width >= TABLET_MIN_WIDTH && height >= TABLET_MIN_HEIGHT;
}

export function getTabletSheetWidth(windowWidth: number): number {
  return Math.min(windowWidth - TABLET_SHEET_INSET * 2, TABLET_SHEET_MAX_WIDTH);
}

export function useIsTabletLayout(): boolean {
  const { height, width } = useWindowDimensions();

  return isTabletLayout(width, height);
}
