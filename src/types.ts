export type CardType = 'qa' | 'single' | 'multi' | 'blank'

export interface Deck {
  id: string
  title: string
  description: string
  createdAt: number
}

export interface Card {
  id: string
  deckId: string
  type: CardType
  /** 問題文。穴埋めの場合は ___ が空欄を表す */
  question: string
  /** 一問一答の答え */
  answer?: string
  /** 選択 / 複数選択の選択肢 */
  choices?: string[]
  /** 正解の選択肢インデックス（単一選択は1つ、複数選択は複数） */
  correctIndices?: number[]
  /** 穴埋めの答え（___ の順番通り） */
  blankAnswers?: string[]
  explanation?: string
  attempts: number
  correct: number
  createdAt: number
}

export interface AppData {
  decks: Deck[]
  cards: Card[]
}

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  qa: '一問一答',
  single: '選択問題',
  multi: '複数選択',
  blank: '穴埋め',
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
