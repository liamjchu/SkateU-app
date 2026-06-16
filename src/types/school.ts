export type SchoolType = 'k12_public' | 'k12_private' | 'higher_ed'

export type School = {
  id: string
  name: string
  lat: number
  lng: number
  city: string
  state: string
  numSpots: number
  type?: SchoolType
}
