import type {
  InterviewPrep,
  PrepCategory,
  PrepConfidence,
  PrepQuestion,
} from '../types/assay'
import { anthropicJson } from './anthropic'
import { extractJson } from './openaiCompat'
import {
  PROVIDERS,
  PROVIDER_ORDER,
  RateLimitError,
  type ProviderId,
} from './providers'
import type { SavedAssay } from './storage'
import { unescapeArtifacts } from './validate'

export const PREP_SYSTEM_PROMPT = `You are an interview preparation expert. Given a candidate's master resume, a job description, and a list of skill signals (with evidence grades), produce a realistic interview prep pack for THIS specific job.

Rules:
- 10 to 14 questions a competent interview panel for this exact role would actually ask. No generic filler ("tell me about yourself" is allowed at most once, as BEHAVIORAL).
- Categories: GAP_PROBE = questions targeting skills where the candidate's evidence is WEAK or MISSING (use the provided signals; 3–5 of these), TECHNICAL = hands-on skill/tooling questions the JD implies, DOMAIN = industry/domain questions, BEHAVIORAL = experience and situation questions.
- whyAsked: one or two sentences naming what in the JD or resume triggers this question.
- answer: built ONLY from the real resume. Never invent projects, metrics, employers, or experience. For experience questions use labeled STAR beats, each on its own line: "Situation:", "Task:", "Action:", "Result:". For knowledge questions, direct talking points are fine. For GAP_PROBE questions where evidence is genuinely missing, the answer must be an honest acknowledgment plus a credible bridge (adjacent experience, how they'd close the gap) — never a fabricated claim.
- confidence: READY if the resume fully backs the answer; PRACTICE if it needs framing or rehearsal; RISKY if evidence is thin or missing.
- Answers are spoken-style, 60–140 words each. No markdown syntax beyond the STAR labels and line breaks.`

const PREP_ADDENDUM = `Respond with ONLY a single JSON object, no markdown fences, no commentary:
{ "questions": [ { "question": string, "category": "GAP_PROBE"|"TECHNICAL"|"DOMAIN"|"BEHAVIORAL", "whyAsked": string, "answer": string, "confidence": "READY"|"PRACTICE"|"RISKY" } ] }  // 10-14 entries`

const PREP_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          category: {
            type: 'STRING',
            enum: ['GAP_PROBE', 'TECHNICAL', 'DOMAIN', 'BEHAVIORAL'],
          },
          whyAsked: { type: 'STRING' },
          answer: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['READY', 'PRACTICE', 'RISKY'] },
        },
        required: ['question', 'category', 'whyAsked', 'answer', 'confidence'],
      },
    },
  },
  required: ['questions'],
}

const CATEGORIES: PrepCategory[] = ['GAP_PROBE', 'TECHNICAL', 'DOMAIN', 'BEHAVIORAL']
const CONFIDENCES: PrepConfidence[] = ['READY', 'PRACTICE', 'RISKY']

function buildUserContent(assay: SavedAssay, resume: string): string {
  const signals = assay.result.signals ?? []
  const signalsBlock =
    signals.length > 0
      ? signals
          .map((s) => `${s.skill} | ${s.demand} | ${s.evidence}`)
          .join('\n')
      : 'No signals available — infer likely gaps from the resume vs the JD.'
  return (
    'MASTER RESUME:\n' +
    resume +
    '\n\n---\n\nJOB DESCRIPTION:\n' +
    assay.jd +
    '\n\n---\n\nSKILL SIGNALS (skill | demand | evidence):\n' +
    signalsBlock +
    `\n\nROLE: ${assay.result.roleTitle} at ${assay.result.company}`
  )
}

async function prepGemini(
  apiKey: string,
  assay: SavedAssay,
  resume: string,
): Promise<InterviewPrep> {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      `${PROVIDERS.gemini.model}:generateContent?key=` +
      encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PREP_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildUserContent(assay, resume) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: PREP_RESPONSE_SCHEMA,
          temperature: 0.5,
        },
      }),
    },
  )

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const err = await res.json()
      if (err?.error?.message) message = err.error.message
    } catch {
      // keep the status-based message
    }
    if (res.status === 400 && /api key/i.test(message)) {
      throw new Error('Your API key looks invalid. Check it and try again.')
    }
    if (res.status === 429) {
      throw new RateLimitError('gemini', 'Gemini')
    }
    throw new Error(message)
  }

  const data = await res.json()
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('The model returned an empty response. Try again.')
  }
  return validatePrep(extractJson(text))
}

async function prepOpenAi(
  id: 'groq' | 'openai',
  apiKey: string,
  assay: SavedAssay,
  resume: string,
): Promise<InterviewPrep> {
  const info = PROVIDERS[id]
  const res = await fetch(`${info.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: info.model,
      // GPT-5.x rejects a non-default temperature with a 400
      ...(info.id === 'openai' ? {} : { temperature: 0.5 }),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: PREP_SYSTEM_PROMPT + '\n\n' + PREP_ADDENDUM,
        },
        { role: 'user', content: buildUserContent(assay, resume) },
      ],
    }),
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const err = await res.json()
      if (err?.error?.message) message = err.error.message
    } catch {
      // keep the status-based message
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Your ${info.label} API key looks invalid. Check it and try again.`,
      )
    }
    if (res.status === 429) {
      throw new RateLimitError(info.id, info.label)
    }
    if (res.status === 404) {
      throw new Error(
        `Model "${info.model}" was not found on ${info.label} — the provider may have retired it. Update the model id in src/lib/providers.ts.`,
      )
    }
    throw new Error(message)
  }

  const data = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('The model returned an empty response. Try again.')
  }
  return validatePrep(extractJson(content))
}

export function validatePrep(obj: unknown): InterviewPrep {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('The model returned an unusable prep pack. Try generating again.')
  }
  const raw = obj as { questions?: unknown }
  const questions: PrepQuestion[] = []
  if (Array.isArray(raw.questions)) {
    for (const q of raw.questions) {
      if (questions.length >= 16) break
      if (typeof q !== 'object' || q === null) continue
      const r = q as Record<string, unknown>
      if (
        typeof r.question !== 'string' ||
        !r.question.trim() ||
        typeof r.answer !== 'string' ||
        !r.answer.trim()
      ) {
        continue
      }
      questions.push({
        question: unescapeArtifacts(r.question.trim()),
        answer: unescapeArtifacts(r.answer.trim()),
        category: CATEGORIES.includes(r.category as PrepCategory)
          ? (r.category as PrepCategory)
          : 'TECHNICAL',
        whyAsked:
          typeof r.whyAsked === 'string' ? unescapeArtifacts(r.whyAsked) : '',
        confidence: CONFIDENCES.includes(r.confidence as PrepConfidence)
          ? (r.confidence as PrepConfidence)
          : 'PRACTICE',
      })
    }
  }
  if (questions.length < 5) {
    throw new Error('The model returned an unusable prep pack. Try generating again.')
  }
  return { generatedAt: Date.now(), questions }
}

export interface PrepOutcome {
  prep: InterviewPrep
  usedProvider: ProviderId
  fellBackFrom?: ProviderId
}

function isRateLimit(e: unknown): e is RateLimitError {
  return (
    e instanceof RateLimitError || (e instanceof Error && e.name === 'RateLimitError')
  )
}

export async function runPrep(
  active: ProviderId,
  keys: Partial<Record<ProviderId, string>>,
  assay: SavedAssay,
  resume: string,
): Promise<PrepOutcome> {
  const callOne = (id: ProviderId): Promise<InterviewPrep> => {
    const key = keys[id]!
    const info = PROVIDERS[id]
    if (info.kind === 'gemini') {
      return prepGemini(key, assay, resume)
    }
    if (info.kind === 'anthropic') {
      const system = PREP_SYSTEM_PROMPT + '\n\n' + PREP_ADDENDUM
      return anthropicJson(key, info.model, system, buildUserContent(assay, resume)).then(
        validatePrep,
      )
    }
    return prepOpenAi(id as 'groq' | 'openai', key, assay, resume)
  }

  try {
    const prep = await callOne(active)
    return { prep, usedProvider: active }
  } catch (e) {
    if (!isRateLimit(e)) throw e

    const fallbackId = PROVIDER_ORDER.find(
      (id) => id !== active && keys[id]?.trim(),
    )
    if (!fallbackId) {
      const hint = ' Add another provider key for automatic failover.'
      if (e instanceof RateLimitError && !e.message.includes(hint.trim())) {
        e.message = e.message + hint
      }
      throw e
    }

    try {
      const prep = await callOne(fallbackId)
      return { prep, usedProvider: fallbackId, fellBackFrom: active }
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(
        `${PROVIDERS[active].label} is rate-limited and the fallback (${PROVIDERS[fallbackId].label}) also failed: ${fallbackMessage}`,
      )
    }
  }
}
