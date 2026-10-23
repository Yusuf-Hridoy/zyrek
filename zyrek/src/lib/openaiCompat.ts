import type { AssayResult } from '../types/assay'
import { SYSTEM_PROMPT } from './gemini'
import { RateLimitError, type ProviderInfo } from './providers'
import { validateAssayResult } from './validate'

export const JSON_SHAPE_ADDENDUM = `Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "roleTitle": string,
  "company": string,
  "companyContext": string,
  "verdict": "STRONG MATCH" | "GOOD MATCH" | "PARTIAL MATCH" | "WEAK MATCH",
  "overallScore": integer 0-100,
  "summary": string,
  "dimensions": [ { "label": string, "score": integer 0-100, "note": string } ]  // exactly 5, labels: "Requirements match", "Evidence strength", "Domain familiarity", "Seniority and scope", "Keyword / ATS alignment"
  "reviewers": [ { "role": "RECRUITER" | "HIRING MGR" | "FACT-CHECK", "title": string, "comment": string } ]  // exactly 3, one per role, in that order
  "tailoredCv": string (markdown),
  "coverLetter": string,
  "formAnswers": [ { "question": string, "answer": string } ]  // exactly 3
  "signals": [ { "skill": string (1-4 words), "demand": "REQUIRED" | "PREFERRED", "evidence": "STRONG" | "WEAK" | "MISSING" } ]  // 8-14 entries, concrete skills/tools only, no soft skills
}`

export function extractJson(text: string): unknown {
  let cleaned = text.trim()
  cleaned = cleaned
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
  if (!cleaned.startsWith('{')) {
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first !== -1 && last !== -1 && last > first) {
      cleaned = cleaned.slice(first, last + 1)
    }
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('The model returned malformed JSON. Run Zyrek again.')
  }
}

export async function openaiCompatAssay(
  info: ProviderInfo,
  apiKey: string,
  resume: string,
  jobDescription: string,
): Promise<AssayResult> {
  const res = await fetch(`${info.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: info.model,
      // GPT-5.x rejects a non-default temperature with a 400
      ...(info.id === 'openai' ? {} : { temperature: 0.4 }),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT + '\n\n' + JSON_SHAPE_ADDENDUM,
        },
        {
          role: 'user',
          content:
            'MASTER RESUME:\n' + resume + '\n\n---\n\nJOB DESCRIPTION:\n' + jobDescription,
        },
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

  return validateAssayResult(extractJson(content))
}
