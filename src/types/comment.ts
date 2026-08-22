export type SpotComment = {
  id: string
  spotId: string
  userId: string | null
  parentCommentId: string | null
  content: string
  // The author's public username, or null when the profile has no username
  // yet or the author's account was deleted.
  creatorUsername: string | null
  createdAt: string
  replies: SpotComment[]
}

export type NewCommentInput = {
  spotId: string
  content: string
  parentCommentId?: string
}
