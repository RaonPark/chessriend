export interface PagedResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface ErrorResponse {
  status: number
  error: string
  message: string
  timestamp: string
}
