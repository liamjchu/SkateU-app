export type Spot = {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  imageUris: string[]
  city: string
  state: string
  // The name of the school this spot belongs to. Empty string when unknown.
  schoolName: string
  schoolId?: string
  // The creator's public username, or null when the profile has no username
  // yet or the creator's account was deleted.
  creatorUsername: string | null
  // The creator's user id, or null when the account was deleted.
  creatorUserId?: string | null
  // ISO timestamp of when the spot was created. Empty string when unknown.
  createdAt: string
  // ISO timestamp of the spot's last edit. Equals createdAt until edited.
  // Empty string when unknown.
  updatedAt: string
  // Total number of users who currently like this spot.
  likeCount?: number
  // Whether the current authenticated user likes this spot.
  likedByUser?: boolean
  // Total comments on this spot, including one-level replies.
  commentCount?: number
}

export type SpotImageAsset = {
  uri: string
  fileName?: string
  mimeType?: string
}

export type SpotMediaItem =
  | { kind: 'existing'; uri: string }
  | { kind: 'new'; asset: SpotImageAsset }

export type NewSpotInput = {
  schoolId: string
  name: string
  description: string
  latitude: number
  longitude: number
  images: SpotImageAsset[]
}

export type UpdateSpotInput = {
  name: string
  description: string
  latitude: number
  longitude: number
  // Ordered photos after the edit. When omitted, the existing photos are kept.
  media?: SpotMediaItem[]
}
