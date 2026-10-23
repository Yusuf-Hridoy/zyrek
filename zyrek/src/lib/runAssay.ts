import type { AssayResult } from '../types/assay'
import { anthropicJson } from './anthropic'
import { assayApplication, SYSTEM_PROMPT } from './gemini'
import { JSON_SHAPE_ADDENDUM, openaiCompatAssay } from './openaiCompat'
import {
  PROVIDERS,
  PROVIDER_ORDER,
  RateLimitError,
  type ProviderId,
} from './providers'
import { validateAssayResult } from './validate'

export interface RunOutcome {
  result: AssayResult
  usedProvider: ProviderId
  fellBackFrom?: ProviderId
}

function isRateLimit(e: unknown): e is RateLimitError {
  return e instanceof RateLimitError || (e instanceof Error && e.name === 'RateLimitError')
}

export async function runAssay(
  active: ProviderId,
  keys: Partial<Record<ProviderId, string>>,
  resume: string,
  jd: string,
): Promise<RunOutcome> {
  const callOne = (id: ProviderId): Promise<AssayResult> => {
    const key = keys[id]!
    const info = PROVIDERS[id]
    if (info.kind === 'gemini') {
      return assayApplication(key, resume, jd)
    }
    if (info.kind === 'anthropic') {
      const system = SYSTEM_PROMPT + '\n\n' + JSON_SHAPE_ADDENDUM
      const user =
        'MASTER RESUME:\n' + resume + '\n\n---\n\nJOB DESCRIPTION:\n' + jd
      return anthropicJson(key, info.model, system, user).then(validateAssayResult)
    }
    return openaiCompatAssay(info, key, resume, jd)
  }

  try {
    const result = await callOne(active)
    return { result, usedProvider: active }
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
      const result = await callOne(fallbackId)
      return { result, usedProvider: fallbackId, fellBackFrom: active }
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(
        `${PROVIDERS[active].label} is rate-limited and the fallback (${PROVIDERS[fallbackId].label}) also failed: ${fallbackMessage}`,
      )
    }
  }
}
