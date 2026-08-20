import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { formatCompactRelativeTime } from '../lib/relativeTime';
import type { SpotComment } from '../types/comment';
import ExpandableText from './expandable-text';
import FeedbackPressable from './FeedbackPressable';

type SpotCommentRowProps = {
  comment: SpotComment;
  currentUserId: string | null;
  isReply?: boolean;
  deletingId: string | null;
  onReply?: (comment: SpotComment) => void;
  onDelete: (comment: SpotComment) => void;
};

function attribution(comment: SpotComment): string {
  const who = comment.creatorUsername ? `@${comment.creatorUsername}` : 'A skater';
  const when = formatCompactRelativeTime(comment.createdAt);
  return when ? `${who} · ${when}` : who;
}

export default function SpotCommentRow({
  comment,
  currentUserId,
  isReply = false,
  deletingId,
  onReply,
  onDelete,
}: SpotCommentRowProps) {
  const isOwn = Boolean(currentUserId && comment.userId === currentUserId);
  const isDeleting = deletingId === comment.id;

  return (
    <View className={isReply ? 'ml-6 mt-3 border-l-2 border-border-soft pl-3' : ''}>
      <View className="flex-row items-start">
        <View className="min-w-0 flex-1">
          <Text className="font-outfit-semibold text-sm text-muted">
            {attribution(comment)}
          </Text>
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
        ) : null}
      </View>

      {!isReply && onReply ? (
        <FeedbackPressable
          haptic="selection"
          onPress={() => onReply(comment)}
          className="mt-1 self-start rounded-lg py-1"
          accessibilityRole="button"
          accessibilityLabel={`Reply to ${
            comment.creatorUsername ? `@${comment.creatorUsername}` : 'this comment'
          }`}
        >
          <Text className="font-outfit-bold text-sm text-muted">Reply</Text>
        </FeedbackPressable>
      ) : null}

      {comment.replies.map((reply) => (
        <SpotCommentRow
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          isReply
          deletingId={deletingId}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}
