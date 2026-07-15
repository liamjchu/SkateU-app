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
  // ISO timestamp of when the spot was created. Empty string when unknown.
  createdAt: string
  // ISO timestamp of the spot's last edit. Equals createdAt until edited.
  // Empty string when unknown.
  updatedAt: string
}

export type NewSpotInput = {
  schoolId: string
  name: string
  description: string
  latitude: number
  longitude: number
  imageUri?: string
}

export type UpdateSpotInput = {
  name: string
  description: string
  latitude: number
  longitude: number
  // A new local image URI to upload. When omitted, the existing image is kept.
  imageUri?: string
}
