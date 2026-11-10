import { useState } from 'react'
import type { Card } from '../types'
import { CARD_TYPE_LABEL, uid } from '../types'
import {
  AiNotConfiguredError,
  generateQuestions,
  isAiConfigured,
  type AiFormat,
  type AiImageInput,
  type GeneratedQuestion,
} from '../ai/provider'

interface Props {
  deckId: string
  onAdd: (cards: Card[]) => void
  onClose: () => void
}

interface PreviewItem extends GeneratedQuestion {
  selected: boolean
}

export default function AiPanel({ deckId, onAdd, onClose }: Props) {
  const configured = isAiConfigured()
  const [text, setText] = useState('')
  const [images, setImages] = useState<AiImageInput[]>([])
  const [format, setFormat] = useState<AiFormat>('auto')
  const [focus, setFocus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)

  async function handleTextFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      const content = await file.text()
      setText((prev) => (prev ? prev + '\n' : '') + content)
    }
  }

  async function handleImages(files: FileList | null) {
    if (!files) return
    const next: AiImageInput[] = []
    for (const file of Array.from(files).slice(0, 3)) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      next.push({ name: file.name, dataUrl })
    }
    setImages(next.slice(0, 3))
  }

  async function generate() {
    setError('')
    setBusy(true)
    try {
      const result = await generateQuestions({
        text,
        images,
        format,
        focus,
      })
      // プレビューは最初は全選択で開く
      setPreview(result.questions.map((q) => ({ ...q, selected: true })))
      setNote(result.note)
    } catch (e) {
      if (e instanceof AiNotConfiguredError) setError(e.message)
      else setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  function updatePreview(i: number, patch: Partial<PreviewItem>) {
    setPreview((prev) =>
      prev ? prev.map((p, j) => (j === i ? { ...p, ...patch } : p)) : prev,
    )
  }

  function addSelected() {
    if (!preview) return
    const cards: Card[] = preview
      .filter((p) => p.selected)
      .map((p) => ({
        id: uid(),
        deckId,
        type: p.type,
        question: p.question,
        answer: p.answer,
        choices: p.choices,
        correctIndices: p.correctIndices,
        blankAnswers: p.blankAnswers,
        explanation: p.explanation,
        attempts: 0,
        correct: 0,
        createdAt: Date.now(),
      }))
    if (cards.length > 0) onAdd(cards)
    onClose()
  }

  const selectedCount = preview?.filter((p) => p.selected).length ?? 0

  return (
    <div className="panel">
      <div className="row space-between">
        <h3>AIで問題を作成</h3>
        <button onClick={onClose} type="button">閉じる</button>
      </div>

      {!configured && (
        <p className="warn">
          AIが未設定です。.env に VITE_AI_API_URL / VITE_AI_API_KEY /
          VITE_AI_MODEL を設定すると使えるようになります（README参照）。
          未設定でも、手動での問題追加など他の機能は使えます。
        </p>
      )}

      <p className="muted">
        問題数：AIにおまかせ（素材の量と大事なポイントから判断します。上限50問）
        <br />
        PDFは直接読み込めません。必要なページのスクリーンショット画像を使ってください。
      </p>

      <label className="field">
        文章を貼り付け
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
      </label>

      <div className="row wrap">
        <label className="file-btn">
          テキストファイルを選ぶ (.txt/.md/.csv)
          <input
            type="file"
            accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
            multiple
            hidden
            onChange={(e) => handleTextFiles(e.target.files)}
          />
        </label>
        <label className="file-btn">
          画像を選ぶ（最大3枚）
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleImages(e.target.files)}
          />
        </label>
        {images.length > 0 && (
          <span className="muted">画像 {images.length}枚: {images.map((i) => i.name).join(', ')}</span>
        )}
      </div>

      <div className="row wrap">
        <label>
          形式{' '}
          <select value={format} onChange={(e) => setFormat(e.target.value as AiFormat)}>
            <option value="auto">おまかせ</option>
            <option value="qa">一問一答</option>
            <option value="single">選択問題</option>
            <option value="multi">複数選択</option>
            <option value="blank">穴埋め</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          重点ポイント（任意）{' '}
          <input value={focus} onChange={(e) => setFocus(e.target.value)} style={{ width: '100%' }} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      <button
        className="primary"
        disabled={busy || (!text.trim() && images.length === 0)}
        onClick={generate}
        type="button"
      >
        {busy ? '生成中…' : 'AIで生成する'}
      </button>

      {preview && (
        <div style={{ marginTop: 16 }}>
          <h4>
            プレビュー（{preview.length}問中{selectedCount}問を選択中）
          </h4>
          {note && <p className="muted">{note}</p>}
          {preview.map((p, i) => (
            <div key={i} className={p.selected ? 'preview-item' : 'preview-item deselected'}>
              <label className="row">
                <input
                  type="checkbox"
                  checked={p.selected}
                  onChange={(e) => updatePreview(i, { selected: e.target.checked })}
                />
                <strong>
                  {i + 1}. [{CARD_TYPE_LABEL[p.type]}]
                </strong>
                {!p.selected && <span className="muted">追加しない</span>}
              </label>
              <textarea
                value={p.question}
                rows={2}
                onChange={(e) => updatePreview(i, { question: e.target.value })}
              />
              {p.type === 'qa' && (
                <input
                  value={p.answer ?? ''}
                  placeholder="答え"
                  onChange={(e) => updatePreview(i, { answer: e.target.value })}
                />
              )}
              {(p.type === 'single' || p.type === 'multi') && p.choices && (
                <ul className="plain">
                  {p.choices.map((c, j) => (
                    <li key={j}>
                      {(p.correctIndices ?? []).includes(j) ? '✓ ' : '　'}
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              {p.type === 'blank' && p.blankAnswers && (
                <p className="muted">答え: {p.blankAnswers.join(' / ')}</p>
              )}
              <input
                value={p.explanation ?? ''}
                placeholder="解説"
                onChange={(e) => updatePreview(i, { explanation: e.target.value })}
              />
            </div>
          ))}
          <button
            className="primary"
            disabled={selectedCount === 0}
            onClick={addSelected}
            type="button"
          >
            選択した{selectedCount}問を追加
          </button>
        </div>
      )}
    </div>
  )
}
