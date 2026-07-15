export type Spot = {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  imageUris: string[]
  city: string
  state: string
  schoolId?: string
  // The creator's public username, or null when the profile has no username
  // yet or the creator's account was deleted.
  creatorUsername: string | null
  // ISO timestamp of when the spot was created. Empty string when unknown.
  createdAt: string
}

export type NewSpotInput = {
  schoolId: string
  name: string
  description: string
  latitude: number
  longitude: number
  imageUri?: string
}
