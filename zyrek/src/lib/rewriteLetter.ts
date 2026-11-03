import { anthropicText } from './anthropic'
import {
  getModel,
  PROVIDERS,
  PROVIDER_ORDER,
  RateLimitError,
  type ProviderId,
} from './providers'
import { unescapeArtifacts } from './validate'

export const LETTER_SYSTEM_PROMPT = `You write one cover letter for a real job application. You receive a job description, the candidate's master resume, and the role/company name. Output ONLY the letter text — no subject line, no preamble, no commentary, no markdown fences.

HONESTY (absolute): use only facts present in the resume. Never invent skills, tools, metrics, dates, or experience. If the JD demands something the resume lacks, it simply stays out of the letter.

STRUCTURE — exactly three short paragraphs, blank line between them, 140–200 words total, greeting "Dear Hiring Team," (or the person named in the JD), sign-off "Best regards," + the candidate's name as written in the resume:
1. OPENER + CURRENT ROLE: first sentence states one concrete, verifiable fact from the candidate's current role that matches the JD's single most important requirement; the rest of the paragraph adds 1–2 more current-role specifics relevant to this JD.
2. CONNECT: mirror the JD's own wording for its top two requirements and reference ONE specific thing the posting says about the company or team, in plain words. Earlier roles: at most one past-tense sentence. Name the company exactly once in the letter.
3. CLOSER: one sentence offering something concrete to discuss or show.

BANNED in any wording: "I am excited to apply", "I am writing to express", "I came across your posting"; abstract thesis openers (anything about what quality/success "requires" or "depends on" in general); persona lines ("I do X for a living", "X is my passion", "As a passionate..."); "Thank you for your time and consideration"; "I am eager to contribute"; "I look forward to hearing from you".

STYLE: standard professional, plain everyday English, short sentences, active voice. At most FOUR tool/technology names in the whole letter. No rhetorical questions, no catchphrases.`

const MAX_LETTER_CHARS = 2500

function buildUserContent(
  jd: string,
  resume: string,
  roleTitle: string,
  company: string,
): string {
  return [
    `ROLE: ${roleTitle} at ${company}`,
    '',
    'JOB DESCRIPTION:',
    jd,
    '',
    '---',
    '',
    'MASTER RESUME:',
    resume,
  ].join('\n')
}

/** Plain-text output: trim, drop stray code fences and a leading subject line. */
function cleanLetter(raw: string): string {
  let text = unescapeArtifacts(raw).trim()
  text = text.replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/, '').trim()
  text = text.replace(/^(\*\*)?subject:.*(\r?\n)+/i, '').trim()
  if (!text) {
    throw new Error('The rewritten letter came back empty. Try again.')
  }
  if (text.length > MAX_LETTER_CHARS) {
    throw new Error('The rewritten letter came back far too long. Try again.')
  }
  return text
}

async function letterGemini(apiKey: string, user: string): Promise<string> {
  const model = getModel('gemini')
  // No responseMimeType / responseSchema: the letter is plain prose, not JSON.
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      `${encodeURIComponent(model)}:generateContent?key=` +
      encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: LETTER_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.5 },
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
      throw new Error('Your Gemini API key looks invalid. Check it in Settings.')
    }
    if (res.status === 429) {
      throw new RateLimitError('gemini', 'Gemini')
    }
    if (res.status === 404) {
      throw new Error(
        `Model "${model}" was not found on Gemini — the provider may have renamed or retired it. Change the model in Settings.`,
      )
    }
    throw new Error(`Gemini couldn't rewrite the letter: ${message} Try again.`)
  }

  const data = await res.json()
  const parts: { text?: string; thought?: boolean }[] =
    data?.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
  if (!text) {
    throw new Error('The model returned an empty response. Try again.')
  }
  return text
}

async function letterOpenAi(
  id: 'groq' | 'openai',
  apiKey: string,
  user: string,
): Promise<string> {
  const info = PROVIDERS[id]
  const model = getModel(id)
  const res = await fetch(`${info.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      // GPT-5.x rejects a non-default temperature with a 400
      ...(info.id === 'openai' ? {} : { temperature: 0.5 }),
      messages: [
        { role: 'system', content: LETTER_SYSTEM_PROMPT },
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
        `Your ${info.label} API key looks invalid. Check it in Settings.`,
      )
    }
    if (res.status === 429) {
      throw new RateLimitError(info.id, info.label)
    }
    if (res.status === 404) {
      throw new Error(
        `Model "${model}" was not found on ${info.label} — the provider may have renamed or retired it. Change the model in Settings.`,
      )
    }
    throw new Error(`${info.label} couldn't rewrite the letter: ${message} Try again.`)
  }

  const data = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('The model returned an empty response. Try again.')
  }
  return content
}

function isRateLimit(e: unknown): e is RateLimitError {
  return (
    e instanceof RateLimitError || (e instanceof Error && e.name === 'RateLimitError')
  )
}

/**
 * One dedicated, letter-only call (plain text, no JSON mode) with the same
 * one-shot failover as the other features: only on RateLimitError.
 */
export async function rewriteLetter(
  active: ProviderId,
  keys: Partial<Record<ProviderId, string>>,
  jd: string,
  masterResume: string,
  roleTitle: string,
  company: string,
): Promise<string> {
  const user = buildUserContent(jd, masterResume, roleTitle, company)
  const callOne = (id: ProviderId): Promise<string> => {
    const key = keys[id]!
    const info = PROVIDERS[id]
    if (info.kind === 'gemini') {
      return letterGemini(key, user).then(cleanLetter)
    }
    if (info.kind === 'anthropic') {
      return anthropicText(key, getModel(id), LETTER_SYSTEM_PROMPT, user).then(
        cleanLetter,
      )
    }
    return letterOpenAi(id as 'groq' | 'openai', key, user).then(cleanLetter)
  }

  if (!keys[active]?.trim()) {
    throw new Error(
      `No ${PROVIDERS[active].label} key saved. Add one in Settings, then rewrite.`,
    )
  }

  try {
    return await callOne(active)
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
      return await callOne(fallbackId)
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(
        `${PROVIDERS[active].label} is rate-limited and the fallback (${PROVIDERS[fallbackId].label}) also failed: ${fallbackMessage}`,
      )
    }
  }
}
