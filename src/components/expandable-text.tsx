import { useEffect, useState } from 'react';
import {
    Pressable,
    Text,
    View,
    type NativeSyntheticEvent,
    type TextLayoutEventData,
} from 'react-native';
import { triggerHaptic } from '../lib/haptics';

type ExpandableTextProps = {
  children: string;
  collapsedLines: number;
  className?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

function isTruncatedLayout(
  children: string,
  collapsedLines: number,
  event: NativeSyntheticEvent<TextLayoutEventData>
) {
  const { lines } = event.nativeEvent;
  const visible = lines.map((line) => line.text).join('');
  return (
    lines.length > collapsedLines ||
    visible.replace(/\s/g, '').length < children.replace(/\s/g, '').length
  );
}

export default function ExpandableText({
  children,
  collapsedLines,
  className,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setIsTruncated(false);
  }, [children, collapsedLines]);

  const canToggle = onPress == null || isTruncated || expanded;

  return (
    <View className="w-full min-w-0">
      <Pressable
        onPress={() => {
          if (canToggle) {
            triggerHaptic('selection');
            setExpanded((open) => !open);
            return;
          }

          onPress?.();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? children}
        accessibilityHint={
          expanded
            ? 'Shows less text'
            : isTruncated
              ? 'Shows the full text'
              : accessibilityHint
        }
        accessibilityState={{ expanded }}
      >
        <Text
          className={className}
          numberOfLines={expanded ? undefined : collapsedLines}
          ellipsizeMode="tail"
          onTextLayout={(event) => {
            if (expanded) {
              return;
            }

            const next = isTruncatedLayout(children, collapsedLines, event);
            setIsTruncated((prev) => (prev === next ? prev : next));
          }}
        >
          {children}
        </Text>
      </Pressable>
    </View>
  );
}
