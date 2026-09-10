import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { displayableAvatarUrl } from '../lib/avatarUrl';
import { APP_TAB_BAR_CONTENT_HEIGHT } from '../lib/tabBar';
import { rankFromXp } from '../lib/xpRank';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';

const TAB_ICONS = {
  index: { default: 'home-outline', selected: 'home' },
  map: { default: 'map-outline', selected: 'map' },
  feed: { default: 'newspaper-outline', selected: 'newspaper' },
} as const;

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  map: 'Map',
  feed: 'Feed',
  profile: 'Profile',
};

const PROFILE_TAB_SIZE = {
  focused: 28,
  blurred: 24,
} as const;

export default function AppTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const avatarUrl = useProfileStore((store) => store.profile?.avatar_url ?? null);
  const xpTotal = useProfileStore((store) => store.profile?.xp_total ?? 0);
  const signedIn = Boolean(useAuthStore((store) => store.user?.id));

  return (
    <View
      className="border-t border-borderSoft bg-field"
      style={{ paddingBottom: insets.bottom }}
    >
      <View
        className="flex-row items-stretch"
        style={{ height: APP_TAB_BAR_CONTENT_HEIGHT }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = TAB_LABELS[route.name] ?? options.title ?? route.name;
          const icons = TAB_ICONS[route.name as keyof typeof TAB_ICONS];
          const color = focused ? colors.ink : colors.muted;
          const profileSize = focused
            ? PROFILE_TAB_SIZE.focused
            : PROFILE_TAB_SIZE.blurred;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <FeedbackPressable
              key={route.key}
              haptic="selection"
              disablePressScale
              onPress={onPress}
              onLongPress={onLongPress}
              className="min-w-0 flex-1 items-center justify-center"
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            >
              {route.name === 'profile' ? (
                <ProfileAvatar
                  uri={signedIn ? displayableAvatarUrl(avatarUrl) : null}
                  size={profileSize}
                  iconSize={focused ? 13 : 11}
                  rank={signedIn ? rankFromXp(xpTotal) : null}
                />
              ) : (
                <Ionicons
                  name={
                    focused
                      ? (icons?.selected ?? 'ellipse')
                      : (icons?.default ?? 'ellipse-outline')
                  }
                  size={24}
                  color={color}
                />
              )}
            </FeedbackPressable>
          );
        })}
      </View>
    </View>
  );
}
