/**
 * AI問題生成のプロバイダ層。
 *
 * ★ モデル/プロバイダを差し替えるときは、このファイルだけを変更してください。
 * 画面側（components/AiPanel.tsx）は generateQuestions() と
 * isAiConfigured() しか呼びません。
 *
 * 既定の実装は OpenAI互換の Chat Completions エンドポイントを想定し、
 * 設定は Vite の環境変数から読みます:
 *   VITE_AI_API_URL  ベースURL (例 https://api.openai.com/v1)
 *                    末尾が /chat/completions の完全なURLでも可
 *   VITE_AI_API_KEY  APIキー
 *   VITE_AI_MODEL    モデル名
 *
 * 別の形式のAPI（独自形式など）を使う場合は、generateQuestions() の
 * 中のリクエスト組み立てとレスポンス解析を差し替えてください。
 */
import type { CardType } from '../types'

export interface GeneratedQuestion {
  type: CardType
  question: string
  answer?: string
  choices?: string[]
  correctIndices?: number[]
  blankAnswers?: string[]
  explanation?: string
}

export interface AiImageInput {
  name: string
  /** data URL (data:image/...;base64,...) */
  dataUrl: string
}

export type AiFormat = 'auto' | CardType

export interface GenerateInput {
  text: string
  images?: AiImageInput[]
  format?: AiFormat
  focus?: string
}

export interface GenerateResult {
  questions: GeneratedQuestion[]
  note: string
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      'AIが未設定です。.env に VITE_AI_API_URL / VITE_AI_API_KEY / VITE_AI_MODEL を設定してから開発サーバーを再起動してください。設定方法は README を参照してください。',
    )
    this.name = 'AiNotConfiguredError'
  }
}

interface AiConfig {
  apiUrl: string
  apiKey: string
  model: string
}

export function getAiConfig(): AiConfig | null {
  const apiUrl = (import.meta.env.VITE_AI_API_URL as string | undefined)?.trim()
  const apiKey = (import.meta.env.VITE_AI_API_KEY as string | undefined)?.trim()
  const model = (import.meta.env.VITE_AI_MODEL as string | undefined)?.trim()
  if (!apiUrl || !apiKey || !model) return null
  return { apiUrl, apiKey, model }
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null
}

function endpoint(apiUrl: string): string {
  if (apiUrl.endsWith('/chat/completions')) return apiUrl
  return apiUrl.replace(/\/$/, '') + '/chat/completions'
}

const SYSTEM_PROMPT = `あなたは学習用の問題を作る専門家です。与えられた素材の内容だけをもとに問題を作ってください。
- 問題数は素材の量と大事なポイントの多さに合わせて自分で判断してください。上限は50問です。水増しは禁止です。素材が少なければ少なめで構いません。
- 出力は JSON のみ。説明文やコードフェンスは付けないでください。
- JSON の形式: {"questions":[{"type":"qa"|"single"|"multi"|"blank","question":"...","answer":"...","choices":["..."],"correctIndices":[0],"blankAnswers":["..."],"explanation":"..."}]}
- qa: answer に答えを入れる。choices/correctIndices/blankAnswers は省略。
- single: choices 2〜6個、correctIndices は正解1つ。
- multi: choices 2〜8個、correctIndices は正解をすべて（2つ以上が望ましい）。
- blank: question の空欄部分を ___ と書き、blankAnswers に空欄の答えを順番通り入れる。複数空欄可。
- 各問題に explanation（短い解説）を付けてください。`

export async function generateQuestions(input: GenerateInput): Promise<GenerateResult> {
  const config = getAiConfig()
  if (!config) throw new AiNotConfiguredError()

  const formatInstruction =
    !input.format || input.format === 'auto'
      ? '問題形式は内容に合わせて混ぜて構いません。'
      : `問題形式は ${input.format} に統一してください。`
  const focusInstruction = input.focus?.trim()
    ? `重点ポイント: ${input.focus.trim()}`
    : ''

  const userContent: unknown[] = [
    {
      type: 'text',
      text: [formatInstruction, focusInstruction, '素材:', input.text || '(文章なし。画像を参照してください)']
        .filter(Boolean)
        .join('\n'),
    },
  ]
  for (const img of (input.images ?? []).slice(0, 3)) {
    userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } })
  }

  const res = await fetch(endpoint(config.apiUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    throw new Error(`AIの呼び出しに失敗しました (HTTP ${res.status})。APIキーやモデル名を確認してください。`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content ?? ''
  const questions = parseQuestions(content).slice(0, 50)
  if (questions.length === 0) {
    throw new Error('AIの応答から問題を読み取れませんでした。素材を変えてもう一度お試しください。')
  }
  return {
    questions,
    note: `AIが素材の量と内容に合わせて問題数を判断し、${questions.length}問を作成しました。最初はすべて選択されています。不要な問題はチェックを外してください。`,
  }
}

function parseQuestions(content: string): GeneratedQuestion[] {
  const cleaned = content.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < 0) return []
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      questions?: GeneratedQuestion[]
    }
    if (!Array.isArray(parsed.questions)) return []
    return parsed.questions.filter(
      (q) => q && typeof q.question === 'string' && q.question.trim().length > 0,
    )
  } catch {
    return []
  }
}
