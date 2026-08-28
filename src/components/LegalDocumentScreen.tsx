import { useGuardedRouter } from '../lib/navigationGuard';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LegalMarkdownView from './LegalMarkdownView';
import ScreenHeader from './screen-header';

type LegalDocumentScreenProps = {
  title: string;
  markdown: string;
};

export default function LegalDocumentScreen({
  title,
  markdown,
}: LegalDocumentScreenProps) {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title={title} onBack={goBack} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[640px] self-center px-6 pt-6">
          <LegalMarkdownView markdown={markdown} hideLeadingTitle />
        </View>
      </ScrollView>
    </View>
  );
}
