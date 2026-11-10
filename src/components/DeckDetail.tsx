import { useMemo, useState } from 'react'
import type { Card, Deck } from '../types'
import { CARD_TYPE_LABEL, uid } from '../types'
import { MASTERY_LABELS, MASTERY_STARS, correctRate, deckMastery, masteryLevel } from '../mastery'
import CardForm from './CardForm'
import AiPanel from './AiPanel'

interface Props {
  deck: Deck
  cards: Card[]
  onBack: () => void
  onUpdateDeck: (deck: Deck) => void
  onDeleteDeck: () => void
  onAddCard: (card: Card) => void
  onAddCards: (cards: Card[]) => void
  onUpdateCard: (card: Card) => void
  onDeleteCard: (cardId: string) => void
  onResetProgress: () => void
  onStudy: () => void
}

export default function DeckDetail(props: Props) {
  const { deck, cards } = props
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [editing, setEditing] = useState<Card | null>(null)
  const [editingDeck, setEditingDeck] = useState(false)
  const [title, setTitle] = useState(deck.title)
  const [description, setDescription] = useState(deck.description)
  const [levelFilter, setLevelFilter] = useState<'all' | number>('all')

  const { counts, masteryRate } = useMemo(() => deckMastery(cards), [cards])
  const visible = useMemo(
    () =>
      levelFilter === 'all'
        ? cards
        : cards.filter((c) => masteryLevel(c) === levelFilter),
    [cards, levelFilter],
  )

  function bulkImport() {
    const newCards: Card[] = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('|'))
      .map((line) => {
        const [q, ...rest] = line.split('|')
        return {
          id: uid(),
          deckId: deck.id,
          type: 'qa' as const,
          question: q.trim(),
          answer: rest.join('|').trim(),
          attempts: 0,
          correct: 0,
          createdAt: Date.now(),
        }
      })
      .filter((c) => c.question && c.answer)
    if (newCards.length) props.onAddCards(newCards)
    setBulkText('')
    setShowBulk(false)
  }

  return (
    <div>
      <button onClick={props.onBack} type="button">← 問題集一覧</button>

      {editingDeck ? (
        <div className="panel">
          <label className="field">タイトル<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field">説明<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></label>
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                props.onUpdateDeck({ ...deck, title: title.trim() || deck.title, description })
                setEditingDeck(false)
              }}
              type="button"
            >保存</button>
            <button onClick={() => setEditingDeck(false)} type="button">キャンセル</button>
          </div>
        </div>
      ) : (
        <>
          <h2>{deck.title}</h2>
          {deck.description && <p className="muted">{deck.description}</p>}
          <div className="row wrap">
            <button onClick={() => setEditingDeck(true)} type="button">問題集を編集</button>
            <button
              onClick={() => {
                if (window.confirm('この問題集と問題をすべて削除しますか？')) props.onDeleteDeck()
              }}
              type="button"
            >問題集を削除</button>
            <button
              onClick={() => {
                if (window.confirm('この問題集の学習記録をリセットしますか？')) props.onResetProgress()
              }}
              type="button"
            >学習記録をリセット</button>
          </div>
        </>
      )}

      <div className="panel">
        <h3>達成度 {masteryRate}%</h3>
        <div className="mastery-bar">
          {counts.map((n, lv) =>
            n > 0 ? (
              <div key={lv} className={`seg seg-${lv}`} style={{ flexGrow: n }} title={`${MASTERY_LABELS[lv]} ${n}問`}>
                {n}
              </div>
            ) : null,
          )}
          {cards.length === 0 && <span className="muted">まだ問題がありません</span>}
        </div>
        <div className="row wrap">
          {MASTERY_LABELS.map((label, lv) => (
            <button
              key={lv}
              className={levelFilter === lv ? 'chip active' : 'chip'}
              onClick={() => setLevelFilter(levelFilter === lv ? 'all' : lv)}
              type="button"
            >
              {label} {counts[lv]}問
            </button>
          ))}
        </div>
      </div>

      <div className="row wrap">
        <button className="primary" disabled={cards.length === 0} onClick={props.onStudy} type="button">
          学習を開始
        </button>
        <button onClick={() => { setShowForm(!showForm); setEditing(null) }} type="button">問題を追加する</button>
        <button onClick={() => setShowBulk(!showBulk)} type="button">テキスト一括入力</button>
        <button onClick={() => setShowAi(!showAi)} type="button">AIで問題を作成</button>
      </div>

      {showAi && (
        <AiPanel deckId={deck.id} onAdd={props.onAddCards} onClose={() => setShowAi(false)} />
      )}

      {showBulk && (
        <div className="panel">
          <p className="muted">1行に1問、「問題|答え」の形式で入力してください（一問一答として追加されます）</p>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} style={{ width: '100%' }} />
          <button className="primary" onClick={bulkImport} type="button">一括で追加</button>
        </div>
      )}

      {(showForm || editing) && (
        <CardForm
          deckId={deck.id}
          initial={editing}
          onSave={(card) => {
            if (editing) props.onUpdateCard(card)
            else props.onAddCard(card)
            setShowForm(false)
            setEditing(null)
          }}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      <h3>問題一覧（{visible.length}問）</h3>
      {visible.length === 0 && <p className="muted">問題がありません。「問題を追加する」から作ってください。</p>}
      <ul className="card-list">
        {visible.map((c) => {
          const lv = masteryLevel(c)
          const rate = correctRate(c)
          return (
            <li key={c.id} className="card-item">
              <div style={{ flex: 1 }}>
                <span className="badge">{CARD_TYPE_LABEL[c.type]}</span>{' '}
                <span className="badge">{MASTERY_LABELS[lv]} {MASTERY_STARS[lv]}</span>
                <div style={{ whiteSpace: 'pre-wrap' }}>{c.question}</div>
                <div className="muted">
                  {c.attempts}回挑戦{rate !== null ? `・正解率${Math.round(rate * 100)}%` : ''}
                </div>
              </div>
              <div className="row">
                <button onClick={() => { setEditing(c); setShowForm(false) }} type="button">編集</button>
                <button
                  onClick={() => {
                    if (window.confirm('この問題を削除しますか？')) props.onDeleteCard(c.id)
                  }}
                  type="button"
                >削除</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
