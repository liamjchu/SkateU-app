import { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useGuardedRouter } from '../lib/navigationGuard';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useBlocksStore } from '../store/blocksStore';

export default function BlockedAccountsScreen() {
  const router = useGuardedRouter();
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);
  const users = useBlocksStore((state) => state.users);
  const loading = useBlocksStore((state) => state.loading);
  const error = useBlocksStore((state) => state.error);
  const fetchBlocks = useBlocksStore((state) => state.fetchBlocks);
  const unblockUser = useBlocksStore((state) => state.unblockUser);

  useEffect(() => {
    if (accessToken) {
      void fetchBlocks(accessToken);
    }
  }, [accessToken, fetchBlocks]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/settings');
  };

  const handleUnblock = (userId: string, username: string | null) => {
    if (!accessToken) {
      return;
    }
    const label = username ? `@${username}` : 'this skater';
    Alert.alert('Unblock?', `You’ll see ${label}’s spots and comments again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () => {
          void unblockUser(userId, accessToken).catch((caught: unknown) => {
            Alert.alert(
              'Couldn’t unblock',
              toUserFacingError(caught, 'Try again in a sec.')
            );
          });
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Blocked accounts" onBack={goBack} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[640px] px-6 pb-8 pt-6"
      >
        {loading && users.length === 0 ? (
          <View className="items-center py-16" accessibilityLabel="Loading blocked accounts">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : error && users.length === 0 ? (
          <View className="rounded-2xl border border-errorBorder bg-errorSurface px-4 py-4">
            <Text accessibilityRole="alert" className="font-outfit-medium text-base text-errorText">
              {error}
            </Text>
            {accessToken ? (
              <FeedbackPressable
                onPress={() => {
                  void fetchBlocks(accessToken);
                }}
                className="mt-3 self-start rounded-xl bg-accent px-3 py-2"
                accessibilityRole="button"
                accessibilityLabel="Retry loading blocked accounts"
              >
                <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
              </FeedbackPressable>
            ) : null}
          </View>
        ) : users.length === 0 ? (
          <View className="items-center rounded-2xl bg-field px-6 py-10">
            <Text className="font-outfit-bold text-lg text-ink">No blocked accounts</Text>
            <Text className="mt-2 text-center font-outfit-medium text-base leading-5 text-muted">
              When you block a skater, they show up here. You can unblock anytime.
            </Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-2xl bg-field">
            {users.map((user, index) => (
              <View
                key={user.userId}
                className={`min-h-14 flex-row items-center px-4 py-3 ${
                  index > 0 ? 'border-t border-border-soft' : ''
                }`}
              >
                <Text className="flex-1 font-outfit-semibold text-base text-ink">
                  {user.username ? `@${user.username}` : 'Deleted User'}
                </Text>
                <FeedbackPressable
                  haptic="selection"
                  onPress={() => handleUnblock(user.userId, user.username)}
                  className="rounded-xl bg-surface-soft px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={
                    user.username
                      ? `Unblock @${user.username}`
                      : 'Unblock this skater'
                  }
                >
                  <Text className="font-outfit-bold text-sm text-ink">Unblock</Text>
                </FeedbackPressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
