import { useRef, useState, type ReactNode } from 'react'
import { FileUp, FileText, Check, Sparkles } from 'lucide-react'
import { extractResumeText } from '../lib/extractResume'
import { cardClass } from '../lib/ui'

interface InputPanelProps {
  resume: string
  setResume: (v: string) => void
  resumeSaved: boolean
  onSaveResume: () => void
  onFileLoaded: (text: string) => void
  jd: string
  setJd: (v: string) => void
  loading: boolean
  loadingStage: string
  canRun: boolean
  onRun: () => void
}

const STEP_TONES = {
  done: 'bg-[#e3ecda] text-[#3d5a2e]',
  active: 'bg-[#26221b] text-[#f4f0e4]',
  pending: 'bg-[#efe9d9] text-[#5d574a]',
}

function StepCircle({
  tone,
  children,
}: {
  tone: keyof typeof STEP_TONES
  children: ReactNode
}) {
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold ${STEP_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

const stepTitle = 'text-[14px] font-semibold text-[#26221b]'

export default function InputPanel({
  resume,
  setResume,
  resumeSaved,
  onSaveResume,
  onFileLoaded,
  jd,
  setJd,
  loading,
  loadingStage,
  canRun,
  onRun,
}: InputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [manualPaste, setManualPaste] = useState(false)
  // The last resume text known to be stored — Cancel restores it.
  const [savedText, setSavedText] = useState(resume)
  const [editing, setEditing] = useState(() => resume.trim().length === 0)
  const hasSaved = savedText.trim().length > 0

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setExtractError(null)
    setExtracting(file.name)
    try {
      const text = await extractResumeText(file)
      setFileName(file.name)
      onFileLoaded(text)
      setSavedText(text)
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : String(e))
    } finally {
      setExtracting(null)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleSave = () => {
    if (!resume.trim()) return
    onSaveResume()
    setSavedText(resume)
    setEditing(false)
  }

  const handleCancel = () => {
    setResume(savedText)
    setExtractError(null)
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* STEP 1 — RESUME */}
      <div className={cardClass}>
        {!editing ? (
          <div className="flex items-center gap-3 px-5 py-3.5">
            <StepCircle tone="done">
              <Check className="h-3.5 w-3.5" />
            </StepCircle>
            <p className="min-w-0 flex-1 text-[14px] leading-snug">
              <span className="font-semibold text-[#26221b]">1 · Your resume</span>{' '}
              <span className="text-[#5d574a]">
                — saved, {resume.length.toLocaleString()} characters
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setSavedText(resume)
                setEditing(true)
              }}
              className="flex min-h-[32px] shrink-0 items-center rounded-lg border border-[#d8d1bf] px-3 text-[12.5px] font-medium text-[#4a4436] transition-colors hover:bg-[#f2eee2]"
            >
              Replace
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2dccb] px-5 py-4">
              <div className="flex items-center gap-3">
                <StepCircle tone={hasSaved ? 'done' : 'active'}>
                  {hasSaved ? <Check className="h-3.5 w-3.5" /> : '1'}
                </StepCircle>
                <span className={stepTitle}>1 · Your resume</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                {hasSaved && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="min-h-[32px] rounded-lg px-2 text-[12.5px] text-[#5d574a] underline underline-offset-2 transition-colors hover:text-[#26221b]"
                  >
                    Cancel
                  </button>
                )}
                {resume.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg px-2 py-1.5 font-mono text-[11px] text-[#5d574a] transition-colors hover:bg-[#f2eee2] hover:text-[#4a4436]"
                  >
                    Replace file
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={resume.trim().length === 0 || resumeSaved}
                  className="flex items-center gap-1.5 rounded-lg border border-[#d8d1bf] px-2.5 py-1.5 font-mono text-[11px] text-[#4a4436] transition-colors hover:bg-[#f2eee2] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {resumeSaved ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#3d5a2e]" />
                      <span className="text-[#3d5a2e]">Saved</span>
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>

            {extractError && (
              <div className="mx-5 mt-4 rounded-lg border border-[#e3b39d] bg-[#f7e8e0] px-4 py-3 text-[12.5px] leading-relaxed text-[#8a3418]">
                {extractError}
              </div>
            )}

            <div className="px-5 pt-4">
              {extracting ? (
                <div className="flex h-52 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[#cfc7b2]">
                  <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#e2dccb] border-t-[#26221b]" />
                  <p className="px-6 text-center text-[13px] text-[#5d574a]">
                    Extracting text from {extracting}…
                  </p>
                </div>
              ) : resume.trim().length === 0 && !manualPaste ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`flex h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center transition-colors ${
                    dragging
                      ? 'border-[#b3492b] bg-[#f7f3e8]'
                      : 'border-[#cfc7b2] hover:bg-[#f2eee2]/60'
                  }`}
                >
                  <FileUp className="h-8 w-8 text-[#b6ad97]" />
                  <p className="text-[14px] font-medium text-[#4a4436]">
                    Drop your resume here — PDF, DOCX, or TXT
                  </p>
                  <p className="text-[12.5px] text-[#5d574a]">
                    Text is extracted in your browser. Nothing is uploaded.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setManualPaste(true)
                    }}
                    className="font-mono text-[11px] text-[#5d574a] underline underline-offset-2 transition-colors hover:text-[#4a4436]"
                  >
                    or paste it manually
                  </button>
                </div>
              ) : (
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="Paste your full master resume here once — it stays in your browser. Every run tailors from this."
                  className="h-52 w-full resize-none rounded-lg border border-[#e2dccb] bg-[#f2eee2]/50 px-3.5 py-3 text-[13.5px] leading-relaxed text-[#26221b] placeholder:text-[#a39b86] focus:border-[#b3492b]/40 focus:outline-none"
                />
              )}
            </div>
            <div className="flex items-center justify-between px-5 pb-3 pt-2 font-mono text-[11px] text-[#a39b86]">
              <span className="flex min-w-0 items-center gap-1.5">
                {fileName && (
                  <>
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fileName}</span>
                  </>
                )}
              </span>
              <span className="shrink-0">{resume.length.toLocaleString()} chars</span>
            </div>
          </>
        )}
      </div>

      {/* STEP 2 — JOB DESCRIPTION */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 border-b border-[#e2dccb] px-5 py-4">
          <StepCircle tone="active">2</StepCircle>
          <span className={stepTitle}>2 · Paste the job</span>
        </div>
        <div className="px-5 py-4">
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description here…"
            className="h-44 w-full resize-none rounded-lg border border-[#e2dccb] bg-[#fdfcf8] px-3.5 py-3 text-[13.5px] leading-relaxed text-[#26221b] placeholder:text-[#a39b86] focus:border-[#b3492b]/40 focus:outline-none"
          />
        </div>
      </div>

      {/* STEP 3 — RUN */}
      <div className="pt-1">
        <div className="flex items-center gap-3">
          <StepCircle tone="pending">3</StepCircle>
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun || loading}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#26221b] px-4 py-4 text-[15px] font-semibold text-[#f4f0e4] transition-colors hover:bg-[#3a352c] ${
              !canRun || loading ? 'cursor-not-allowed opacity-40' : ''
            }`}
          >
            <Sparkles className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">
              {loading ? loadingStage || 'Working…' : 'Grade my application'}
            </span>
          </button>
        </div>
        <p className="mt-2.5 pl-[34px] text-[12.5px] text-[#5d574a]">
          CV + letter + answers, scored by 3 reviewers
        </p>
      </div>
    </div>
  )
}
