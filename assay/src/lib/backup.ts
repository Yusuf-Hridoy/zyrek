/**
 * Backup / restore of all Zyrek local data.
 *
 * The four known localStorage keys are copied as RAW stored strings in both
 * directions — never re-parsed or re-serialized — so a restore is byte-exact
 * and cannot drift in shape.
 */

const BACKUP_KEYS = [
  'assay.history',
  'assay.keys',
  'assay.provider',
  'assay.masterResume',
] as const

export function exportBackup(): void {
  const data: Record<string, string> = {}
  for (const key of BACKUP_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null) data[key] = value
  }
  const payload = { version: 1, exportedAt: Date.now(), data }
  const blob = new Blob([JSON.stringify(payload)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zyrek-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<{ restored: string[] }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not a valid Zyrek backup.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('This file is not a valid Zyrek backup.')
  }
  const { version, data } = parsed as { version?: unknown; data?: unknown }
  if (version !== 1 || typeof data !== 'object' || data === null) {
    throw new Error('This file is not a valid Zyrek backup.')
  }
  const restored: string[] = []
  for (const key of BACKUP_KEYS) {
    const value = (data as Record<string, unknown>)[key]
    if (typeof value === 'string') {
      localStorage.setItem(key, value)
      restored.push(key)
    }
  }
  return { restored }
}
