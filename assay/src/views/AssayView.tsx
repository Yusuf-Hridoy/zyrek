import { ShieldCheck } from 'lucide-react'
import InputPanel from '../components/InputPanel'
import ScoreCard from '../components/ScoreCard'
import PackageTabs from '../components/PackageTabs'
import IntegrityWarning from '../components/IntegrityWarning'
import PrepCard from '../components/PrepCard'
import NotesCard from '../components/NotesCard'
import StatusPill from '../components/StatusPill'
import { navigate } from '../lib/router'
import type { ProviderId } from '../lib/providers'
import { cardClass, microLabel } from '../lib/ui'
import type { AppStatus, SavedAssay } from '../lib/storage'
import type { AssayResult, InterviewPrep } from '../types/assay'

interface AssayViewProps {
  resume: string
  resumeSaved: boolean
  jd: string
  loading: boolean
  loadingStage: string
  canRun: boolean
  error: string | null
  warning: string | null
  fallbackInfo: { from: string; used: string } | null
  result: AssayResult | null
  justRunAssay: SavedAssay | null
  hasAnyKey: boolean
  activeProvider: ProviderId
  keys: Partial<Record<ProviderId, string>>
  onResumeChange: (v: string) => void
  onSaveResume: () => void
  onFileLoaded: (text: string) => void
  onJdChange: (v: string) => void
  onRun: () => void
  onStatusChange: (id: string, status: AppStatus) => void
  onPrepSaved: (id: string, prep: InterviewPrep) => void
  onNotesSave: (id: string, notes: string) => void
  onExportPdf: (which: 'cv' | 'letter', result: AssayResult) => void
}

export default function AssayView({
  resume,
  resumeSaved,
  jd,
  loading,
  loadingStage,
  canRun,
  error,
  warning,
  fallbackInfo,
  result,
  justRunAssay,
  hasAnyKey,
  activeProvider,
  keys,
  onResumeChange,
  onSaveResume,
  onFileLoaded,
  onJdChange,
  onRun,
  onStatusChange,
  onPrepSaved,
  onNotesSave,
  onExportPdf,
}: AssayViewProps) {
  return (
    <>
      {/* HERO */}
      <section className="max-w-2xl pt-14 pb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#b3492b]">
          The Interview Pipeline
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          Paste any job. Get a tailored, graded application.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-[#6f6858]">
          Your CV, cover letter, and form answers — rewritten for that exact
          role, then scored by a recruiter, a hiring manager, and a
          fact-checker before you send.
        </p>
      </section>

      {/* CORE LOOP */}
      <section className="flex max-w-3xl flex-col gap-6 pb-16">
        <InputPanel
          resume={resume}
          setResume={onResumeChange}
          resumeSaved={resumeSaved}
          onSaveResume={onSaveResume}
          onFileLoaded={onFileLoaded}
          jd={jd}
          setJd={onJdChange}
          loading={loading}
          loadingStage={loadingStage}
          canRun={canRun}
          onRun={onRun}
        />

        {error && !loading && (
          <div className="rounded-xl border border-[#e3b39d] bg-[#f7e8e0] px-5 py-4 text-[13.5px] leading-relaxed text-[#8a3418]">
            <span className="font-bold">Assay failed.</span> {error}
          </div>
        )}
        {warning && !loading && (
          <div className="rounded-xl border border-[#e0c795] bg-[#f3e8d3] px-5 py-4 text-[13.5px] leading-relaxed text-[#8a5a1d]">
            {warning}
          </div>
        )}
        {fallbackInfo && !loading && (
          <div className="rounded-lg border border-[#e0c795] bg-[#f3e8d3] px-4 py-2.5 text-[13px] text-[#8a5a1d]">
            {fallbackInfo.from} was rate-limited — this assay ran on{' '}
            {fallbackInfo.used} instead.
          </div>
        )}

        {result && justRunAssay && !loading && (
          <>
            <div
              className={`${cardClass} flex items-center justify-between gap-3 px-4 py-2`}
            >
              <span className={microLabel}>Saved to history</span>
              <StatusPill
                status={justRunAssay.status}
                onChange={(s) => onStatusChange(justRunAssay.id, s)}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate({ view: 'app', id: justRunAssay.id })}
              className="-mt-3 self-start text-[12.5px] text-[#8a8371] transition-colors hover:text-[#26221b]"
            >
              View in pipeline →
            </button>
          </>
        )}

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[#cfc7b2] bg-[#faf7f0]/40 px-8">
            <div className="flex flex-col items-center gap-5">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#e2dccb] border-t-[#26221b]" />
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#8a8371]">
                {loadingStage}
              </p>
              <p className="text-[12.5px] text-[#8a8371]">
                One call, full package — no fabrication allowed.
              </p>
            </div>
          </div>
        ) : result && justRunAssay ? (
          <>
            <ScoreCard result={result} />
            <IntegrityWarning result={result} masterResume={resume} />
            <PackageTabs result={result} onExportPdf={onExportPdf} />
            <PrepCard
              key={justRunAssay.id}
              assay={justRunAssay}
              resume={resume}
              activeProvider={activeProvider}
              keys={keys}
              onPrepSaved={onPrepSaved}
            />
            <NotesCard
              key={justRunAssay.id}
              assay={justRunAssay}
              onSave={onNotesSave}
            />
          </>
        ) : error ? null : (
          <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[#cfc7b2] bg-[#faf7f0]/40 px-8">
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
              <ShieldCheck className="h-8 w-8 text-[#b6ad97]" />
              <p className="text-[14px] leading-relaxed text-[#8a8371]">
                {hasAnyKey
                  ? 'Your graded package will appear here — match score, dimension assay, and the three-reviewer panel.'
                  : 'Add an API key first (Settings — top right) — Gemini, Groq, OpenAI, or Claude — then paste a job description and run your first assay.'}
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
