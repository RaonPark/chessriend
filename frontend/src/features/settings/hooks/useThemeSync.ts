import { useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { applyTheme, resolveTheme } from '../utils/theme'

/** 설정된 테마를 <html>에 반영. "시스템"이면 OS 설정이 바뀔 때도 따라감 */
export function useThemeSync() {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const update = () => applyTheme(resolveTheme(theme, media?.matches ?? false))
    update()
    if (theme !== 'system' || !media) return
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])
}
