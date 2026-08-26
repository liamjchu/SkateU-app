import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import LoginRequiredModal from '../components/LoginRequiredModal';
import ScreenHeader from '../components/screen-header';
import SpotCommentRow from '../components/spot-comment-row';
import { colors } from '../constants/colors';
import {
    COMMENT_CONTENT_MAX,
    getCommentContentError,
} from '../lib/commentForm';
import { triggerHaptic } from '../lib/haptics';
import StaleCacheBanner from '../components/StaleCacheBanner';
import { STALE_COMMENTS_MESSAGE } from '../lib/readCache';
import { toMutationError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useBlocksStore } from '../store/blocksStore';
import { useCommentsStore } from '../store/commentsStore';
import type { SpotComment } from '../types/comment';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export default function SpotCommentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const spotId = firstParam(params.spotId);
  const spotName = firstParam(params.spotName);

  const session = useAuthStore((state) => state.session);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const cache = useCommentsStore((state) => state.bySpotId[spotId]);
  const fetchComments = useCommentsStore((state) => state.fetchComments);
  const fetchMore = useCommentsStore((state) => state.fetchMore);
  const addComment = useCommentsStore((state) => state.addComment);
  const deleteComment = useCommentsStore((state) => state.deleteComment);
  const blockUser = useBlocksStore((state) => state.blockUser);

  const comments = cache?.comments ?? [];
  const loading = cache?.loading === true;
  const loadingMore = cache?.loadingMore === true;
  const submitting = cache?.submitting === true;
  const error = cache?.error ?? null;

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<SpotComment | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!spotId) {
      return;
    }
    void fetchComments(spotId, session?.access_token);
  }, [fetchComments, session?.access_token, spotId]);

  const contentError = useMemo(() => getCommentContentError(draft), [draft]);
  const canSubmit = contentError === null && !submitting;

  const requireAuth = (): boolean => {
    if (session?.access_token) {
      return true;
    }
    Keyboard.dismiss();
    setShowLoginRequired(true);
    return false;
  };

  const handleReply = (comment: SpotComment) => {
    if (!requireAuth()) {
      return;
    }
    setReplyTo(comment);
    setSubmitError(null);
    inputRef.current?.focus();
  };

  const handleReport = (comment: SpotComment) => {
    if (!requireAuth()) {
      return;
    }
    router.push({
      pathname: '/report-comment',
      params: {
        commentId: comment.id,
        spotId,
        username: comment.creatorUsername ?? '',
      },
    });
  };

  const handleBlock = (comment: SpotComment) => {
    if (!requireAuth()) {
      return;
    }
    const accessToken = session?.access_token;
    const blockedId = comment.userId;
    if (!accessToken || !blockedId) {
      return;
    }
    const label = comment.creatorUsername
      ? `@${comment.creatorUsername}`
      : 'this account';
    Alert.alert(
      `Hide ${label}?`,
      'You won’t see their spots or comments. You can undo this in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          onPress: () => {
            void blockUser(blockedId, accessToken, comment.creatorUsername)
              .then(() => {
                triggerHaptic('success');
              })
              .catch((caught: unknown) => {
                Alert.alert(
                  'Couldn’t hide that account',
                  toMutationError(caught, 'Try again in a sec.')
                );
              });
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!requireAuth()) {
      return;
    }
    if (!canSubmit || !spotId) {
      if (contentError) {
        setSubmitError(contentError);
      }
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      return;
    }

    setSubmitError(null);
    try {
      await addComment(
        spotId,
        draft.trim(),
        accessToken,
        replyTo?.id
      );
      triggerHaptic('success');
      setDraft('');
      setReplyTo(null);
      Keyboard.dismiss();
    } catch (caught) {
      setSubmitError(
        toMutationError(caught, 'Couldn’t post that. Try again in a sec.')
      );
    }
  };

  const handleDelete = (comment: SpotComment) => {
    const accessToken = session?.access_token;
    if (!accessToken || deletingId) {
      return;
    }

    const hasReplies = comment.replies.length > 0;
    Alert.alert(
      'Delete comment?',
      hasReplies
        ? 'This comment and its replies will be removed.'
        : 'This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeletingId(comment.id);
            void deleteComment(spotId, comment.id, accessToken)
              .then(() => {
                triggerHaptic('success');
                if (replyTo?.id === comment.id) {
                  setReplyTo(null);
                }
              })
              .catch((caught: unknown) => {
                Alert.alert(
                  'Couldn’t delete that comment',
                  toMutationError(caught, 'Try again in a sec.')
                );
              })
              .finally(() => {
                setDeletingId(null);
              });
          },
        },
      ]
    );
  };

  const listEmpty = () => {
    if (loading) {
      return (
        <View className="items-center px-6 py-16">
          <ActivityIndicator color={colors.accent} />
          <Text className="mt-3 font-outfit-medium text-base text-muted">
            Loading comments…
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="mx-6 mt-8 rounded-2xl border border-errorBorder bg-errorSurface px-4 py-4">
          <Text
            accessibilityRole="alert"
            className="font-outfit-medium text-base text-errorText"
          >
            {error}
          </Text>
          <FeedbackPressable
            onPress={() => {
              void fetchComments(spotId, session?.access_token);
            }}
            className="mt-3 self-start rounded-xl bg-accent px-3 py-2"
            accessibilityRole="button"
            accessibilityLabel="Retry loading comments"
          >
            <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
          </FeedbackPressable>
        </View>
      );
    }

    return (
      <View className="mx-6 mt-8 items-center rounded-2xl bg-field px-5 py-10">
        <Text className="font-outfit-bold text-lg text-ink">No comments yet</Text>
        <Text className="mt-2 text-center font-outfit-medium text-base leading-5 text-muted">
          Be the first to say something about this spot.
        </Text>
      </View>
    );
  };

  if (!spotId) {
    return (
      <SafeAreaView
        edges={['left', 'right']}
        style={{ flex: 1, backgroundColor: colors.surface }}
      >
        <ScreenHeader title="Comments" onBack={() => router.back()} />
        <View className="px-6 pt-8">
          <Text className="font-outfit-medium text-base text-muted">
            We couldn’t load this spot. Please try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <ScreenHeader
        title="Comments"
        onBack={() => router.back()}
        backDisabled={submitting}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {spotName ? (
          <Text
            className="px-6 pt-3 font-outfit-semibold text-sm text-muted"
            numberOfLines={1}
          >
            {spotName}
          </Text>
        ) : null}

        {error && comments.length > 0 ? (
          <View className="mx-6 mt-3">
            <StaleCacheBanner
              message={STALE_COMMENTS_MESSAGE}
              onRetry={() => {
                void fetchComments(spotId, session?.access_token);
              }}
              retryAccessibilityLabel="Retry loading comments"
            />
          </View>
        ) : null}

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-6 pb-4 pt-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            void fetchMore(spotId, session?.access_token);
          }}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={
            loadingMore ? (
              <View className="items-center py-4">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View className="mb-5 rounded-2xl bg-field px-4 py-4">
              <SpotCommentRow
                comment={item}
                currentUserId={currentUserId}
                deletingId={deletingId}
                onReply={handleReply}
                onDelete={handleDelete}
                onReport={handleReport}
                onBlock={handleBlock}
              />
            </View>
          )}
        />

        <View
          className="border-t border-border-soft bg-surface px-6 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {replyTo ? (
            <View className="mb-2 flex-row items-center">
              <Text className="min-w-0 flex-1 font-outfit-medium text-sm text-muted">
                Replying to{' '}
                {replyTo.creatorUsername
                  ? `@${replyTo.creatorUsername}`
                  : 'a skater'}
              </Text>
              <FeedbackPressable
                haptic="selection"
                onPress={() => setReplyTo(null)}
                className="rounded-lg px-2 py-1"
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Text className="font-outfit-bold text-sm text-ink">Cancel</Text>
              </FeedbackPressable>
            </View>
          ) : null}

          <View className="flex-row items-end">
            <View className="min-h-12 min-w-0 flex-1 rounded-2xl border border-border-soft bg-field px-4 py-3">
              <TextInput
                ref={inputRef}
                className="max-h-28 w-full p-0 font-outfit-medium text-base text-ink"
                placeholder={
                  replyTo ? 'Write a reply…' : 'Add a comment…'
                }
                placeholderTextColor={colors.muted}
                accessibilityLabel={replyTo ? 'Reply' : 'Comment'}
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  if (submitError) {
                    setSubmitError(null);
                  }
                }}
                maxLength={COMMENT_CONTENT_MAX}
                multiline
                editable={!submitting}
                onFocus={() => {
                  if (!session?.access_token) {
                    inputRef.current?.blur();
                    setShowLoginRequired(true);
                  }
                }}
              />
            </View>
            <FeedbackPressable
              haptic="light"
              onPress={() => {
                void handleSubmit();
              }}
              disabled={!canSubmit}
              className={`ml-2 h-12 items-center justify-center rounded-2xl px-4 ${
                canSubmit ? 'bg-accent' : 'bg-actionDisabled'
              }`}
              accessibilityRole="button"
              accessibilityLabel={replyTo ? 'Post reply' : 'Post comment'}
              accessibilityState={{ busy: submitting, disabled: !canSubmit }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Text className="font-outfit-bold text-base text-brand">Post</Text>
              )}
            </FeedbackPressable>
          </View>

          {draft.length > COMMENT_CONTENT_MAX * 0.8 ? (
            <Text className="mt-1 self-end font-outfit-medium text-sm tabular-nums text-muted">
              {draft.length}/{COMMENT_CONTENT_MAX}
            </Text>
          ) : null}

          {submitError ? (
            <Text
              accessibilityRole="alert"
              className="mt-2 font-outfit-medium text-sm text-errorText"
            >
              {submitError}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
        title="Sign in to comment"
        message="You can still read comments. Sign in if you want to join the conversation, report a comment, or hide an account."
      />
    </SafeAreaView>
  );
}
