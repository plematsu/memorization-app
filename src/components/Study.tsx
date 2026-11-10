import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../types'
import { CARD_TYPE_LABEL } from '../types'
import { MASTERY_LABELS, masteryLevel } from '../mastery'

export type StudyOrder = 'low' | 'shuffle' | 'created' | 'high'
export type CountChoice = 'all' | '5' | '10' | '20' | '30' | 'custom'

interface Props {
  deckTitle: string
  cards: Card[]
  onRecord: (cardId: string, isCorrect: boolean) => void
  onExit: () => void
  /** 指定すると設定画面を飛ばしてこの問題で開始（間違えた問題の再出題用） */
  presetCards?: Card[]
}

interface SessionItem {
  card: Card
  swapped: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function sortCards(cards: Card[], order: StudyOrder): Card[] {
  const a = [...cards]
  switch (order) {
    case 'created':
      return a.sort((x, y) => x.createdAt - y.createdAt)
    case 'shuffle':
      return shuffle(a)
    case 'low':
      return a.sort(
        (x, y) =>
          masteryLevel(x) - masteryLevel(y) ||
          (x.attempts ? x.correct / x.attempts : 0) -
            (y.attempts ? y.correct / y.attempts : 0) ||
          x.createdAt - y.createdAt,
      )
    case 'high':
      return a.sort(
        (x, y) =>
          masteryLevel(y) - masteryLevel(x) ||
          (y.attempts ? y.correct / y.attempts : 0) -
            (x.attempts ? x.correct / x.attempts : 0) ||
          x.createdAt - y.createdAt,
      )
  }
}

export default function Study({ deckTitle, cards, onRecord, onExit, presetCards }: Props) {
  // ---- 設定 ----
  const [countChoice, setCountChoice] = useState<CountChoice>('all')
  const [customCount, setCustomCount] = useState(10)
  const [order, setOrder] = useState<StudyOrder>('low')
  const [filter, setFilter] = useState<'all' | 'unlearned' | number>('all')
  const [swap, setSwap] = useState(false)

  const filtered = useMemo(() => {
    if (filter === 'all') return cards
    if (filter === 'unlearned') return cards.filter((c) => c.attempts === 0)
    return cards.filter((c) => masteryLevel(c) === filter)
  }, [cards, filter])

  const orderedPreview = useMemo(
    () => (order === 'shuffle' ? filtered : sortCards(filtered, order)),
    [filtered, order],
  )

  const effectiveCount =
    countChoice === 'all'
      ? filtered.length
      : countChoice === 'custom'
        ? Math.max(1, customCount || 1)
        : Number(countChoice)
  const appliedCount = Math.min(effectiveCount, filtered.length)

  // ---- セッション ----
  const [session, setSession] = useState<SessionItem[] | null>(
    presetCards ? presetCards.map((c) => ({ card: c, swapped: false })) : null,
  )
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<{ card: Card; isCorrect: boolean }[]>([])
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<number | null>(null)

  // 回答用の一時状態（問題が変わるたびにリセット）
  const [revealed, setRevealed] = useState(false)
  const [singleSel, setSingleSel] = useState<number | null>(null)
  const [multiSel, setMultiSel] = useState<number[]>([])
  const [blankInputs, setBlankInputs] = useState<string[]>([])
  const [judged, setJudged] = useState<boolean | null>(null)

  const current = session?.[index]

  useEffect(() => {
    if (session && index < session.length) {
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current)
      }
    }
  }, [session, index])

  useEffect(() => {
    setRevealed(false)
    setSingleSel(null)
    setMultiSel([])
    setJudged(null)
    if (current?.card.type === 'blank') {
      setBlankInputs(new Array(current.card.blankAnswers?.length ?? 0).fill(''))
    } else setBlankInputs([])
  }, [index, session])

  function start() {
    const base = order === 'shuffle' ? shuffle(filtered) : sortCards(filtered, order)
    const picked = base.slice(0, appliedCount)
    setSession(picked.map((c) => ({ card: c, swapped: swap && c.type === 'qa' })))
    setIndex(0)
    setResults([])
    setSeconds(0)
  }

  function finishOne(isCorrect: boolean) {
    if (!current) return
    onRecord(current.card.id, isCorrect)
    setResults((r) => [...r, { card: current.card, isCorrect }])
    setIndex((i) => i + 1)
  }

  function judgeChoice() {
    if (!current) return
    const correct = [...(current.card.correctIndices ?? [])].sort((a, b) => a - b)
    let ok = false
    if (current.card.type === 'single') ok = singleSel !== null && correct[0] === singleSel
    else {
      const sel = [...multiSel].sort((a, b) => a - b)
      ok = sel.length === correct.length && sel.every((v, i) => v === correct[i])
    }
    setJudged(ok)
  }

  function judgeBlank() {
    if (!current) return
    const answers = current.card.blankAnswers ?? []
    const ok = answers.every(
      (a, i) => (blankInputs[i] ?? '').trim() === a.trim(),
    )
    setJudged(ok)
  }

  function speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ja-JP'
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch {
      // 読み上げ非対応環境では何もしない
    }
  }

  // ---------- 結果画面 ----------
  if (session && index >= session.length) {
    const total = results.length
    const okCount = results.filter((r) => r.isCorrect).length
    const wrong = results.filter((r) => !r.isCorrect)
    return (
      <div>
        <h2>結果 — {deckTitle}</h2>
        <p className="big">
          {total}問中{okCount}問正解（{total ? Math.round((okCount / total) * 100) : 0}%）
        </p>
        <p className="muted">かかった時間: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
        {wrong.length > 0 && (
          <>
            <h3>間違えた問題</h3>
            <ul>
              {wrong.map((r) => (
                <li key={r.card.id}>{r.card.question}</li>
              ))}
            </ul>
            <button
              className="primary"
              onClick={() => {
                setSession(wrong.map((r) => ({ card: r.card, swapped: false })))
                setIndex(0)
                setResults([])
                setSeconds(0)
              }}
              type="button"
            >
              間違えた問題だけもう一度解く
            </button>{' '}
          </>
        )}
        <button onClick={onExit} type="button">問題集に戻る</button>
      </div>
    )
  }

  // ---------- 設定画面 ----------
  if (!session) {
    return (
      <div>
        <h2>学習設定 — {deckTitle}</h2>
        <div className="panel">
          <div className="field">
            <span>解く問題数</span>
            <div className="row wrap">
              {(['all', '5', '10', '20', '30', 'custom'] as CountChoice[]).map((c) => (
                <button
                  key={c}
                  className={countChoice === c ? 'chip active' : 'chip'}
                  onClick={() => setCountChoice(c)}
                  type="button"
                >
                  {c === 'all' ? 'すべて' : c === 'custom' ? '任意の数' : `${c}問`}
                </button>
              ))}
              {countChoice === 'custom' && (
                <input
                  type="number"
                  min={1}
                  value={customCount}
                  onChange={(e) => setCustomCount(Number(e.target.value))}
                  style={{ width: 90 }}
                />
              )}
            </div>
          </div>

          <div className="field">
            <span>出題範囲</span>
            <div className="row wrap">
              <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')} type="button">すべて</button>
              <button className={filter === 'unlearned' ? 'chip active' : 'chip'} onClick={() => setFilter('unlearned')} type="button">未学習のみ</button>
              {MASTERY_LABELS.map((label, lv) => (
                <button
                  key={lv}
                  className={filter === lv ? 'chip active' : 'chip'}
                  onClick={() => setFilter(lv)}
                  type="button"
                >
                  {label}のみ
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>出題順</span>
            <div className="row wrap">
              <button className={order === 'low' ? 'chip active' : 'chip'} onClick={() => setOrder('low')} type="button">達成度が低い順</button>
              <button className={order === 'shuffle' ? 'chip active' : 'chip'} onClick={() => setOrder('shuffle')} type="button">シャッフル</button>
              <button className={order === 'created' ? 'chip active' : 'chip'} onClick={() => setOrder('created')} type="button">作成順</button>
              <button className={order === 'high' ? 'chip active' : 'chip'} onClick={() => setOrder('high')} type="button">達成度が高い順</button>
            </div>
          </div>

          <label className="row">
            <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} />
            問題と答えを入れ替える（一問一答のみ）
          </label>

          <p className="muted">
            対象{filtered.length}問中{appliedCount}問を出題
            {order === 'low' && '（達成度が低い順に並べた先頭から出題されます）'}
          </p>

          {order !== 'shuffle' && appliedCount > 0 && (
            <div>
              <p className="muted">プレビュー（先頭{Math.min(5, appliedCount)}問）</p>
              <ol>
                {orderedPreview.slice(0, Math.min(5, appliedCount)).map((c) => (
                  <li key={c.id}>
                    {c.question}{' '}
                    <span className="badge">{MASTERY_LABELS[masteryLevel(c)]}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="row">
            <button className="primary" disabled={appliedCount === 0} onClick={start} type="button">
              {appliedCount}問で学習を開始
            </button>
            <button onClick={onExit} type="button">戻る</button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 学習画面 ----------
  if (!current) return null
  const card = current.card
  const promptText = current.swapped ? (card.answer ?? '') : card.question
  const answerText = current.swapped ? card.question : (card.answer ?? '')
  const mm = Math.floor(seconds / 60)
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div>
      <div className="row space-between">
        <span>
          {index + 1} / {session.length} 問
        </span>
        <span className="badge">{CARD_TYPE_LABEL[card.type]}</span>
        <span>
          {mm}:{ss}
        </span>
      </div>
      <div className="panel">
        <h3 style={{ whiteSpace: 'pre-wrap' }}>{promptText}</h3>
        <button onClick={() => speak(promptText)} type="button">🔊 読み上げ</button>

        {card.type === 'qa' && (
          <div style={{ marginTop: 12 }}>
            {!revealed ? (
              <button className="primary" onClick={() => setRevealed(true)} type="button">
                答えを見る
              </button>
            ) : (
              <>
                <p className="answer-box">{answerText}</p>
                {card.explanation && <p className="muted">解説: {card.explanation}</p>}
                <div className="row">
                  <button className="primary" onClick={() => finishOne(true)} type="button">覚えた！</button>
                  <button onClick={() => finishOne(false)} type="button">まだ不安</button>
                </div>
              </>
            )}
          </div>
        )}

        {card.type === 'single' && (
          <div style={{ marginTop: 12 }}>
            {(card.choices ?? []).map((c, i) => (
              <label key={i} className="choice">
                <input
                  type="radio"
                  name="single"
                  checked={singleSel === i}
                  disabled={judged !== null}
                  onChange={() => setSingleSel(i)}
                />{' '}
                {c}
                {judged !== null && (card.correctIndices ?? []).includes(i) && ' ✓'}
              </label>
            ))}
            {judged === null ? (
              <button className="primary" disabled={singleSel === null} onClick={judgeChoice} type="button">解答する</button>
            ) : (
              <>
                <p className={judged ? 'ok' : 'ng'}>{judged ? '正解！' : '不正解'}</p>
                {card.explanation && <p className="muted">解説: {card.explanation}</p>}
                <button className="primary" onClick={() => finishOne(judged)} type="button">次へ</button>
              </>
            )}
          </div>
        )}

        {card.type === 'multi' && (
          <div style={{ marginTop: 12 }}>
            <p className="muted">正しいものをすべて選んでください（すべて一致で正解）</p>
            {(card.choices ?? []).map((c, i) => (
              <label key={i} className="choice">
                <input
                  type="checkbox"
                  checked={multiSel.includes(i)}
                  disabled={judged !== null}
                  onChange={() =>
                    setMultiSel((prev) =>
                      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
                    )
                  }
                />{' '}
                {c}
                {judged !== null && (card.correctIndices ?? []).includes(i) && ' ✓'}
              </label>
            ))}
            {judged === null ? (
              <button className="primary" disabled={multiSel.length === 0} onClick={judgeChoice} type="button">解答する</button>
            ) : (
              <>
                <p className={judged ? 'ok' : 'ng'}>{judged ? '正解！' : '不正解'}</p>
                {card.explanation && <p className="muted">解説: {card.explanation}</p>}
                <button className="primary" onClick={() => finishOne(judged)} type="button">次へ</button>
              </>
            )}
          </div>
        )}

        {card.type === 'blank' && (
          <div style={{ marginTop: 12 }}>
            <div className="row wrap">
              {(card.blankAnswers ?? []).map((_, i) => (
                <input
                  key={i}
                  value={blankInputs[i] ?? ''}
                  disabled={judged !== null}
                  onChange={(e) =>
                    setBlankInputs((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                  }
                  placeholder={`空欄 ${i + 1}`}
                />
              ))}
            </div>
            {judged === null ? (
              <button className="primary" onClick={judgeBlank} type="button">解答する</button>
            ) : (
              <>
                <p className={judged ? 'ok' : 'ng'}>
                  {judged ? '正解！' : `不正解（答え: ${(card.blankAnswers ?? []).join(' / ')}）`}
                </p>
                {card.explanation && <p className="muted">解説: {card.explanation}</p>}
                <button className="primary" onClick={() => finishOne(judged)} type="button">次へ</button>
              </>
            )}
          </div>
        )}
      </div>
      <button onClick={onExit} type="button">学習をやめる</button>
    </div>
  )
}
