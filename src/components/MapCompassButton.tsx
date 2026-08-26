import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/colors';
import FeedbackPressable from './FeedbackPressable';

type MapCompassButtonProps = {
  bearing: number;
  disabled?: boolean;
  onPress: () => void;
  size?: 'md' | 'sm';
};

export default function MapCompassButton({
  bearing,
  disabled = false,
  onPress,
  size = 'md',
}: MapCompassButtonProps) {
  const compact = size === 'sm';
  const iconSize = compact ? 22 : 26;

  return (
    <FeedbackPressable
      haptic="light"
      onPress={onPress}
      disabled={disabled}
      className={
        compact
          ? 'h-11 w-11 items-center justify-center rounded-full bg-white'
          : 'h-14 w-14 items-center justify-center rounded-full bg-white'
      }
      style={styles.mapControl}
      accessibilityRole="button"
      accessibilityLabel="Reset map to north"
      accessibilityHint="Rotates the map so north is up"
      accessibilityState={{ disabled }}
    >
      <View
        accessible={false}
        style={{ transform: [{ rotate: `${-bearing}deg` }] }}
      >
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
          <Path
            d="M12 3.5 14.8 12 12 20.5 9.2 12Z"
            fill={colors.brand}
          />
          <Path
            d="M12 3.5 14.8 12 12 10.6 9.2 12Z"
            fill={colors.accent}
          />
        </Svg>
      </View>
    </FeedbackPressable>
  );
}

const styles = StyleSheet.create({
  mapControl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 6,
  },
});
