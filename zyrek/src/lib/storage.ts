import type { AssayResult, InterviewPrep } from '../types/assay'

export type AppStatus = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED'

export interface SavedAssay {
  id: string
  createdAt: number
  jd: string
  result: AssayResult
  status: AppStatus
  notes: string
  appliedAt?: number
  rerunOf?: string
  prep?: InterviewPrep
  contact?: { name?: string; email?: string; link?: string }
  statusChangedAt?: number // stamped whenever status changes
  lastFollowUpAt?: number // stamped when user marks a nudge Done
  followUpCount?: number // how many times marked done
}

export const STATUS_ORDER: AppStatus[] = [
  'SAVED',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
]

export const STATUS_LABELS: Record<AppStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
}

const KEY = 'zyrek.history'
const LEGACY_KEY = 'assay.history' // pre-rename name — read once, migrated on read
const MAX_ENTRIES = 50

/**
 * Read a stored string, falling back to its pre-rename `assay.*` key. On the
 * first fallback hit the value is copied to the new key so later reads (and
 * backups) use it; the old key is left untouched as a safety net.
 */
export function readMigratedKey(newKey: string, oldKey: string): string | null {
  const value = localStorage.getItem(newKey)
  if (value !== null) return value
  const legacy = localStorage.getItem(oldKey)
  if (legacy === null) return null
  try {
    localStorage.setItem(newKey, legacy)
  } catch {
    // storage unavailable — still serve the legacy value in memory
  }
  return legacy
}

function normalizeContact(c: unknown): SavedAssay['contact'] | undefined {
  if (typeof c !== 'object' || c === null) return undefined
  const r = c as Record<string, unknown>
  const out: { name?: string; email?: string; link?: string } = {}
  for (const k of ['name', 'email', 'link'] as const) {
    if (typeof r[k] === 'string' && (r[k] as string).trim() !== '') {
      out[k] = r[k] as string
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function migrate(e: SavedAssay): SavedAssay {
  const status = STATUS_ORDER.includes(e.status) ? e.status : 'SAVED'
  const migrated: SavedAssay = {
    ...e,
    status,
    notes: typeof e.notes === 'string' ? e.notes : '',
  }
  const contact = normalizeContact(e.contact)
  if (contact) {
    migrated.contact = contact
  } else {
    delete migrated.contact
  }
  if (
    migrated.prep &&
    (!Array.isArray(migrated.prep.questions) || migrated.prep.questions.length === 0)
  ) {
    delete migrated.prep
  }
  return migrated
}

function read(): SavedAssay[] {
  try {
    const raw = readMigratedKey(KEY, LEGACY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (e): e is SavedAssay =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as SavedAssay).id === 'string' &&
          typeof (e as SavedAssay).createdAt === 'number' &&
          typeof (e as SavedAssay).result === 'object' &&
          (e as SavedAssay).result !== null,
      )
      .map(migrate)
  } catch {
    return []
  }
}

function write(list: SavedAssay[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
}

function writeQuotaSafe(list: SavedAssay[]): void {
  try {
    write(list)
  } catch {
    const half = Math.ceil(list.length / 2)
    try {
      write(list.slice(0, half))
    } catch {
      throw new Error(
        'Could not save to history — browser storage is full. Delete some old entries.',
      )
    }
  }
}

export function listAssays(): SavedAssay[] {
  return read()
}

export function saveAssay(
  jd: string,
  result: AssayResult,
  rerunOf?: string,
): SavedAssay {
  const saved: SavedAssay = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    jd,
    result,
    status: 'SAVED',
    notes: '',
    rerunOf,
  }
  const list = [saved, ...read()].slice(0, MAX_ENTRIES)
  writeQuotaSafe(list)
  return saved
}

export function updateAssay(
  id: string,
  patch: Partial<Pick<SavedAssay, 'status' | 'notes' | 'prep' | 'contact'>>,
): SavedAssay | undefined {
  const list = read()
  const index = list.findIndex((e) => e.id === id)
  if (index === -1) return undefined
  const entry = { ...list[index], ...patch }
  if (patch.status !== undefined && patch.status !== list[index].status) {
    entry.statusChangedAt = Date.now()
  }
  if (patch.status === 'APPLIED' && entry.appliedAt === undefined) {
    entry.appliedAt = Date.now()
  }
  list[index] = entry
  writeQuotaSafe(list)
  return entry
}

export function markFollowedUp(id: string): SavedAssay | undefined {
  const list = read()
  const index = list.findIndex((e) => e.id === id)
  if (index === -1) return undefined
  const entry: SavedAssay = {
    ...list[index],
    lastFollowUpAt: Date.now(),
    followUpCount: (list[index].followUpCount ?? 0) + 1,
  }
  list[index] = entry
  writeQuotaSafe(list)
  return entry
}

export function deleteAssay(id: string): void {
  write(read().filter((e) => e.id !== id))
}

export function getAssay(id: string): SavedAssay | undefined {
  return read().find((e) => e.id === id)
}
