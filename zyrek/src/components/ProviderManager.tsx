import { useRef, useState } from 'react'
import {
  PROVIDER_ORDER,
  PROVIDERS,
  saveActiveProvider,
  type ProviderId,
} from '../lib/providers'
import { exportBackup, importBackup } from '../lib/backup'

/** Backup export/import controls — rendered on the Settings page. */
export function BackupControls() {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return
    try {
      await importBackup(file)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConfirming(false)
    }
  }

  return (
    <div className="mt-3 border-t border-[#e2dccb] pt-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8a8371]">
        Backup
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={exportBackup}
          className="text-[12.5px] text-[#6f6858] underline underline-offset-2 transition-colors hover:text-[#26221b]"
        >
          Export backup
        </button>
        {confirming ? (
          <span className="flex items-center gap-2 text-[12.5px] text-[#6f6858]">
            Replace everything in this browser with the backup?
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="font-semibold text-[#b3492b] transition-colors hover:underline"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[#8a8371] transition-colors hover:text-[#4a4436]"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setConfirming(true)
            }}
            className="text-[12.5px] text-[#6f6858] underline underline-offset-2 transition-colors hover:text-[#26221b]"
          >
            Import backup
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-[#9c3d1e]">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void onFileChosen(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

interface ProviderManagerProps {
  keys: Partial<Record<ProviderId, string>>
  activeProvider: ProviderId
  onKeysChange: (keys: Partial<Record<ProviderId, string>>) => void
  onActiveChange: (id: ProviderId) => void
}

const inputClass =
  'w-full rounded-lg border border-[#e2dccb] bg-[#f2eee2]/50 px-3.5 py-2.5 font-mono text-[13px] text-[#26221b] placeholder:text-[#a39b86] focus:border-[#b3492b]/40 focus:outline-none'

export function ProviderManagerContent({
  keys,
  activeProvider,
  onKeysChange,
  onActiveChange,
}: ProviderManagerProps) {
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({})

  const saveKey = (id: ProviderId) => {
    const key = (drafts[id] ?? '').trim()
    if (!key) return
    onKeysChange({ ...keys, [id]: key })
    setDrafts((d) => ({ ...d, [id]: '' }))
  }

  const removeKey = (id: ProviderId) => {
    const next = { ...keys }
    delete next[id]
    onKeysChange(next)
    if (id === activeProvider) {
      // pick a new active provider among the remaining keys
      let newActive: ProviderId = 'gemini'
      for (const pid of PROVIDER_ORDER) {
        if (next[pid]) {
          newActive = pid
          break
        }
      }
      saveActiveProvider(newActive)
      onActiveChange(newActive)
    }
  }

  const selectProvider = (id: ProviderId) => {
    if (!keys[id]) return
    saveActiveProvider(id)
    onActiveChange(id)
  }

  return (
    <div>
      <h3 className="text-[14px] font-semibold">AI providers</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8a8371]">
        Keys are stored only in this browser. Gemini and Groq keys are free;
        OpenAI and Claude are paid per use. If the active provider is
        rate-limited, Zyrek retries on another provider you've added.
      </p>

      <div className="max-h-[60vh] overflow-y-auto">
        {PROVIDER_ORDER.map((id, i) => {
          const info = PROVIDERS[id]
          const hasKey = Boolean(keys[id])
          const active = id === activeProvider
          return (
            <div
              key={id}
              className={`py-3 ${i > 0 ? 'border-t border-[#e2dccb]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => selectProvider(id)}
                  disabled={!hasKey}
                  title={hasKey ? undefined : 'Add a key first'}
                  className={`flex items-center gap-2 ${
                    hasKey
                      ? 'cursor-pointer'
                      : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <span
                    className={`h-3.5 w-3.5 rounded-full border ${
                      active
                        ? 'border-[#26221b] bg-[#26221b]'
                        : 'border-[#b6ad97]'
                    }`}
                  />
                  <span className="text-[13px] font-semibold">
                    {info.label}
                  </span>
                </button>
                {hasKey ? (
                  <span className="flex items-center gap-1.5 text-[12px] text-[#8a8371]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5a8a3e]" />
                    key saved
                  </span>
                ) : (
                  <a
                    href={info.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-[#b3492b] underline underline-offset-2"
                  >
                    {info.keyLinkText}
                  </a>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="password"
                  value={drafts[id] ?? ''}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && saveKey(id)}
                  placeholder={
                    hasKey
                      ? '••••••••  (saved — paste to replace)'
                      : info.keyPlaceholder
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => saveKey(id)}
                  disabled={!(drafts[id] ?? '').trim()}
                  className="shrink-0 rounded-lg bg-[#26221b] px-3.5 py-2.5 text-[13px] font-semibold text-[#f4f0e4] transition-colors hover:bg-[#3a352c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save
                </button>
              </div>

              {hasKey && (
                <button
                  type="button"
                  onClick={() => removeKey(id)}
                  className="mt-1.5 text-[12px] text-[#8a8371] transition-colors hover:text-[#b3492b]"
                >
                  Remove
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
