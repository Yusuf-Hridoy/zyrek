import type { AssayResult } from '../types/assay'
import { anthropicJson } from './anthropic'
import { withBuiltContactLine } from './contactLine'
import { assayApplication, SYSTEM_PROMPT } from './gemini'
import { JSON_SHAPE_ADDENDUM, openaiCompatAssay } from './openaiCompat'
import {
  getModel,
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
  /**
   * The CV's contact line is rebuilt from the master resume on every run,
   * whichever provider produced it. Models drop a separator between adjacent
   * items often enough that the downloaded CV reads "a@b.com linkedin.com/in/x",
   * so the line is taken from the resume rather than trusted from the model.
   */
  const fixContactLine = (result: AssayResult): AssayResult => ({
    ...result,
    tailoredCv: withBuiltContactLine(result.tailoredCv, resume),
  })

  const callOne = (id: ProviderId): Promise<AssayResult> => {
    const key = keys[id]!
    const info = PROVIDERS[id]
    if (info.kind === 'gemini') {
      return assayApplication(key, getModel(id), resume, jd)
    }
    if (info.kind === 'anthropic') {
      const system = SYSTEM_PROMPT + '\n\n' + JSON_SHAPE_ADDENDUM
      const user =
        'MASTER RESUME:\n' + resume + '\n\n---\n\nJOB DESCRIPTION:\n' + jd
      return anthropicJson(key, getModel(id), system, user).then(validateAssayResult)
    }
    return openaiCompatAssay(info, key, resume, jd)
  }

  try {
    const result = fixContactLine(await callOne(active))
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
      const result = fixContactLine(await callOne(fallbackId))
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
