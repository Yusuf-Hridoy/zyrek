import { anthropicJson } from './anthropic'
import { extractJson } from './openaiCompat'
import {
  PROVIDERS,
  PROVIDER_ORDER,
  RateLimitError,
  type ProviderId,
} from './providers'
import {
  appliedBaseline,
  interviewBaseline,
  DAY_MS,
} from './radar'
import type { SavedAssay } from './storage'
import { unescapeArtifacts } from './validate'

export const FOLLOWUP_SYSTEM_PROMPT = `You write short, professional follow-up messages for job applicants. Rules:
- Under 130 words. Plain text, no markdown. Warm, confident, never desperate or apologetic.
- Reference the exact role and company, and roughly when the candidate applied or interviewed (e.g. 'about two weeks ago') — compute from the data given, never invent dates.
- APPLIED stage: politely confirm continued interest, add ONE concrete value line drawn from the resume that matches this role, ask about timeline. INTERVIEW stage: thank them for the conversation, reaffirm interest with one specific point, ask about next steps.
- Address the contact by first name if provided, else a neutral greeting ('Hi there' / 'Hello').
- Sign off with the candidate's name from the resume.
- Never fabricate anything not present in the provided data.
Respond with ONLY a JSON object: { "subject": string, "body": string } — subject under 10 words.`

const FOLLOWUP_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    subject: { type: 'STRING' },
    body: { type: 'STRING' },
  },
  required: ['subject', 'body'],
}

export interface FollowUpDraft {
  subject: string
  body: string
}

export interface FollowUpOutcome {
  draft: FollowUpDraft
  usedProvider: ProviderId
  fellBackFrom?: ProviderId
}

function buildUserContent(assay: SavedAssay, resume: string, now: number): string {
  const isInterview = assay.status === 'INTERVIEW'
  const baseline = isInterview ? interviewBaseline(assay) : appliedBaseline(assay)
  const daysSince = Math.max(0, Math.floor((now - baseline) / DAY_MS))
  const contactName = assay.contact?.name?.trim()
  return [
    `ROLE: ${assay.result.roleTitle} at ${assay.result.company}`,
    `STAGE: ${isInterview ? 'interviewed' : 'applied'} — about ${daysSince} days ago`,
    contactName ? `CONTACT NAME: ${contactName}` : 'CONTACT NAME: (not provided)',
    '',
    'MASTER RESUME:',
    resume,
  ].join('\n')
}

function validateDraft(obj: unknown): FollowUpDraft {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('The model returned an unusable draft. Try again.')
  }
  const raw = obj as { subject?: unknown; body?: unknown }
  if (
    typeof raw.subject !== 'string' ||
    !raw.subject.trim() ||
    typeof raw.body !== 'string' ||
    !raw.body.trim()
  ) {
    throw new Error('The model returned an unusable draft. Try again.')
  }
  return {
    subject: unescapeArtifacts(raw.subject.trim()).slice(0, 90),
    body: unescapeArtifacts(raw.body.trim()),
  }
}

async function followUpGemini(
  apiKey: string,
  user: string,
): Promise<FollowUpDraft> {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      `${PROVIDERS.gemini.model}:generateContent?key=` +
      encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: FOLLOWUP_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: FOLLOWUP_RESPONSE_SCHEMA,
          temperature: 0.6,
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
  return validateDraft(extractJson(text))
}

async function followUpOpenAi(
  id: 'groq' | 'openai',
  apiKey: string,
  user: string,
): Promise<FollowUpDraft> {
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
      ...(info.id === 'openai' ? {} : { temperature: 0.6 }),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: FOLLOWUP_SYSTEM_PROMPT },
        { role: 'user', content: user },
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
  return validateDraft(extractJson(content))
}

function isRateLimit(e: unknown): e is RateLimitError {
  return (
    e instanceof RateLimitError || (e instanceof Error && e.name === 'RateLimitError')
  )
}

export async function runFollowUp(
  active: ProviderId,
  keys: Partial<Record<ProviderId, string>>,
  assay: SavedAssay,
  resume: string,
  now: number,
): Promise<FollowUpOutcome> {
  const user = buildUserContent(assay, resume, now)
  const callOne = (id: ProviderId): Promise<FollowUpDraft> => {
    const key = keys[id]!
    const info = PROVIDERS[id]
    if (info.kind === 'gemini') {
      return followUpGemini(key, user)
    }
    if (info.kind === 'anthropic') {
      return anthropicJson(key, info.model, FOLLOWUP_SYSTEM_PROMPT, user).then(
        validateDraft,
      )
    }
    return followUpOpenAi(id as 'groq' | 'openai', key, user)
  }

  try {
    const draft = await callOne(active)
    return { draft, usedProvider: active }
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
      const draft = await callOne(fallbackId)
      return { draft, usedProvider: fallbackId, fellBackFrom: active }
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(
        `${PROVIDERS[active].label} is rate-limited and the fallback (${PROVIDERS[fallbackId].label}) also failed: ${fallbackMessage}`,
      )
    }
  }
}
