export type GameSource = 'LICHESS' | 'CHESS_COM'

export type TimeCategory =
  | 'ULTRABULLET'
  | 'BULLET'
  | 'BLITZ'
  | 'RAPID'
  | 'CLASSICAL'
  | 'CORRESPONDENCE'

export interface PlayerResponse {
  name: string
  rating: number | null
}

export interface TimeControlResponse {
  time: string
  category: string
}

export interface OpeningResponse {
  eco: string | null
  name: string
}

export interface MoveResponse {
  number: number
  color: 'WHITE' | 'BLACK'
  san: string
}

export interface VariationResponse {
  startMoveIndex: number
  moves: string[]
  comment: string
  moveComments: Record<string, string>
}

export interface AnnotationResponse {
  moveComments: Record<string, string>
  variations: VariationResponse[]
}

export interface AnnotationRequest {
  moveComments: Record<string, string>
  variations: VariationResponse[]
}

export interface GameDetailResponse {
  id: string
  source: string
  sourceGameId: string
  ownerUsername: string
  white: PlayerResponse
  black: PlayerResponse
  result: string
  timeControl: TimeControlResponse
  opening: OpeningResponse | null
  moves: MoveResponse[]
  annotations: AnnotationResponse
  totalMoves: number
  playedAt: string
}

export interface GameResponse {
  id: string
  source: string
  sourceGameId: string
  ownerUsername: string
  white: PlayerResponse
  black: PlayerResponse
  result: string
  timeControl: TimeControlResponse
  opening: OpeningResponse | null
  totalMoves: number
  playedAt: string
}

export interface GameFilter {
  page?: number
  size?: number
  source?: GameSource
  timeCategory?: TimeCategory
}

export interface ImportParams {
  source: GameSource
  username: string
  max?: number
  since?: string
  until?: string
  timeCategory?: TimeCategory
  rated?: boolean
}
