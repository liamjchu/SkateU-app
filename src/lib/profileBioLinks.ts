export type ProfileBioSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

const ALLOWED_HOSTS = [
  'instagram.com',
  'instagr.am',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
  'x.com',
  'twitter.com',
  'vsco.co',
  'twitch.tv',
] as const;

const HTTPS_URL_PATTERN = /https:\/\/[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[)\].,!?:;]+$/;

function hostIsAllowlisted(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

export function isAllowlistedSocialHttpsUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  return hostIsAllowlisted(parsed.hostname);
}

function splitMatchedUrl(raw: string): { href: string; trailing: string } {
  const trailing = TRAILING_PUNCTUATION.exec(raw)?.[0] ?? '';
  const href = trailing.length > 0 ? raw.slice(0, -trailing.length) : raw;
  return { href, trailing };
}

export function parseProfileBioSegments(bio: string): ProfileBioSegment[] {
  const segments: ProfileBioSegment[] = [];
  const pattern = new RegExp(HTTPS_URL_PATTERN.source, HTTPS_URL_PATTERN.flags);
  let lastIndex = 0;

  for (const match of bio.matchAll(pattern)) {
    const raw = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: bio.slice(lastIndex, start) });
    }

    const { href, trailing } = splitMatchedUrl(raw);
    if (isAllowlistedSocialHttpsUrl(href)) {
      segments.push({ type: 'link', value: href, href });
      if (trailing.length > 0) {
        segments.push({ type: 'text', value: trailing });
      }
    } else {
      segments.push({ type: 'text', value: raw });
    }

    lastIndex = start + raw.length;
  }

  if (lastIndex < bio.length) {
    segments.push({ type: 'text', value: bio.slice(lastIndex) });
  }

  const coalesced: ProfileBioSegment[] = [];
  for (const segment of segments) {
    const previous = coalesced[coalesced.length - 1];
    if (segment.type === 'text' && previous?.type === 'text') {
      previous.value += segment.value;
      continue;
    }
    coalesced.push(segment);
  }

  return coalesced.length > 0 ? coalesced : [{ type: 'text', value: bio }];
}
