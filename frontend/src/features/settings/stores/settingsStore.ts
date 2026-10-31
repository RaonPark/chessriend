import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface SettingsState {
  /** 보드에 엔진 최선수를 화살표로 표시 (기본: 끔) */
  showBestMoveArrow: boolean
  setShowBestMoveArrow: (value: boolean) => void
}

// 서버에 저장할 필요 없는 브라우저별 선호 설정 → localStorage
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showBestMoveArrow: false,
      setShowBestMoveArrow: (value) => set({ showBestMoveArrow: value }),
    }),
    {
      name: 'chessriend-settings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
