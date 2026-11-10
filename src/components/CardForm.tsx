import { useState } from 'react'
import type { Card, CardType } from '../types'
import { CARD_TYPE_LABEL, uid } from '../types'

interface Props {
  deckId: string
  initial?: Card | null
  onSave: (card: Card) => void
  onCancel?: () => void
}

export default function CardForm({ deckId, initial, onSave, onCancel }: Props) {
  const [type, setType] = useState<CardType>(initial?.type ?? 'qa')
  const [question, setQuestion] = useState(initial?.question ?? '')
  const [answer, setAnswer] = useState(initial?.answer ?? '')
  const [choices, setChoices] = useState<string[]>(
    initial?.choices ?? ['', '', '', ''],
  )
  const [correct, setCorrect] = useState<number[]>(initial?.correctIndices ?? [0])
  const [blankAnswersText, setBlankAnswersText] = useState(
    (initial?.blankAnswers ?? []).join('\n'),
  )
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [error, setError] = useState('')

  const maxChoices = type === 'multi' ? 8 : 6
  const minChoices = 2

  function toggleCorrect(i: number) {
    if (type === 'single') setCorrect([i])
    else
      setCorrect((prev) =>
        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort(),
      )
  }

  function submit() {
    if (!question.trim()) return setError('問題を入力してください')
    const base: Card = {
      id: initial?.id ?? uid(),
      deckId,
      type,
      question: question.trim(),
      explanation: explanation.trim() || undefined,
      attempts: initial?.attempts ?? 0,
      correct: initial?.correct ?? 0,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    if (type === 'qa') {
      if (!answer.trim()) return setError('答えを入力してください')
      base.answer = answer.trim()
    } else if (type === 'single' || type === 'multi') {
      const cleaned = choices.map((c) => c.trim())
      if (cleaned.some((c) => !c)) return setError('選択肢はすべて入力してください')
      if (correct.length === 0) return setError('正解を選んでください')
      if (type === 'single' && correct.length !== 1)
        return setError('選択問題の正解は1つだけ選んでください')
      base.choices = cleaned
      base.correctIndices = [...correct].sort((a, b) => a - b)
    } else if (type === 'blank') {
      const blanks = blankAnswersText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const blankCount = (question.match(/___/g) ?? []).length
      if (blankCount === 0)
        return setError('問題文に ___ （アンダースコア3つ）で空欄を作ってください')
      if (blanks.length !== blankCount)
        return setError(`空欄は${blankCount}個あります。答えを${blankCount}行入力してください`)
      base.blankAnswers = blanks
    }
    setError('')
    onSave(base)
  }

  return (
    <div className="panel">
      <div className="row wrap">
        {(Object.keys(CARD_TYPE_LABEL) as CardType[]).map((t) => (
          <button
            key={t}
            className={type === t ? 'chip active' : 'chip'}
            onClick={() => {
              setType(t)
              if (t === 'single') setCorrect([correct[0] ?? 0])
            }}
            type="button"
          >
            {CARD_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <label className="field">
        問題
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={type === 'blank' ? 3 : 2}
          placeholder={
            type === 'blank' ? '例: 日本の首都は ___ です' : '問題文を入力'
          }
        />
      </label>

      {type === 'qa' && (
        <label className="field">
          答え
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
      )}

      {(type === 'single' || type === 'multi') && (
        <div className="field">
          <span>
            選択肢（{type === 'single' ? '正解は1つ' : '正解は複数可・全一致で正解'}）
          </span>
          {choices.map((c, i) => (
            <div key={i} className="row">
              <input
                type={type === 'single' ? 'radio' : 'checkbox'}
                checked={correct.includes(i)}
                onChange={() => toggleCorrect(i)}
                aria-label={`選択肢${i + 1}を正解にする`}
              />
              <input
                value={c}
                onChange={(e) =>
                  setChoices(choices.map((x, j) => (j === i ? e.target.value : x)))
                }
                placeholder={`選択肢 ${i + 1}`}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                disabled={choices.length <= minChoices}
                onClick={() => {
                  setChoices(choices.filter((_, j) => j !== i))
                  setCorrect(
                    correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)),
                  )
                }}
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={choices.length >= maxChoices}
            onClick={() => setChoices([...choices, ''])}
          >
            選択肢を追加（最大{maxChoices}）
          </button>
        </div>
      )}

      {type === 'blank' && (
        <label className="field">
          空欄の答え（1行に1つ、___ の順番通り）
          <textarea
            value={blankAnswersText}
            onChange={(e) => setBlankAnswersText(e.target.value)}
            rows={3}
          />
        </label>
      )}

      <label className="field">
        解説（任意）
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
        />
      </label>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" onClick={submit} type="button">
          {initial ? '保存する' : '問題を追加する'}
        </button>
        {onCancel && (
          <button onClick={onCancel} type="button">
            キャンセル
          </button>
        )}
      </div>
    </div>
  )
}
