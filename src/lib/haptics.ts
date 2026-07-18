import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticFeedback = 'selection' | 'light' | 'success' | 'warning';

export function triggerHaptic(feedback: HapticFeedback) {
  if (Platform.OS === 'web') {
    return;
  }

  const haptic =
    feedback === 'selection'
      ? Haptics.selectionAsync()
      : feedback === 'light'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.notificationAsync(
            feedback === 'success'
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning
          );

  void haptic.catch(() => undefined);
}
