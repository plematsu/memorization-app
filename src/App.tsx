import { useEffect, useMemo, useState } from 'react'
import type { AppData, Card, Deck } from './types'
import { uid } from './types'
import { loadData, saveData } from './storage'
import { deckMastery } from './mastery'
import DeckDetail from './components/DeckDetail'
import Study from './components/Study'

type View = { kind: 'list' } | { kind: 'deck'; deckId: string } | { kind: 'study'; deckId: string }

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [view, setView] = useState<View>({ kind: 'list' })
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [showNewDeck, setShowNewDeck] = useState(false)

  useEffect(() => {
    saveData(data)
  }, [data])

  const cardsOf = (deckId: string) =>
    data.cards.filter((c) => c.deckId === deckId).sort((a, b) => a.createdAt - b.createdAt)

  const currentDeck: Deck | undefined =
    view.kind !== 'list' ? data.decks.find((d) => d.id === view.deckId) : undefined

  const deckStats = useMemo(() => {
    const map = new Map<string, { count: number; masteryRate: number }>()
    for (const d of data.decks) {
      const cs = data.cards.filter((c) => c.deckId === d.id)
      map.set(d.id, { count: cs.length, masteryRate: deckMastery(cs).masteryRate })
    }
    return map
  }, [data])

  function createDeck() {
    if (!newTitle.trim()) return
    const deck: Deck = {
      id: uid(),
      title: newTitle.trim(),
      description: newDesc.trim(),
      createdAt: Date.now(),
    }
    setData((d) => ({ ...d, decks: [...d.decks, deck] }))
    setNewTitle('')
    setNewDesc('')
    setShowNewDeck(false)
    setView({ kind: 'deck', deckId: deck.id })
  }

  function recordResult(cardId: string, isCorrect: boolean) {
    setData((d) => ({
      ...d,
      cards: d.cards.map((c) =>
        c.id === cardId
          ? { ...c, attempts: c.attempts + 1, correct: c.correct + (isCorrect ? 1 : 0) }
          : c,
      ),
    }))
  }

  return (
    <div className="container">
      <header>
        <h1>暗記アプリ</h1>
        <p className="muted">自分だけの問題集を作成・解答・復習できる学習アプリ</p>
      </header>

      {view.kind === 'list' && (
        <main>
          <div className="row space-between">
            <h2>問題集</h2>
            <button className="primary" onClick={() => setShowNewDeck(!showNewDeck)} type="button">
              ＋ 問題集を作成
            </button>
          </div>

          {showNewDeck && (
            <div className="panel">
              <label className="field">
                問題集のタイトル
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </label>
              <label className="field">
                説明文（任意）
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
              </label>
              <button className="primary" disabled={!newTitle.trim()} onClick={createDeck} type="button">
                問題集を作成
              </button>
            </div>
          )}

          {data.decks.length === 0 && !showNewDeck && (
            <p className="muted">まだ問題集がありません。まずは問題集を1つ作るところから始めてください。</p>
          )}

          <ul className="deck-list">
            {data.decks.map((d) => {
              const st = deckStats.get(d.id)
              return (
                <li key={d.id}>
                  <button className="deck-card" onClick={() => setView({ kind: 'deck', deckId: d.id })} type="button">
                    <strong>{d.title}</strong>
                    {d.description && <span className="muted">{d.description}</span>}
                    <span className="muted">
                      {st?.count ?? 0}問・達成度{st?.masteryRate ?? 0}%
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </main>
      )}

      {view.kind === 'deck' && currentDeck && (
        <main>
          <DeckDetail
            deck={currentDeck}
            cards={cardsOf(currentDeck.id)}
            onBack={() => setView({ kind: 'list' })}
            onUpdateDeck={(deck) =>
              setData((d) => ({ ...d, decks: d.decks.map((x) => (x.id === deck.id ? deck : x)) }))
            }
            onDeleteDeck={() => {
              setData((d) => ({
                decks: d.decks.filter((x) => x.id !== currentDeck.id),
                cards: d.cards.filter((c) => c.deckId !== currentDeck.id),
              }))
              setView({ kind: 'list' })
            }}
            onAddCard={(card: Card) => setData((d) => ({ ...d, cards: [...d.cards, card] }))}
            onAddCards={(newCards: Card[]) =>
              setData((d) => ({ ...d, cards: [...d.cards, ...newCards] }))
            }
            onUpdateCard={(card) =>
              setData((d) => ({ ...d, cards: d.cards.map((c) => (c.id === card.id ? card : c)) }))
            }
            onDeleteCard={(cardId) =>
              setData((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== cardId) }))
            }
            onResetProgress={() =>
              setData((d) => ({
                ...d,
                cards: d.cards.map((c) =>
                  c.deckId === currentDeck.id ? { ...c, attempts: 0, correct: 0 } : c,
                ),
              }))
            }
            onStudy={() => setView({ kind: 'study', deckId: currentDeck.id })}
          />
        </main>
      )}

      {view.kind === 'study' && currentDeck && (
        <main>
          <Study
            deckTitle={currentDeck.title}
            cards={cardsOf(currentDeck.id)}
            onRecord={recordResult}
            onExit={() => setView({ kind: 'deck', deckId: currentDeck.id })}
          />
        </main>
      )}
    </div>
  )
}
