import type { Card } from './types'

/** 達成度レベル 0..5 */
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5

export const MASTERY_LABELS = [
  '未学習',
  '苦手',
  '要復習',
  '理解中',
  'ほぼ定着',
  '定着',
] as const

export const MASTERY_STARS = ['☆☆☆☆☆', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★']

/**
 * 挑戦回数と正解率から達成度を決める。
 * - 0回: 未学習
 * - 正解率 <40%: 苦手
 * - 正解率 <60%: 要復習
 * - 正解率 <80%: 理解中
 * - 正解率 >=80%（ただし正解率100%かつ5回以上は定着）: ほぼ定着
 * - 正解率 100% かつ 5回以上: 定着
 */
export function masteryLevel(card: Pick<Card, 'attempts' | 'correct'>): MasteryLevel {
  if (card.attempts === 0) return 0
  const rate = card.correct / card.attempts
  if (rate >= 1 && card.attempts >= 5) return 5
  if (rate >= 0.8) return 4
  if (rate >= 0.6) return 3
  if (rate >= 0.4) return 2
  return 1
}

export function correctRate(card: Pick<Card, 'attempts' | 'correct'>): number | null {
  if (card.attempts === 0) return null
  return card.correct / card.attempts
}

/** 問題集の達成度内訳と達成度%（レベル/5 の平均） */
export function deckMastery(cards: Card[]) {
  const counts = [0, 0, 0, 0, 0, 0]
  for (const c of cards) counts[masteryLevel(c)]++
  const masteryRate =
    cards.length === 0
      ? 0
      : Math.round(
          (cards.reduce((sum, c) => sum + masteryLevel(c) / 5, 0) / cards.length) * 100,
        )
  return { counts, masteryRate }
}
