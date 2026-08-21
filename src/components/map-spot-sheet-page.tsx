import { Feather, Octicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { formatRelativeTime } from '../lib/relativeTime';
import type { Spot } from '../types/spot';
import FeedbackPressable from './FeedbackPressable';
import SpotMediaPager from './spot-media-pager';

type MapSpotSheetPageProps = {
  spot: Spot;
  width: number;
  fill?: boolean;
  likingSpotId: string | null;
  commentCount: number;
  isOwned: boolean;
  wasReported: boolean;
  canShowRemoval: boolean;
  deletingSpotId: string | null;
  onOpenFullscreen: (photoIndex: number) => void;
  onLike: () => void;
  onOpenComments: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReportProblem: () => void;
  onRequestRemoval: () => void;
  onBlockCreator?: () => void;
  onPhotoZoneTouch: () => void;
  onDetailsZoneTouch: () => void;
};

function spotTimeLabel(spot: Spot): string | null {
  const createdMs = Date.parse(spot.createdAt);
  const updatedMs = Date.parse(spot.updatedAt);
  const wasEdited =
    Number.isFinite(createdMs) &&
    Number.isFinite(updatedMs) &&
    updatedMs - createdMs > 2000;
  const relative = formatRelativeTime(
    wasEdited ? spot.updatedAt : spot.createdAt
  );
  if (!relative) {
    return null;
  }

  return `${wasEdited ? 'edited' : 'added'} ${relative}`;
}

export default function MapSpotSheetPage({
  spot,
  width,
  fill = true,
  likingSpotId,
  commentCount,
  isOwned,
  wasReported,
  canShowRemoval,
  deletingSpotId,
  onOpenFullscreen,
  onLike,
  onOpenComments,
  onEdit,
  onDelete,
  onReportProblem,
  onRequestRemoval,
  onBlockCreator,
  onPhotoZoneTouch,
  onDetailsZoneTouch,
}: MapSpotSheetPageProps) {
  const liked = spot.likedByUser === true;
  const isLiking = likingSpotId === spot.id;
  const imageUris = spot.imageUris.filter((uri) => uri.length > 0);
  const timeLabel = spotTimeLabel(spot);
  const body = (
    <MapSpotSheetBody
      spot={spot}
      imageUris={imageUris}
      photoHeight={fill ? 220 : 248}
      isOwned={isOwned}
      wasReported={wasReported}
      canShowRemoval={canShowRemoval}
      deletingSpotId={deletingSpotId}
      onOpenFullscreen={onOpenFullscreen}
      onPhotoZoneTouch={onPhotoZoneTouch}
      onEdit={onEdit}
      onDelete={onDelete}
      onReportProblem={onReportProblem}
      onRequestRemoval={onRequestRemoval}
      onBlockCreator={onBlockCreator}
    />
  );

  return (
    <View style={{ width }} className={fill ? 'flex-1' : undefined}>
      <View className="flex-row items-start px-5">
        <FeedbackPressable
          haptic="light"
          disablePressScale
          onPress={() => onOpenFullscreen(0)}
          onPressIn={onDetailsZoneTouch}
          className="min-w-0 flex-1 pr-3"
          accessibilityRole="button"
          accessibilityLabel={`Open full screen view of ${spot.name}`}
        >
          <View className="flex-row items-center">
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 font-outfit-bold text-xl text-ink"
            >
              {spot.name}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.mutedSoft} />
          </View>
          <View className="mt-1 flex-row items-center">
            <Feather name="user" size={13} color={colors.muted} />
            <Text
              numberOfLines={1}
              className="ml-1.5 min-w-0 flex-1 font-outfit-medium text-sm text-muted"
            >
              {spot.creatorUsername
                ? `@${spot.creatorUsername}`
                : 'Deleted User'}
              {timeLabel ? ` · ${timeLabel}` : ''}
            </Text>
          </View>
        </FeedbackPressable>
        <FeedbackPressable
          onPress={onLike}
          disabled={isLiking}
          className={`mr-2 flex-row items-center rounded-xl px-3 py-2 ${
            liked ? 'bg-accent' : 'bg-surface-soft'
          }`}
          accessibilityLabel={
            liked ? `Unlike ${spot.name}` : `Like ${spot.name}`
          }
          accessibilityRole="button"
        >
          {isLiking ? (
            <ActivityIndicator
              size="small"
              color={liked ? colors.brand : colors.ink}
            />
          ) : (
            <Octicons
              name={liked ? 'heart-fill' : 'heart'}
              size={17}
              color={liked ? colors.brand : colors.ink}
            />
          )}
          <Text
            className={`ml-1.5 font-outfit-semibold text-sm ${
              liked ? 'text-brand' : 'text-ink'
            }`}
          >
            {spot.likeCount ?? 0}
          </Text>
        </FeedbackPressable>
        <FeedbackPressable
          haptic="light"
          onPress={onOpenComments}
          className="flex-row items-center rounded-xl bg-surface-soft px-3 py-2"
          accessibilityRole="button"
          accessibilityLabel={`Comments on ${spot.name}`}
          accessibilityHint="Opens comments for this spot"
        >
          <Feather name="message-circle" size={16} color={colors.ink} />
          <Text className="ml-1.5 font-outfit-semibold text-sm text-ink">
            {commentCount}
          </Text>
        </FeedbackPressable>
      </View>

      {fill ? (
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-4"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          directionalLockEnabled
        >
          {body}
        </ScrollView>
      ) : (
        <View className="px-5 pb-1">{body}</View>
      )}
    </View>
  );
}

function MapSpotSheetBody({
  spot,
  imageUris,
  photoHeight,
  isOwned,
  wasReported,
  canShowRemoval,
  deletingSpotId,
  onOpenFullscreen,
  onPhotoZoneTouch,
  onEdit,
  onDelete,
  onReportProblem,
  onRequestRemoval,
  onBlockCreator,
}: {
  spot: Spot;
  imageUris: string[];
  photoHeight: number;
  isOwned: boolean;
  wasReported: boolean;
  canShowRemoval: boolean;
  deletingSpotId: string | null;
  onOpenFullscreen: (photoIndex: number) => void;
  onPhotoZoneTouch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReportProblem: () => void;
  onRequestRemoval: () => void;
  onBlockCreator?: () => void;
}) {
  return (
    <>
        {imageUris.length > 0 ? (
          <View
            className="mt-3 overflow-hidden rounded-2xl"
            onTouchStart={onPhotoZoneTouch}
          >
            <SpotMediaPager
              uris={imageUris}
              height={photoHeight}
              onPressIndex={onOpenFullscreen}
              accessibilityName={spot.name}
              imageClassName="rounded-2xl"
            />
          </View>
        ) : (
          <FeedbackPressable
            haptic="light"
            disablePressScale
            onPress={() => onOpenFullscreen(0)}
            className="mt-3 h-36 items-center justify-center rounded-2xl bg-surface-soft"
            accessibilityRole="button"
            accessibilityLabel={`Open full screen view of ${spot.name}`}
          >
            <Feather name="image" size={22} color={colors.muted} />
            <Text className="mt-2 font-outfit-medium text-sm text-muted">
              No photo yet
            </Text>
          </FeedbackPressable>
        )}

        {spot.description.trim().length > 0 ? (
          <FeedbackPressable
            haptic="light"
            disablePressScale
            onPress={() => onOpenFullscreen(0)}
            accessibilityRole="button"
            accessibilityLabel={`Open full screen view of ${spot.name}`}
          >
            <Text className="mt-3 font-outfit-medium text-base text-muted-strong">
              {spot.description.trim()}
            </Text>
          </FeedbackPressable>
        ) : null}

        {isOwned ? (
          <View className="mt-4 flex-row gap-3">
            <FeedbackPressable
              haptic="light"
              onPress={onEdit}
              disabled={deletingSpotId !== null}
              className="h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-accent"
              accessibilityLabel={`Edit ${spot.name}`}
              accessibilityRole="button"
            >
              <Feather name="edit-2" size={16} color={colors.brand} />
              <Text className="ml-2 font-outfit-semibold text-sm text-brand">
                Edit spot
              </Text>
            </FeedbackPressable>
            <FeedbackPressable
              onPress={onDelete}
              disabled={deletingSpotId !== null}
              className="h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-errorSurface"
              accessibilityLabel={`Delete ${spot.name}`}
              accessibilityRole="button"
            >
              {deletingSpotId === spot.id ? (
                <ActivityIndicator size="small" color={colors.errorText} />
              ) : (
                <Feather name="trash-2" size={16} color={colors.errorText} />
              )}
              <Text className="ml-2 font-outfit-semibold text-sm text-errorText">
                Delete spot
              </Text>
            </FeedbackPressable>
          </View>
        ) : canShowRemoval ? (
          <View className="mt-4 gap-3">
            <FeedbackPressable
              haptic="selection"
              onPress={onReportProblem}
              className="h-12 flex-row items-center justify-center rounded-2xl bg-surface-soft px-4"
              accessibilityRole="button"
              accessibilityLabel={`Report a problem with ${spot.name}`}
            >
              <Feather name="alert-circle" size={16} color={colors.ink} />
              <Text className="ml-2 font-outfit-semibold text-sm text-ink">
                Report a Problem
              </Text>
            </FeedbackPressable>
            {wasReported ? (
              <View
                className="min-h-12 flex-row items-center justify-center rounded-2xl bg-surface-soft px-4"
                accessibilityRole="text"
                accessibilityLabel="Removal request submitted"
              >
                <Feather name="flag" size={16} color={colors.muted} />
                <Text className="ml-2 font-outfit-semibold text-sm text-muted">
                  Removal request submitted
                </Text>
              </View>
            ) : (
              <FeedbackPressable
                haptic="selection"
                onPress={onRequestRemoval}
                className="h-12 flex-row items-center justify-center rounded-2xl bg-surface-soft px-4"
                accessibilityRole="button"
                accessibilityLabel={`Request removal of ${spot.name}`}
              >
                <Feather name="flag" size={16} color={colors.ink} />
                <Text className="ml-2 font-outfit-semibold text-sm text-ink">
                  Request Removal
                </Text>
              </FeedbackPressable>
            )}
            {onBlockCreator && spot.creatorUserId ? (
              <FeedbackPressable
                haptic="selection"
                onPress={onBlockCreator}
                className="h-12 flex-row items-center justify-center rounded-2xl bg-surface-soft px-4"
                accessibilityRole="button"
                accessibilityLabel={
                  spot.creatorUsername
                    ? `Block @${spot.creatorUsername}`
                    : 'Block this skater'
                }
              >
                <Feather name="slash" size={16} color={colors.ink} />
                <Text className="ml-2 font-outfit-semibold text-sm text-ink">
                  Block this skater
                </Text>
              </FeedbackPressable>
            ) : null}
          </View>
        ) : null}
    </>
  );
}
