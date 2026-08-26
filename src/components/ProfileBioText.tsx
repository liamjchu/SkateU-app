import { Text } from 'react-native';
import { parseProfileBioSegments } from '../lib/profileBioLinks';
import { openSocialUrl } from '../lib/socialLinks';

type ProfileBioTextProps = {
  bio: string;
  className?: string;
};

export default function ProfileBioText({
  bio,
  className = 'text-center font-outfit-medium text-sm text-muted',
}: ProfileBioTextProps) {
  const segments = parseProfileBioSegments(bio);

  return (
    <Text className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <Text key={`${index}-${segment.value}`} className={className}>
              {segment.value}
            </Text>
          );
        }

        return (
          <Text
            key={`${index}-${segment.href}`}
            className={`${className} text-brand underline`}
            onPress={() => {
              void openSocialUrl(segment.href);
            }}
            accessibilityRole="link"
            accessibilityLabel={segment.value}
          >
            {segment.value}
          </Text>
        );
      })}
    </Text>
  );
}
