import type { AppData } from './types'

const KEY = 'memorization-app:data:v1'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { decks: [], cards: [] }
    const parsed = JSON.parse(raw) as AppData
    if (!Array.isArray(parsed.decks) || !Array.isArray(parsed.cards)) {
      return { decks: [], cards: [] }
    }
    return parsed
  } catch {
    return { decks: [], cards: [] }
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // 容量超過などでは保存できないことがある（画面自体は継続できる）
  }
}
