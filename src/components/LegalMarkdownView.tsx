import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { useGuardedRouter } from '../lib/navigationGuard';
import { Text, View } from 'react-native';
import {
  parseLegalMarkdown,
  type LegalBlock,
  type LegalInline,
} from '../lib/legalMarkdown';

type LegalMarkdownViewProps = {
  markdown: string;
  hideLeadingTitle?: boolean;
};

function isUpdatedLine(block: LegalBlock): boolean {
  if (block.type !== 'paragraph' || block.inlines.length === 0) {
    return false;
  }

  const first = block.inlines[0];
  return first.type === 'text' && first.value.startsWith('Last updated');
}

function InlineText({
  inlines,
  onLink,
  muted = false,
}: {
  inlines: LegalInline[];
  onLink: (href: string) => void;
  muted?: boolean;
}) {
  const textClass = muted
    ? 'font-outfit-medium text-sm leading-5 text-muted'
    : 'font-outfit-medium text-base leading-6 text-ink';

  return (
    <Text className={textClass}>
      {inlines.map((inline, index) => {
        if (inline.type === 'bold') {
          return (
            <Text key={index} className="font-outfit-bold text-ink">
              {inline.value}
            </Text>
          );
        }

        if (inline.type === 'link') {
          return (
            <Text
              key={index}
              className="font-outfit-semibold text-ink underline"
              onPress={() => onLink(inline.href)}
              accessibilityRole="link"
            >
              {inline.label}
            </Text>
          );
        }

        return <Text key={index}>{inline.value}</Text>;
      })}
    </Text>
  );
}

function BlockView({
  block,
  onLink,
  isFirst,
}: {
  block: LegalBlock;
  onLink: (href: string) => void;
  isFirst: boolean;
}) {
  if (block.type === 'h1') {
    return (
      <Text
        accessibilityRole="header"
        className={`font-outfit-black text-2xl leading-8 text-ink ${
          isFirst ? '' : 'mt-2'
        }`}
      >
        {block.text}
      </Text>
    );
  }

  if (block.type === 'h2') {
    return (
      <Text
        accessibilityRole="header"
        className={`font-outfit-bold text-xl leading-7 text-ink ${
          isFirst ? '' : 'mt-8'
        }`}
      >
        {block.text}
      </Text>
    );
  }

  if (block.type === 'h3') {
    return (
      <Text
        accessibilityRole="header"
        className={`font-outfit-bold text-lg leading-6 text-ink ${
          isFirst ? '' : 'mt-5'
        }`}
      >
        {block.text}
      </Text>
    );
  }

  if (block.type === 'list') {
    return (
      <View className={`gap-2 ${isFirst ? '' : 'mt-3'}`}>
        {block.items.map((item, index) => (
          <View key={index} className="flex-row items-start pr-1">
            <Text className="w-5 shrink-0 font-outfit-medium text-base leading-6 text-ink">
              •
            </Text>
            <View className="min-w-0 flex-1">
              <InlineText inlines={item} onLink={onLink} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className={isFirst ? undefined : 'mt-3'}>
      <InlineText
        inlines={block.inlines}
        onLink={onLink}
        muted={isUpdatedLine(block)}
      />
    </View>
  );
}

export default function LegalMarkdownView({
  markdown,
  hideLeadingTitle = false,
}: LegalMarkdownViewProps) {
  const router = useGuardedRouter();
  const blocks = parseLegalMarkdown(markdown);
  const visibleBlocks =
    hideLeadingTitle && blocks[0]?.type === 'h1' ? blocks.slice(1) : blocks;

  const handleLink = (href: string) => {
    if (href.startsWith('/legal/')) {
      router.push(href as Href);
      return;
    }

    void Linking.openURL(href);
  };

  return (
    <View className="min-w-0">
      {visibleBlocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          onLink={handleLink}
          isFirst={index === 0}
        />
      ))}
    </View>
  );
}
