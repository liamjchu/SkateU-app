import { Stack } from 'expo-router';
import { colors } from '../../constants/colors';

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
