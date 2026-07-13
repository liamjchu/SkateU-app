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
}

export type NewSpotInput = {
  schoolId: string
  name: string
  description: string
  latitude: number
  longitude: number
  imageUri?: string
}
