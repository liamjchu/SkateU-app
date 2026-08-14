import { Feather } from '@expo/vector-icons';
import { useRef, type ReactNode } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import FeedbackPressable from './FeedbackPressable';

type HomeRailCardProps = {
  imageUrl?: string | null;
  title: string;
  subtitle: string;
  meta?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessory?: ReactNode;
};

export default function HomeRailCard({
  imageUrl,
  title,
  subtitle,
  meta,
  onPress,
  accessibilityLabel,
  accessory,
}: HomeRailCardProps) {
  return (
    <View className="w-[188px]" pointerEvents="box-none">
      <FeedbackPressable
        haptic="light"
        onPress={onPress}
        className="overflow-hidden rounded-3xl bg-surface-tinted"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="h-32 w-full bg-surface-tinted"
            resizeMode="cover"
            accessible={false}
          />
        ) : (
          <View className="h-32 w-full items-center justify-center bg-surface-soft">
            <Feather name="map-pin" size={22} color="#52645F" />
          </View>
        )}

        <View className="px-3 py-2.5">
          <Text
            numberOfLines={1}
            className="font-outfit-bold text-base text-ink"
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 font-outfit-medium text-sm text-muted"
          >
            {subtitle}
          </Text>
          {typeof meta === 'string' || typeof meta === 'number' ? (
            <Text
              numberOfLines={1}
              className="mt-1 font-outfit-medium text-sm text-muted"
            >
              {meta}
            </Text>
          ) : meta ? (
            <View className="mt-1">{meta}</View>
          ) : null}
        </View>
      </FeedbackPressable>

      {accessory ? (
        <View className="absolute right-2 top-2 z-10" pointerEvents="box-none">
          {accessory}
        </View>
      ) : null}
    </View>
  );
}

type HomeFeedRailProps = {
  title: string;
  subtitle?: string;
  isLoading: boolean;
  loadingAccessibilityLabel: string;
  error: string;
  onRetry: () => void;
  retryAccessibilityLabel: string;
  isEmpty: boolean;
  empty: ReactNode;
  children: ReactNode;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
};

export function HomeFeedRail({
  title,
  subtitle,
  isLoading,
  loadingAccessibilityLabel,
  error,
  onRetry,
  retryAccessibilityLabel,
  isEmpty,
  empty,
  children,
  onEndReached,
  isLoadingMore = false,
}: HomeFeedRailProps) {
  const wasNearEndRef = useRef(false);
  return (
    <View>
      <View className="mb-3">
        <Text className="font-outfit-bold text-base text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isLoading ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          className="-mx-6"
          contentContainerClassName="gap-3 px-6"
          accessibilityLabel={loadingAccessibilityLabel}
        >
          {[0, 1, 2].map((placeholder) => (
            <View
              key={placeholder}
              className="h-52 w-[188px] rounded-3xl bg-surface-tinted"
            />
          ))}
        </ScrollView>
      ) : error ? (
        <View className="flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2">
          <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
            {error}
          </Text>
          <FeedbackPressable
            onPress={onRetry}
            className="rounded-lg bg-brand px-3 py-1.5"
            accessibilityRole="button"
            accessibilityLabel={retryAccessibilityLabel}
          >
            <Text className="font-outfit-bold text-sm text-white">Retry</Text>
          </FeedbackPressable>
        </View>
      ) : isEmpty ? (
        empty
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          className="-mx-6"
          contentContainerClassName="items-center gap-3 px-6"
          scrollEventThrottle={16}
          onScroll={(event) => {
            if (!onEndReached) {
              return;
            }

            const { contentOffset, layoutMeasurement, contentSize } =
              event.nativeEvent;
            const remaining =
              contentSize.width - (contentOffset.x + layoutMeasurement.width);
            const isNearEnd = remaining < 180;
            if (isNearEnd && !wasNearEndRef.current) {
              onEndReached();
            }
            wasNearEndRef.current = isNearEnd;
          }}
        >
          {children}
          {isLoadingMore ? (
            <View className="h-52 w-10 items-center justify-center">
              <ActivityIndicator color="#21473F" />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
