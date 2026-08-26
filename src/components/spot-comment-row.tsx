import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { formatCompactRelativeTime } from '../lib/relativeTime';
import { openUserProfile } from '../lib/userProfileNavigation';
import type { SpotComment } from '../types/comment';
import ExpandableText from './expandable-text';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';
import CreatorAttribution from './creator-attribution';

type SpotCommentRowProps = {
  comment: SpotComment;
  currentUserId: string | null;
  isReply?: boolean;
  deletingId: string | null;
  onReply?: (comment: SpotComment) => void;
  onDelete: (comment: SpotComment) => void;
  onReport?: (comment: SpotComment) => void;
  onBlock?: (comment: SpotComment) => void;
};

function attributionSuffix(comment: SpotComment): string {
  const when = formatCompactRelativeTime(comment.createdAt);
  return when ? ` · ${when}` : '';
}

export default function SpotCommentRow({
  comment,
  currentUserId,
  isReply = false,
  deletingId,
  onReply,
  onDelete,
  onReport,
  onBlock,
}: SpotCommentRowProps) {
  const isOwn = Boolean(currentUserId && comment.userId === currentUserId);
  const isDeleting = deletingId === comment.id;
  const canModerateOther =
    Boolean(currentUserId) && !isOwn && Boolean(comment.userId);
  const router = useRouter();

  return (
    <View className={isReply ? 'ml-6 mt-3 border-l-2 border-border-soft pl-3' : ''}>
      <View className="flex-row items-start">
        <View className="mr-2 mt-0.5">
          {comment.userId ? (
            <FeedbackPressable
              haptic="selection"
              onPress={() => {
                openUserProfile(router, comment.userId as string, currentUserId);
              }}
              accessibilityRole="link"
              accessibilityLabel={
                comment.creatorUsername
                  ? `Open @${comment.creatorUsername}'s profile`
                  : 'Open profile'
              }
            >
              <ProfileAvatar
                uri={comment.creatorAvatarUrl}
                size={28}
                iconSize={14}
              />
            </FeedbackPressable>
          ) : (
            <ProfileAvatar
              uri={comment.creatorAvatarUrl}
              size={28}
              iconSize={14}
            />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <CreatorAttribution
            userId={comment.userId}
            username={comment.creatorUsername}
            fallback="A skater"
            suffix={attributionSuffix(comment)}
            className="font-outfit-semibold text-sm text-muted"
          />
          <ExpandableText
            collapsedLines={4}
            className="mt-1 font-outfit-medium text-base leading-5 text-ink"
          >
            {comment.content}
          </ExpandableText>
        </View>
        {isOwn ? (
          <FeedbackPressable
            haptic="light"
            onPress={() => onDelete(comment)}
            disabled={isDeleting}
            className="ml-2 h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Delete comment"
            accessibilityState={{ busy: isDeleting, disabled: isDeleting }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Feather name="trash-2" size={16} color={colors.muted} />
            )}
          </FeedbackPressable>
        ) : canModerateOther && onReport ? (
          <FeedbackPressable
            haptic="selection"
            onPress={() => onReport(comment)}
            className="ml-2 h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Report comment"
          >
            <Feather name="flag" size={16} color={colors.muted} />
          </FeedbackPressable>
        ) : null}
      </View>

      <View className="mt-1 flex-row flex-wrap items-center gap-x-4">
        {!isReply && onReply ? (
          <FeedbackPressable
            haptic="selection"
            onPress={() => onReply(comment)}
            className="self-start rounded-lg py-1"
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${
              comment.creatorUsername ? `@${comment.creatorUsername}` : 'this comment'
            }`}
          >
            <Text className="font-outfit-bold text-sm text-muted">Reply</Text>
          </FeedbackPressable>
        ) : null}
        {canModerateOther && onBlock ? (
          <FeedbackPressable
            haptic="selection"
            onPress={() => onBlock(comment)}
            className="self-start rounded-lg py-1"
            accessibilityRole="button"
            accessibilityLabel={
              comment.creatorUsername
                ? `Block user @${comment.creatorUsername}`
                : 'Block this user'
            }
          >
            <Text className="font-outfit-bold text-sm text-muted">Block user</Text>
          </FeedbackPressable>
        ) : null}
      </View>

      {comment.replies.map((reply) => (
        <SpotCommentRow
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          isReply
          deletingId={deletingId}
          onDelete={onDelete}
          onReport={onReport}
          onBlock={onBlock}
        />
      ))}
    </View>
  );
}
