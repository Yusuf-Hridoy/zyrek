export type ProviderId = 'gemini' | 'groq' | 'openai' | 'anthropic'

export interface ProviderInfo {
  id: ProviderId
  label: string
  model: string
  kind: 'gemini' | 'openai' | 'anthropic'
  baseUrl: string
  keyUrl: string
  keyUrlLabel: string
  keyLinkText: string
  keyPlaceholder: string
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    model: 'gemini-3.5-flash',
    kind: 'gemini',
    baseUrl: '',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyUrlLabel: 'Google AI Studio',
    keyLinkText: 'Get free key',
    keyPlaceholder: 'AIza…',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    model: 'llama-3.3-70b-versatile',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    keyUrlLabel: 'Groq Console',
    keyLinkText: 'Get free key',
    keyPlaceholder: 'gsk_…',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    model: 'gpt-5.6-terra',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyUrlLabel: 'OpenAI Platform',
    keyLinkText: 'Get key',
    keyPlaceholder: 'sk-…',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    model: 'claude-sonnet-5',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyUrlLabel: 'Anthropic Console',
    keyLinkText: 'Get key',
    keyPlaceholder: 'sk-ant-…',
  },
}

export const PROVIDER_ORDER: ProviderId[] = ['gemini', 'groq', 'openai', 'anthropic']

export class RateLimitError extends Error {
  providerId: ProviderId
  label: string

  constructor(providerId: ProviderId, label: string) {
    super(`Rate limit hit on ${label}. Wait a minute and retry.`)
    this.name = 'RateLimitError'
    this.providerId = providerId
    this.label = label
  }
}

const KEYS_KEY = 'zyrek.keys'
const ACTIVE_KEY = 'zyrek.provider'
const RENAMED_KEYS_KEY = 'assay.keys' // pre-rename name — read once, migrated on read
const RENAMED_ACTIVE_KEY = 'assay.provider'
const LEGACY_KEY = 'assay.geminiKey'

function isProviderId(v: unknown): v is ProviderId {
  return v === 'gemini' || v === 'groq' || v === 'openai' || v === 'anthropic'
}

export function loadKeys(): Partial<Record<ProviderId, string>> {
  try {
    let raw = localStorage.getItem(KEYS_KEY)
    if (raw === null) {
      const renamed = localStorage.getItem(RENAMED_KEYS_KEY)
      if (renamed !== null) {
        try {
          localStorage.setItem(KEYS_KEY, renamed)
        } catch {
          // storage unavailable — still serve the renamed value in memory
        }
        raw = renamed
      }
    }
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy !== null) {
        const migrated: Partial<Record<ProviderId, string>> = { gemini: legacy }
        try {
          localStorage.setItem(KEYS_KEY, JSON.stringify(migrated))
          localStorage.removeItem(LEGACY_KEY)
        } catch {
          // storage unavailable — still return the migrated keys in memory
        }
        return migrated
      }
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const record = parsed as Record<string, unknown>
    if ('cerebras' in record) {
      // dropped provider — silently remove any stored cerebras key
      delete record.cerebras
      try {
        localStorage.setItem(KEYS_KEY, JSON.stringify(record))
      } catch {
        // keep the cleaned keys in memory even if the write fails
      }
    }
    const keys: Partial<Record<ProviderId, string>> = {}
    for (const id of PROVIDER_ORDER) {
      const v = record[id]
      if (typeof v === 'string' && v) keys[id] = v
    }
    return keys
  } catch {
    return {}
  }
}

export function saveKeys(keys: Partial<Record<ProviderId, string>>): void {
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys))
}

export function loadActiveProvider(
  keys: Partial<Record<ProviderId, string>>,
): ProviderId {
  try {
    // falls back to the pre-rename `assay.provider` value (migrates on next save)
    const raw =
      localStorage.getItem(ACTIVE_KEY) ?? localStorage.getItem(RENAMED_ACTIVE_KEY)
    if (isProviderId(raw) && keys[raw]) return raw
  } catch {
    // fall through to key-based fallback
  }
  for (const id of PROVIDER_ORDER) {
    if (keys[id]) return id
  }
  return 'gemini'
}

export function saveActiveProvider(id: ProviderId): void {
  localStorage.setItem(ACTIVE_KEY, id)
}
