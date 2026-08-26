import { Feather, Ionicons, Octicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    ActivityIndicator,
    BackHandler,
    FlatList,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { triggerHaptic } from '../lib/haptics';
import {
    formatCompactRelativeTime,
    formatRelativeTime,
} from '../lib/relativeTime';
import {
    formatDistanceFromMeters,
    metersBetween,
} from '../lib/spotDistance';
import type { Spot } from '../types/spot';
import FeedbackPressable from './FeedbackPressable';
import ZoomablePhoto from './zoomable-photo';

export type SpotFullscreenVariant = 'feed' | 'map';

type SpotFullscreenViewerProps = {
  visible: boolean;
  spots: Spot[];
  initialSpotId: string;
  initialPhotoIndex?: number;
  variant: SpotFullscreenVariant;
  onClose: () => void;
  onChangeSpot?: (spot: Spot) => void;
  onLike: (spot: Spot) => void;
  onOpenComments: (spot: Spot) => void;
  onViewMap?: (spot: Spot) => void;
  onNearEnd?: () => void;
  likingSpotId?: string | null;
  originSpotId?: string;
  ownedSpotIds?: string[];
  reportedSpotIds?: string[];
  mySpotsLoading?: boolean;
  isSignedIn?: boolean;
  deletingSpotId?: string | null;
  onEdit?: (spot: Spot) => void;
  onDelete?: (spot: Spot) => void;
  onReportProblem?: (spot: Spot) => void;
  onRequestRemoval?: (spot: Spot) => void;
};

function spotAttribution(spot: Spot, variant: SpotFullscreenVariant): string {
  const who = spot.creatorUsername
    ? `@${spot.creatorUsername}`
    : variant === 'map'
      ? 'Deleted User'
      : 'A skater';

  if (variant === 'map') {
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
      return who;
    }

    return `${who} · ${wasEdited ? 'edited' : 'added'} ${relative}`;
  }

  const when = formatCompactRelativeTime(spot.createdAt);
  return when ? `${who} · ${when}` : who;
}

type PhotoStageProps = {
  uris: string[];
  name: string;
  width: number;
  height: number;
  initialIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onZoomChange: (zoomed: boolean) => void;
};

function SpotPhotoStage({
  uris,
  name,
  width,
  height,
  initialIndex,
  onClose,
  onIndexChange,
  onZoomChange,
}: PhotoStageProps) {
  const pagerRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(uris.length - 1, 0))
  );
  const [zoomed, setZoomed] = useState(false);
  const paging = uris.length > 1;
  const safeIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(uris.length - 1, 0)
  );

  useEffect(() => {
    setIndex(safeIndex);
    setZoomed(false);
    onIndexChange(safeIndex);
    onZoomChange(false);
    pagerRef.current?.scrollTo({ x: safeIndex * width, animated: false });
  }, [onIndexChange, onZoomChange, safeIndex, width]);

  function handleZoomChange(nextZoomed: boolean) {
    setZoomed(nextZoomed);
    onZoomChange(nextZoomed);
  }

  if (height <= 0 || width <= 0) {
    return null;
  }

  if (uris.length === 0) {
    return (
      <View
        className="items-center justify-center bg-black"
        style={{ width, height }}
        accessibilityLabel={`No photo for ${name}`}
      >
        <Feather name="map-pin" size={36} color="rgba(255,255,255,0.45)" />
        <Text className="mt-3 font-outfit-medium text-sm text-white/70">
          No photo yet
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }} className="bg-black">
      {paging ? (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(
              event.nativeEvent.contentOffset.x / width
            );
            if (next >= 0 && next < uris.length && next !== index) {
              setIndex(next);
              onIndexChange(next);
              triggerHaptic('light');
            }
          }}
        >
          {uris.map((uri, photoIndex) => (
            <ZoomablePhoto
              key={`${uri}-${photoIndex}`}
              uri={uri}
              width={width}
              height={height}
              paging
              onClose={onClose}
              onZoomChange={handleZoomChange}
              accessibilityLabel={`Photo ${photoIndex + 1} of ${uris.length} of ${name}`}
            />
          ))}
        </ScrollView>
      ) : (
        <ZoomablePhoto
          uri={uris[0] ?? ''}
          width={width}
          height={height}
          paging={false}
          onClose={onClose}
          onZoomChange={handleZoomChange}
          accessibilityLabel={`Photo of ${name}`}
        />
      )}
    </View>
  );
}

type OverlayActionProps = {
  label: string;
  count?: number;
  selected?: boolean;
  busy?: boolean;
  onPress: () => void;
  icon: 'heart' | 'heart-fill' | 'message-circle' | 'map';
  accessibilityLabel: string;
  accessibilityHint?: string;
};

function OverlayAction({
  label,
  count,
  selected = false,
  busy = false,
  onPress,
  icon,
  accessibilityLabel,
  accessibilityHint,
}: OverlayActionProps) {
  const iconColor = selected ? colors.brand : colors.white;
  return (
    <FeedbackPressable
      haptic="light"
      onPress={onPress}
      disabled={busy}
      className={`min-h-11 flex-1 flex-row items-center justify-center rounded-full px-3.5 ${
        selected ? 'bg-accent' : 'bg-white/20'
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : icon === 'heart' || icon === 'heart-fill' ? (
        <Octicons name={icon} size={16} color={iconColor} />
      ) : (
        <Feather name={icon} size={16} color={iconColor} />
      )}
      {typeof count === 'number' ? (
        <Text
          className={`ml-1.5 font-outfit-semibold text-sm ${
            selected ? 'text-brand' : 'text-white'
          }`}
        >
          {count}
        </Text>
      ) : (
        <Text
          className={`ml-1.5 font-outfit-bold text-sm ${
            selected ? 'text-brand' : 'text-white'
          }`}
        >
          {label}
        </Text>
      )}
    </FeedbackPressable>
  );
}

type DetailsOverlayProps = {
  spot: Spot;
  spotIndex: number;
  spotCount: number;
  photoIndex: number;
  photoCount: number;
  bottomInset: number;
  variant: SpotFullscreenVariant;
  distanceLabel: string;
  likingSpotId?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onViewMap?: () => void;
  isOwned: boolean;
  wasReported: boolean;
  canShowRemoval: boolean;
  deletingSpotId?: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onReportProblem?: () => void;
  onRequestRemoval?: () => void;
};

function SpotDetailsOverlay({
  spot,
  spotIndex,
  spotCount,
  photoIndex,
  photoCount,
  bottomInset,
  variant,
  distanceLabel,
  likingSpotId,
  onPrev,
  onNext,
  onLike,
  onOpenComments,
  onViewMap,
  isOwned,
  wasReported,
  canShowRemoval,
  deletingSpotId,
  onEdit,
  onDelete,
  onReportProblem,
  onRequestRemoval,
}: DetailsOverlayProps) {
  const liked = spot.likedByUser === true;
  const isLiking = likingSpotId === spot.id;
  const description = spot.description.trim();

  return (
    <View
      style={[
        styles.bottomOverlay,
        { paddingBottom: Math.max(bottomInset, 16) },
      ]}
    >
      {photoCount > 1 ? (
        <View className="mb-2 flex-row items-center justify-center">
          {Array.from({ length: photoCount }, (_, dotIndex) => (
            <View
              key={dotIndex}
              className={`mx-0.5 h-1.5 w-1.5 rounded-full ${
                dotIndex === photoIndex ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </View>
      ) : null}

      {variant === 'map' && spotCount > 1 ? (
        <View className="mb-2.5 flex-row items-center">
          <FeedbackPressable
            haptic="selection"
            onPress={onPrev}
            disabled={spotIndex === 0}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/15"
            accessibilityRole="button"
            accessibilityLabel="Previous nearby spot"
          >
            <Feather
              name="chevron-left"
              size={18}
              color={spotIndex === 0 ? 'rgba(255,255,255,0.28)' : colors.white}
            />
          </FeedbackPressable>
          <View className="min-w-0 flex-1 items-center px-2">
            <Text
              className="font-outfit-semibold text-xs text-white/80"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {spotIndex + 1} of {spotCount} nearby
            </Text>
            {distanceLabel ? (
              <Text className="mt-0.5 font-outfit-medium text-xs text-white/60">
                {distanceLabel}
              </Text>
            ) : null}
          </View>
          <FeedbackPressable
            haptic="selection"
            onPress={onNext}
            disabled={spotIndex === spotCount - 1}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/15"
            accessibilityRole="button"
            accessibilityLabel="Next nearby spot"
          >
            <Feather
              name="chevron-right"
              size={18}
              color={
                spotIndex === spotCount - 1
                  ? 'rgba(255,255,255,0.28)'
                  : colors.white
              }
            />
          </FeedbackPressable>
        </View>
      ) : null}

      <Text
        className="font-outfit-bold text-[22px] text-white"
        accessibilityRole="header"
      >
        {spot.name}
      </Text>
      <Text className="mt-1 font-outfit-medium text-sm text-white/75">
        {spotAttribution(spot, variant)}
      </Text>

      {description.length > 0 ? (
        <Text
          numberOfLines={variant === 'map' ? 2 : 3}
          className="mt-2.5 font-outfit-medium text-[15px] leading-5 text-white/90"
        >
          {description}
        </Text>
      ) : null}

      <View className="mt-4 flex-row items-center gap-2">
        <OverlayAction
          label="Like"
          count={spot.likeCount ?? 0}
          selected={liked}
          busy={isLiking}
          onPress={onLike}
          icon={liked ? 'heart-fill' : 'heart'}
          accessibilityLabel={
            liked ? `Unlike ${spot.name}` : `Like ${spot.name}`
          }
        />
        <OverlayAction
          label="Comments"
          count={spot.commentCount ?? 0}
          onPress={onOpenComments}
          icon="message-circle"
          accessibilityLabel={`Comments on ${spot.name}`}
          accessibilityHint="Opens comments for this spot"
        />
        {onViewMap ? (
          <OverlayAction
            label="View map"
            onPress={onViewMap}
            icon="map"
            accessibilityLabel={`View ${spot.name} on the campus map`}
            accessibilityHint="Opens the campus map with this spot selected"
          />
        ) : null}
      </View>

      {isOwned ? (
        <View className="mt-3 flex-row gap-2">
          <FeedbackPressable
            haptic="light"
            onPress={onEdit}
            disabled={deletingSpotId !== null}
            className="h-11 flex-1 flex-row items-center justify-center rounded-full bg-accent"
            accessibilityRole="button"
            accessibilityLabel={`Edit ${spot.name}`}
          >
            <Feather name="edit-2" size={15} color={colors.brand} />
            <Text className="ml-1.5 font-outfit-semibold text-sm text-brand">
              Edit
            </Text>
          </FeedbackPressable>
          <FeedbackPressable
            onPress={onDelete}
            disabled={deletingSpotId !== null}
            className="h-11 flex-1 flex-row items-center justify-center rounded-full bg-white/15"
            accessibilityRole="button"
            accessibilityLabel={`Delete ${spot.name}`}
          >
            {deletingSpotId === spot.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Feather name="trash-2" size={15} color={colors.white} />
            )}
            <Text className="ml-1.5 font-outfit-semibold text-sm text-white">
              Delete
            </Text>
          </FeedbackPressable>
        </View>
      ) : canShowRemoval ? (
        <View className="mt-3 flex-row gap-2">
          <FeedbackPressable
            haptic="selection"
            onPress={onReportProblem}
            className="h-11 flex-1 flex-row items-center justify-center rounded-full bg-white/15 px-3"
            accessibilityRole="button"
            accessibilityLabel={`Report a problem with ${spot.name}`}
          >
            <Feather name="alert-circle" size={15} color={colors.white} />
            <Text className="ml-1.5 font-outfit-semibold text-sm text-white">
              Report
            </Text>
          </FeedbackPressable>
          {wasReported ? (
            <View
              className="h-11 flex-1 flex-row items-center justify-center rounded-full bg-white/10 px-3"
              accessibilityRole="text"
              accessibilityLabel="Removal request submitted"
            >
              <Feather name="flag" size={15} color="rgba(255,255,255,0.55)" />
              <Text className="ml-1.5 font-outfit-semibold text-sm text-white/55">
                Requested
              </Text>
            </View>
          ) : (
            <FeedbackPressable
              haptic="selection"
              onPress={onRequestRemoval}
              className="h-11 flex-1 flex-row items-center justify-center rounded-full bg-white/15 px-3"
              accessibilityRole="button"
              accessibilityLabel={`Request removal of ${spot.name}`}
            >
              <Feather name="flag" size={15} color={colors.white} />
              <Text className="ml-1.5 font-outfit-semibold text-sm text-white">
                Request removal
              </Text>
            </FeedbackPressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

type SpotPageProps = {
  spot: Spot;
  spotIndex: number;
  spots: Spot[];
  width: number;
  height: number;
  initialPhotoIndex: number;
  counterTop: number;
  bottomInset: number;
  variant: SpotFullscreenVariant;
  originSpotId?: string;
  likingSpotId?: string | null;
  ownedSpotIds: string[];
  reportedSpotIds: string[];
  mySpotsLoading: boolean;
  isSignedIn: boolean;
  deletingSpotId?: string | null;
  onClose: () => void;
  onGoToSpot: (index: number) => void;
  onLike: (spot: Spot) => void;
  onOpenComments: (spot: Spot) => void;
  onViewMap?: (spot: Spot) => void;
  onEdit?: (spot: Spot) => void;
  onDelete?: (spot: Spot) => void;
  onReportProblem?: (spot: Spot) => void;
  onRequestRemoval?: (spot: Spot) => void;
};

function SpotFullscreenPage({
  spot,
  spotIndex,
  spots,
  width,
  height,
  initialPhotoIndex,
  counterTop,
  bottomInset,
  variant,
  originSpotId,
  likingSpotId,
  ownedSpotIds,
  reportedSpotIds,
  mySpotsLoading,
  isSignedIn,
  deletingSpotId,
  onClose,
  onGoToSpot,
  onLike,
  onOpenComments,
  onViewMap,
  onEdit,
  onDelete,
  onReportProblem,
  onRequestRemoval,
}: SpotPageProps) {
  const imageUris = spot.imageUris.filter((uri) => uri.length > 0);
  const [photoIndex, setPhotoIndex] = useState(initialPhotoIndex);
  const [zoomed, setZoomed] = useState(false);
  const origin = originSpotId
    ? spots.find((item) => item.id === originSpotId)
    : undefined;
  const distanceLabel =
    variant === 'map' && origin && origin.id !== spot.id
      ? formatDistanceFromMeters(metersBetween(origin, spot))
      : '';
  const isOwned = ownedSpotIds.includes(spot.id);
  const canShowRemoval = Boolean(
    variant === 'map' && !isOwned && (!isSignedIn || !mySpotsLoading)
  );

  return (
    <View style={{ width, height }}>
      <View style={styles.fill}>
        <SpotPhotoStage
          uris={imageUris}
          name={spot.name}
          width={width}
          height={height}
          initialIndex={initialPhotoIndex}
          onClose={onClose}
          onIndexChange={setPhotoIndex}
          onZoomChange={setZoomed}
        />
      </View>
      <View pointerEvents="box-none" style={styles.fill}>
        {imageUris.length > 1 && !zoomed ? (
          <View pointerEvents="none" style={[styles.photoCounter, { top: counterTop }]}>
            <Text
              className="font-outfit-bold text-[15px] text-white"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {photoIndex + 1} / {imageUris.length}
            </Text>
          </View>
        ) : null}
        {zoomed ? null : (
          <View style={styles.bottomWrap}>
            <SpotDetailsOverlay
              spot={spot}
              spotIndex={spotIndex}
              spotCount={spots.length}
              photoIndex={photoIndex}
              photoCount={imageUris.length}
              bottomInset={bottomInset}
              variant={variant}
              distanceLabel={distanceLabel}
              likingSpotId={likingSpotId}
              onPrev={() => onGoToSpot(spotIndex - 1)}
              onNext={() => onGoToSpot(spotIndex + 1)}
              onLike={() => onLike(spot)}
              onOpenComments={() => onOpenComments(spot)}
              onViewMap={onViewMap ? () => onViewMap(spot) : undefined}
              isOwned={isOwned}
              wasReported={reportedSpotIds.includes(spot.id)}
              canShowRemoval={canShowRemoval}
              deletingSpotId={deletingSpotId}
              onEdit={onEdit ? () => onEdit(spot) : undefined}
              onDelete={onDelete ? () => onDelete(spot) : undefined}
              onReportProblem={
                onReportProblem ? () => onReportProblem(spot) : undefined
              }
              onRequestRemoval={
                onRequestRemoval ? () => onRequestRemoval(spot) : undefined
              }
            />
          </View>
        )}
      </View>
    </View>
  );
}

export default function SpotFullscreenViewer({
  visible,
  spots,
  initialSpotId,
  initialPhotoIndex = 0,
  variant,
  onClose,
  onChangeSpot,
  onLike,
  onOpenComments,
  onViewMap,
  onNearEnd,
  likingSpotId,
  originSpotId,
  ownedSpotIds = [],
  reportedSpotIds = [],
  mySpotsLoading = false,
  isSignedIn = false,
  deletingSpotId,
  onEdit,
  onDelete,
  onReportProblem,
  onRequestRemoval,
}: SpotFullscreenViewerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<Spot>>(null);
  const lastSpotIdRef = useRef<string | null>(null);
  const startIndex = Math.max(
    0,
    spots.findIndex((spot) => spot.id === initialSpotId)
  );
  const [spotIndex, setSpotIndex] = useState(startIndex);

  const commitSpotIndex = useCallback(
    (next: number) => {
      if (next < 0 || next >= spots.length) {
        return;
      }

      const spot = spots[next];
      if (!spot) {
        return;
      }

      setSpotIndex(next);
      if (lastSpotIdRef.current === spot.id) {
        return;
      }

      lastSpotIdRef.current = spot.id;
      triggerHaptic('selection');
      onChangeSpot?.(spot);
      void AccessibilityInfo.announceForAccessibility(spot.name);
    },
    [onChangeSpot, spots]
  );

  useEffect(() => {
    if (!visible) {
      lastSpotIdRef.current = null;
      return;
    }

    lastSpotIdRef.current = initialSpotId;
    setSpotIndex(startIndex);
  }, [initialSpotId, startIndex, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      }
    );

    return () => subscription.remove();
  }, [onClose, visible]);

  useEffect(() => {
    if (!visible || spots.length === 0) {
      return;
    }

    if (spotIndex >= spots.length) {
      setSpotIndex(spots.length - 1);
    }
  }, [spotIndex, spots.length, visible]);

  useEffect(() => {
    if (!visible || spots.length === 0) {
      return;
    }

    if (spotIndex >= spots.length - 3) {
      onNearEnd?.();
    }
  }, [onNearEnd, spotIndex, spots.length, visible]);

  const goToSpot = useCallback(
    (index: number) => {
      if (index < 0 || index >= spots.length) {
        return;
      }

      listRef.current?.scrollToIndex({ index, animated: true });
      commitSpotIndex(index);
    },
    [commitSpotIndex, spots.length]
  );

  const handleSpotScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      commitSpotIndex(next);
    },
    [commitSpotIndex, width]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<Spot> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Spot; index: number }) => (
      <SpotFullscreenPage
        spot={item}
        spotIndex={index}
        spots={spots}
        width={width}
        height={height}
        initialPhotoIndex={item.id === initialSpotId ? initialPhotoIndex : 0}
        counterTop={Math.max(insets.top, 12)}
        bottomInset={insets.bottom}
        variant={variant}
        originSpotId={originSpotId}
        likingSpotId={likingSpotId}
        ownedSpotIds={ownedSpotIds}
        reportedSpotIds={reportedSpotIds}
        mySpotsLoading={mySpotsLoading}
        isSignedIn={isSignedIn}
        deletingSpotId={deletingSpotId}
        onClose={onClose}
        onGoToSpot={goToSpot}
        onLike={onLike}
        onOpenComments={onOpenComments}
        onViewMap={onViewMap}
        onEdit={onEdit}
        onDelete={onDelete}
        onReportProblem={onReportProblem}
        onRequestRemoval={onRequestRemoval}
      />
    ),
    [
      deletingSpotId,
      goToSpot,
      height,
      initialPhotoIndex,
      initialSpotId,
      insets.bottom,
      insets.top,
      isSignedIn,
      likingSpotId,
      mySpotsLoading,
      onClose,
      onDelete,
      onEdit,
      onLike,
      onOpenComments,
      onReportProblem,
      onRequestRemoval,
      onViewMap,
      originSpotId,
      ownedSpotIds,
      reportedSpotIds,
      spots,
      variant,
      width,
    ]
  );

  const listExtraData = useMemo(
    () => ({
      likingSpotId,
      ownedSpotIds,
      reportedSpotIds,
      deletingSpotId,
      spots,
    }),
    [deletingSpotId, likingSpotId, ownedSpotIds, reportedSpotIds, spots]
  );

  if (!visible || spots.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <View pointerEvents="none" style={styles.topScrim} />
        <FlatList
          ref={listRef}
          style={styles.list}
          data={spots}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={getItemLayout}
          initialNumToRender={3}
          windowSize={5}
          maxToRenderPerBatch={3}
          extraData={listExtraData}
          onMomentumScrollEnd={handleSpotScrollEnd}
          onScrollToIndexFailed={({ index }) => {
            requestAnimationFrame(() => {
              listRef.current?.scrollToIndex({ index, animated: false });
            });
          }}
          renderItem={renderItem}
        />
        <View
          pointerEvents="box-none"
          style={[styles.closeWrap, { top: Math.max(insets.top, 12) }]}
        >
          <FeedbackPressable
            haptic="selection"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/45"
            accessibilityRole="button"
            accessibilityLabel="Close full screen spot"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </FeedbackPressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  list: {
    flex: 1,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 1,
    experimental_backgroundImage:
      'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
  },
  closeWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
  },
  photoCounter: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
  },
  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomOverlay: {
    paddingHorizontal: 20,
    paddingTop: 28,
    experimental_backgroundImage:
      'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 58%, rgba(0,0,0,0) 100%)',
  },
});
