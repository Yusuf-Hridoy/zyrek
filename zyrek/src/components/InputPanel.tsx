import { useRef, useState } from 'react'
import { FileUp, FileText, Check, Sparkles } from 'lucide-react'
import { extractResumeText } from '../lib/extractResume'

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

const cardClass =
  'rounded-xl border border-[#d8d1bf] bg-[#faf7f0] shadow-[0_1px_2px_rgba(40,35,25,0.06),0_8px_24px_rgba(40,35,25,0.06)]'

const labelClass =
  'font-mono text-[11px] uppercase tracking-[0.18em] text-[#8a8371]'

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

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setExtractError(null)
    setExtracting(file.name)
    try {
      const text = await extractResumeText(file)
      setFileName(file.name)
      onFileLoaded(text)
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

  return (
    <div className="flex flex-col gap-6">
      {/* MASTER RESUME */}
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3 border-b border-[#e2dccb] px-5 py-4">
          <span className={labelClass}>Master Resume</span>
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
            {resume.trim().length > 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg px-2 py-1.5 font-mono text-[11px] text-[#8a8371] transition-colors hover:bg-[#f2eee2] hover:text-[#4a4436]"
              >
                Replace file
              </button>
            )}
            <button
              type="button"
              onClick={onSaveResume}
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
              <p className="px-6 text-center text-[13px] text-[#8a8371]">
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
              <p className="text-[12.5px] text-[#8a8371]">
                Text is extracted in your browser. Nothing is uploaded.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setManualPaste(true)
                }}
                className="font-mono text-[11px] text-[#8a8371] underline underline-offset-2 transition-colors hover:text-[#4a4436]"
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
      </div>

      {/* JOB DESCRIPTION */}
      <div className={cardClass}>
        <div className="border-b border-[#e2dccb] px-5 py-4">
          <span className={labelClass}>Job Description</span>
        </div>
        <div className="px-5 py-4">
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job post — any language. Include the title, company, responsibilities and requirements."
            className="h-44 w-full resize-none rounded-lg border border-[#e2dccb] bg-[#f2eee2]/50 px-3.5 py-3 text-[13.5px] leading-relaxed text-[#26221b] placeholder:text-[#a39b86] focus:border-[#b3492b]/40 focus:outline-none"
          />
        </div>
      </div>

      {/* RUN BUTTON */}
      <div>
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun || loading}
          className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[#26221b] py-4 text-[15px] font-semibold text-[#f4f0e4] transition-colors hover:bg-[#3a352c] ${
            !canRun || loading ? 'cursor-not-allowed opacity-40' : ''
          }`}
        >
          <Sparkles className="h-4.5 w-4.5" />
          {loading ? loadingStage || 'Working…' : 'Grade my application'}
        </button>
        <p className="mt-3 text-center text-[12.5px] text-[#8a8371]">
          Tailors your CV + cover letter, then a 3-reviewer panel grades it. ~20
          seconds.
        </p>
      </div>
    </div>
  )
}
