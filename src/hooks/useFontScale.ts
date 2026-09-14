import { useWindowDimensions } from 'react-native';
import {
  isExtraLargeFontScale,
  isLargeFontScale,
  normalizeFontScale,
} from '../lib/fontScale';

export function useFontScale() {
  const { fontScale } = useWindowDimensions();
  const scale = normalizeFontScale(fontScale);

  return {
    fontScale: scale,
    isLarge: isLargeFontScale(scale),
    isExtraLarge: isExtraLargeFontScale(scale),
  };
}
