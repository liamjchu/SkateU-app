import { Image, type ImageProps } from 'expo-image';

type CachedRemoteImageProps = {
  uri: string;
  className?: string;
  style?: ImageProps['style'];
  contentFit?: ImageProps['contentFit'];
  accessible?: boolean;
};

export default function CachedRemoteImage({
  uri,
  className,
  style,
  contentFit = 'cover',
  accessible = false,
}: CachedRemoteImageProps) {
  return (
    <Image
      source={{ uri }}
      className={className}
      style={style}
      contentFit={contentFit}
      cachePolicy="disk"
      accessible={accessible}
    />
  );
}
