export type SchoolType = 'k12_public' | 'k12_private' | 'higher_ed'

// Home screen filter pills. Type pills map to database school types;
// "saved" filters to the user's saved schools.
export type SchoolTypeFilter = 'all' | 'k12' | 'college' | 'saved'

export type School = {
  id: string
  name: string
  lat: number
  lng: number
  city: string
  state: string
  numSpots: number
  type?: SchoolType
  // A photo from the school's most-liked spot, present on popular-school results.
  spotImageUrl?: string | null
}
