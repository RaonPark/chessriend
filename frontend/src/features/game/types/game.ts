export type GameSource = 'LICHESS' | 'CHESS_COM' | 'PGN'

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

// Analysis / Classification types
export type MoveClassification = 'brilliant' | 'blunder' | 'mistake' | 'inaccuracy'

export interface EvalScore {
  cp: number | null
  mate: number | null
}

export interface MoveEvaluation {
  moveIndex: number
  evalBefore: EvalScore
  evalAfter: EvalScore
  cpLoss: number
  classification: MoveClassification | null
}

export interface GameAnalysis {
  evaluations: MoveEvaluation[]
  depth: number
  analyzedAt: string
}

export interface VariationResponse {
  startMoveIndex: number
  moves: string[]
  comment: string
  moveComments: Record<string, string>
  moveArrows?: MoveArrows
}

/** 보드 위 화살표 (react-chessboard Arrow와 같은 모양) */
export interface BoardArrow {
  startSquare: string
  endSquare: string
  color: string
}

/** key: 수 인덱스 (-1 = 시작/분기 포지션), value: 그 수 이후 포지션의 화살표 */
export type MoveArrows = Record<string, BoardArrow[]>

export interface AnnotationResponse {
  moveComments: Record<string, string>
  variations: VariationResponse[]
  analysis?: GameAnalysis
  moveArrows?: MoveArrows
}

export interface AnnotationRequest {
  moveComments: Record<string, string>
  variations: VariationResponse[]
  moveArrows: MoveArrows
}

export interface GameDetailResponse {
  id: string
  source: GameSource
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

/** 목록용 분석 요약 (백엔드 GameAnalysisSummary) */
export interface SideAnalysisSummary {
  brilliant: number
  blunder: number
  mistake: number
  inaccuracy: number
  /** 평균 cp loss. 해당 색의 평가가 없으면 null */
  acpl: number | null
}

export interface AnalysisSummaryResponse {
  depth: number
  white: SideAnalysisSummary
  black: SideAnalysisSummary
}

export interface GameResponse {
  id: string
  source: GameSource
  sourceGameId: string
  ownerUsername: string
  white: PlayerResponse
  black: PlayerResponse
  result: string
  timeControl: TimeControlResponse
  opening: OpeningResponse | null
  totalMoves: number
  playedAt: string
  /** 분석 완료된 게임만 값이 있음 */
  analysisSummary?: AnalysisSummaryResponse | null
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

/** PGN 문자열로 게임 생성 요청. */
export interface CreateGameFromPgnRequest {
  pgn: string
}
