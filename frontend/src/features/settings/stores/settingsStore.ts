import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ThemePreference } from '../utils/theme'

interface SettingsState {
  /** 보드에 엔진 최선수를 화살표로 표시 (기본: 끔) */
  showBestMoveArrow: boolean
  setShowBestMoveArrow: (value: boolean) => void
  /** 화면 테마 (기본: 시스템 설정 따름) */
  theme: ThemePreference
  setTheme: (value: ThemePreference) => void
}

// 서버에 저장할 필요 없는 브라우저별 선호 설정 → localStorage
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showBestMoveArrow: false,
      setShowBestMoveArrow: (value) => set({ showBestMoveArrow: value }),
      theme: 'system',
      setTheme: (value) => set({ theme: value }),
    }),
    {
      name: 'chessriend-settings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
