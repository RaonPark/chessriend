import { apiFetch } from '@/shared/api/apiClient'
import type { FolderResponse } from '../types/game'

export async function fetchFolders(): Promise<FolderResponse[]> {
  return apiFetch('/api/folders')
}

/** gameIds가 있으면 만들면서 바로 넣음 */
export async function createFolder(name: string, gameIds: string[] = []): Promise<FolderResponse> {
  return apiFetch('/api/folders', { method: 'POST', body: JSON.stringify({ name, gameIds }) })
}

export async function renameFolder(id: string, name: string): Promise<FolderResponse> {
  return apiFetch(`/api/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export async function deleteFolder(id: string): Promise<void> {
  return apiFetch(`/api/folders/${id}`, { method: 'DELETE' })
}

export async function addGamesToFolder(folderId: string, gameIds: string[]): Promise<void> {
  return apiFetch(`/api/folders/${folderId}/games`, { method: 'POST', body: JSON.stringify(gameIds) })
}

export async function removeGamesFromFolder(folderId: string, gameIds: string[]): Promise<void> {
  return apiFetch(`/api/folders/${folderId}/games`, { method: 'DELETE', body: JSON.stringify(gameIds) })
}
