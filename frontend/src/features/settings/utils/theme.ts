/** 화면 테마 설정값. system = OS 설정(prefers-color-scheme)을 따름 */
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/**
 * <html>에 dark 클래스를 붙이거나 뗀다 (Tailwind dark: 변형이 이 클래스를 기준으로 동작 — index.css).
 * color-scheme도 맞춰서 스크롤바 등 브라우저 기본 UI 색이 테마를 따라가게 한다.
 * ※ index.html의 깜빡임 방지 스크립트도 같은 규칙을 쓴다.
 */
export function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
