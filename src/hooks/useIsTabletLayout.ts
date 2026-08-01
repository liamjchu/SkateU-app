import { useWindowDimensions } from 'react-native';

const TABLET_MIN_WIDTH = 768;
const TABLET_MIN_HEIGHT = 600;

export function useIsTabletLayout(): boolean {
  const { height, width } = useWindowDimensions();

  return width >= TABLET_MIN_WIDTH && height >= TABLET_MIN_HEIGHT;
}
