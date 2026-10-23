import { useEffect, useRef, useState } from 'react'
import { KeyRound, Settings } from 'lucide-react'
import AssayView from './views/AssayView'
import PipelineView from './views/PipelineView'
import AppDetailView from './views/AppDetailView'
import InsightsView from './views/InsightsView'
import SettingsView from './views/SettingsView'
import { runAssay } from './lib/runAssay'
import {
  loadActiveProvider,
  loadKeys,
  PROVIDERS,
  saveActiveProvider,
  saveKeys,
  type ProviderId,
} from './lib/providers'
import {
  listAssays,
  saveAssay,
  deleteAssay,
  updateAssay,
  markFollowedUp,
  readMigratedKey,
  type AppStatus,
  type SavedAssay,
} from './lib/storage'
import { runFollowUp } from './lib/followup'
import { downloadFollowUpIcs } from './lib/ics'
import { printDocument, type PrintDocData } from './lib/print'
import PrintDoc from './components/PrintDoc'
import type { RerunDiff as RerunDiffData } from './components/RerunDiff'
import type { AssayResult, InterviewPrep } from './types/assay'
import { navigate, useRoute } from './lib/router'

export default function App() {
  const route = useRoute()

  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>(() => loadKeys())
  const [activeProvider, setActiveProvider] = useState<ProviderId>(() =>
    loadActiveProvider(loadKeys()),
  )

  const [resume, setResume] = useState(
    () => readMigratedKey('zyrek.masterResume', 'assay.masterResume') ?? '',
  )
  const [resumeSaved, setResumeSaved] = useState(false)
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [fallbackInfo, setFallbackInfo] = useState<{ from: string; used: string } | null>(
    null,
  )
  const [result, setResult] = useState<AssayResult | null>(null)
  const [history, setHistory] = useState<SavedAssay[]>(() => listAssays())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [justRan, setJustRan] = useState(false)
  const [rerunDiff, setRerunDiff] = useState<RerunDiffData | null>(null)
  const [printDoc, setPrintDoc] = useState<PrintDocData | null>(null)
  const intervalRef = useRef<number | null>(null)
  // When a re-run completes we navigate to the new entry; the route-change
  // effect below must not wipe the fresh diff on arrival.
  const pendingDiffForRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [])

  // Diff belongs to one navigation context: clear it when the route changes,
  // except when the change is our own post-rerun arrival.
  useEffect(() => {
    if (
      route.view === 'app' &&
      pendingDiffForRef.current !== null &&
      route.id === pendingDiffForRef.current
    ) {
      pendingDiffForRef.current = null
      return
    }
    setRerunDiff(null)
  }, [route])

  const onKeysChange = (next: Partial<Record<ProviderId, string>>) => {
    saveKeys(next)
    setKeys(next)
  }

  const onActiveChange = (id: ProviderId) => {
    saveActiveProvider(id)
    setActiveProvider(id)
  }

  const saveResume = () => {
    if (!resume.trim()) return
    localStorage.setItem('zyrek.masterResume', resume)
    setResumeSaved(true)
    setTimeout(() => setResumeSaved(false), 2000)
  }

  const handleFileLoaded = (text: string) => {
    setResume(text)
    localStorage.setItem('zyrek.masterResume', text)
    setResumeSaved(true)
    setTimeout(() => setResumeSaved(false), 2000)
  }

  const canRun =
    Boolean(keys[activeProvider]) &&
    resume.trim().length > 100 &&
    jd.trim().length > 100

  const handleResumeChange = (v: string) => {
    setResume(v)
    setResumeSaved(false)
  }

  const STAGES = [
    'Reading the job post…',
    'Tailoring your CV…',
    'Writing the cover letter…',
    'Recruiter doing the 6-second scan…',
    'Hiring manager reviewing fit…',
    'Fact-checker verifying every claim…',
  ]

  const startRun = (jd: string, base?: SavedAssay) => {
    setLoading(true)
    setError(null)
    setFallbackInfo(null)
    setRerunDiff(null)
    let i = 0
    setLoadingStage(STAGES[0])
    const iv = setInterval(() => {
      i = (i + 1) % STAGES.length
      setLoadingStage(STAGES[i])
    }, 3200)
    intervalRef.current = iv
    runAssay(activeProvider, keys, resume, jd)
      .then((outcome) => {
        let savedId: string | null = null
        try {
          const saved = saveAssay(jd, outcome.result, base?.id)
          savedId = saved.id
          setHistory(listAssays())
          setActiveId(saved.id)
          setWarning(null)
        } catch {
          setWarning(
            "Result shown but couldn't be saved to history — browser storage is full.",
          )
        }
        if (outcome.fellBackFrom) {
          setFallbackInfo({
            from: PROVIDERS[outcome.fellBackFrom].label,
            used: PROVIDERS[outcome.usedProvider].label,
          })
        }
        if (base) {
          const prev = new Map(
            base.result.dimensions.map((d) => [d.label, d.score]),
          )
          setRerunDiff({
            fromScore: base.result.overallScore,
            toScore: outcome.result.overallScore,
            dimensions: outcome.result.dimensions
              .map((d) => {
                const from = prev.get(d.label)
                return from === undefined
                  ? null
                  : { label: d.label, delta: d.score - from }
              })
              .filter(
                (d): d is { label: string; delta: number } =>
                  d !== null && Math.abs(d.delta) >= 3,
              ),
          })
          setJd(base.jd)
        }
        setJustRan(true)
        setResult(outcome.result)
        if (base && savedId) {
          // Re-run stays in context: land on the new linked entry's detail page.
          pendingDiffForRef.current = savedId
          navigate({ view: 'app', id: savedId })
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        clearInterval(iv)
        intervalRef.current = null
        setLoading(false)
      })
  }

  const onRun = () => startRun(jd)

  const handleRerun = (base: SavedAssay) => startRun(base.jd, base)

  const openAssay = (item: SavedAssay) => {
    navigate({ view: 'app', id: item.id })
  }

  const onDeleteHistory = (id: string) => {
    deleteAssay(id)
    setHistory(listAssays())
    if (id === activeId) {
      setActiveId(null)
      setResult(null)
      setRerunDiff(null)
    }
  }

  const handleStatusChange = (id: string, status: AppStatus) => {
    updateAssay(id, { status })
    setHistory(listAssays())
  }

  const handleNotesChange = (id: string, notes: string) => {
    updateAssay(id, { notes })
    setHistory(listAssays())
  }

  const handlePrepSaved = (id: string, prep: InterviewPrep) => {
    updateAssay(id, { prep })
    setHistory(listAssays())
  }

  const handleMarkFollowedUp = (id: string) => {
    markFollowedUp(id)
    setHistory(listAssays())
  }

  const handleContactChange = (
    id: string,
    contact: SavedAssay['contact'],
  ) => {
    updateAssay(id, { contact })
    setHistory(listAssays())
  }

  const draftFollowUp = (assay: SavedAssay) =>
    runFollowUp(activeProvider, keys, assay, resume, Date.now())

  const handleIcs = (assay: SavedAssay) =>
    downloadFollowUpIcs({
      roleTitle: assay.result.roleTitle,
      company: assay.result.company,
      id: assay.id,
    })

  // Print only after React has committed the print document; the title was
  // already swapped by printDocument (the browser reads it at print time).
  useEffect(() => {
    if (printDoc) window.print()
  }, [printDoc])

  const handleExportPdf = (which: 'cv' | 'letter', result: AssayResult) => {
    const slug = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
    const parts = [slug(result.roleTitle), slug(result.company)]
      .filter(Boolean)
      .join('-')
    const filename = which === 'cv' ? `cv-${parts}` : `cover-letter-${parts}`
    printDocument(
      setPrintDoc,
      which === 'cv' ? result.tailoredCv : result.coverLetter,
      filename,
    )
  }

  const activeAssay = history.find((h) => h.id === activeId) ?? null
  const justRunAssay = justRan ? activeAssay : null

  const hasAnyKey = Boolean(keys.gemini || keys.groq || keys.openai || keys.anthropic)

  const detailAssay =
    route.view === 'app' ? (history.find((h) => h.id === route.id) ?? null) : null

  const tabs: { view: 'assay' | 'pipeline' | 'insights'; label: string }[] = [
    { view: 'assay', label: 'Zyrek' },
    {
      view: 'pipeline',
      label: history.length > 0 ? `Pipeline · ${history.length}` : 'Pipeline',
    },
    { view: 'insights', label: 'Insights' },
  ]

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="border-b border-[#ddd6c4]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-4 rounded-[4px] bg-[#26221b]" />
            <span className="text-lg font-bold tracking-tight">Zyrek</span>
            <span className="ml-2 hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[#8a8371] sm:inline">
              Personal · Private
            </span>
          </div>

          <nav
            aria-label="Primary"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
          >
            {tabs.map((t) => {
              const active =
                route.view === t.view || (t.view === 'pipeline' && route.view === 'app')
              return (
                <button
                  key={t.view}
                  type="button"
                  onClick={() => navigate({ view: t.view })}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                    active
                      ? 'bg-[#26221b] text-[#f4f0e4]'
                      : 'text-[#8a8371] hover:text-[#26221b]'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#/settings"
              className="flex items-center gap-2 rounded-lg border border-[#d8d1bf] bg-[#faf7f0] px-3.5 py-2 text-[13px] font-medium text-[#26221b] transition-colors hover:bg-[#f2eee2]"
            >
              {hasAnyKey ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#5a8a3e]" />
                  {PROVIDERS[activeProvider].label} connected
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Add API key
                </>
              )}
            </a>
            <a
              href="#/settings"
              aria-label="Settings"
              className="flex min-h-[32px] items-center rounded-lg p-2 text-[#6f6858] transition-colors hover:bg-[#f2eee2] hover:text-[#26221b]"
            >
              <Settings className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        {route.view === 'assay' && (
          <AssayView
            resume={resume}
            resumeSaved={resumeSaved}
            jd={jd}
            loading={loading}
            loadingStage={loadingStage}
            canRun={canRun}
            error={error}
            warning={warning}
            fallbackInfo={fallbackInfo}
            result={result}
            justRunAssay={justRunAssay}
            hasAnyKey={hasAnyKey}
            activeProvider={activeProvider}
            keys={keys}
            onResumeChange={handleResumeChange}
            onSaveResume={saveResume}
            onFileLoaded={handleFileLoaded}
            onJdChange={setJd}
            onRun={onRun}
            onStatusChange={handleStatusChange}
            onPrepSaved={handlePrepSaved}
            onNotesSave={handleNotesChange}
            onExportPdf={handleExportPdf}
          />
        )}
        {route.view === 'pipeline' && (
          <PipelineView
            items={history}
            activeId={activeId}
            onOpen={openAssay}
            onDelete={onDeleteHistory}
            onStatusChange={handleStatusChange}
            onDone={handleMarkFollowedUp}
            onIcs={handleIcs}
            draftFor={draftFollowUp}
          />
        )}
        {route.view === 'app' && (
          <AppDetailView
            assay={detailAssay}
            loading={loading}
            loadingStage={loadingStage}
            resume={resume}
            activeProvider={activeProvider}
            keys={keys}
            rerunDiff={rerunDiff}
            onRerun={handleRerun}
            onStatusChange={handleStatusChange}
            onContactChange={handleContactChange}
            onPrepSaved={handlePrepSaved}
            onNotesSave={handleNotesChange}
            draftFor={draftFollowUp}
            onExportPdf={handleExportPdf}
          />
        )}
        {route.view === 'insights' && <InsightsView items={history} />}
        {route.view === 'settings' && (
          <SettingsView
            keys={keys}
            activeProvider={activeProvider}
            onKeysChange={onKeysChange}
            onActiveChange={onActiveChange}
          />
        )}
      </main>

      {/* Print-only document root: hidden on screen, sole content when printing. */}
      {printDoc && <PrintDoc markdown={printDoc.markdown} />}
    </div>
  )
}
