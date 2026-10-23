# AGENTS.md — Zyrek / Assay

Instructions for any AI coding agent working in this repo. Read fully before touching code. When a task brief conflicts with this file, the brief wins; when existing code conflicts with a brief, the brief wins.

## What this project is

**Zyrek** is a personal career toolkit owned and used by one person. Its first module, **Assay**, takes a master resume + a pasted job description, makes ONE structured AI call, and returns a graded application package: verdict + score /100, 5 scoring dimensions with notes, a 3-reviewer panel (RECRUITER / HIRING MGR / FACT-CHECK), tailored CV (markdown), cover letter, form answers, and skill signals. Around that core: an application tracker (statuses, notes, contacts), a follow-up radar, cross-application insights, interview prep packs with flashcards, re-run score diffing, PDF export, and JSON backup/restore.

- Live: https://zyrek-beryl-zeta.vercel.app/ (static Vite build on Vercel; root directory `assay`)
- App code lives in `/assay`. Screenshots in `/docs/screenshots`.
- **100% client-side.** No backend, no database, no accounts. User-supplied API keys; browser → AI provider directly; everything persists in localStorage only. This is a core product promise ("Built for one · never uploaded") — never add a server, telemetry, or external storage.

## Commands

```bash
cd assay
npm install
npm run dev       # local dev
npm run build     # tsc -b && vite build — must pass before any commit
npm run lint      # oxlint — must pass with 0 errors before any commit
```

There is no test suite yet (deliberately deferred). Do not add tests, CI, or new tooling unless a brief asks.

## Stack and hard limits

- React 19 + TypeScript **strict** + Vite + Tailwind CSS v4 (inline utility classes, arbitrary values like `bg-[#faf7f0]`), lucide-react icons.
- **Zero new runtime dependencies, ever,** unless a brief explicitly allows one. Prefer small hand-written code (see `lib/markdown.tsx`, `lib/ics.ts` — both dependency-free by design).
- No `any` except at `unknown` boundaries inside validators. No state libraries, no routing libraries (hash routing is hand-rolled in `lib/router.ts`), no CSS frameworks beyond Tailwind.

## Architecture map

State lives in **`src/App.tsx` only**. Views are layout shells that receive props. Hash routes: `#/` Assay (core loop + fresh result) · `#/pipeline` (radar, stats, history) · `#/app/{id}` (one application: scorecard, package, prep, notes) · `#/insights` · `#/settings` (providers, backup).

`src/lib/` (all self-explanatory names — keep it that way):
- `providers.ts` — provider registry (gemini / groq / openai / anthropic), per-provider key storage, `RateLimitError`
- `gemini.ts` — shared `SYSTEM_PROMPT` (numbered rules 1–14) + Gemini structured-output call
- `openaiCompat.ts` — Groq/OpenAI caller (`response_format: json_object`; **omit `temperature` for OpenAI** — GPT-5.x rejects it) + exported `extractJson` hardening (fence strip → first `{` to last `}` → parse)
- `anthropic.ts` — native Messages API; requires headers `anthropic-version` and `anthropic-dangerous-direct-browser-access: true` and a `max_tokens`; no JSON mode, so output goes through `extractJson`
- `runAssay.ts` / `prep.ts` / `followup.ts` — dispatch by provider kind + ONE-shot failover to the next provider with a saved key on `RateLimitError` only (never on invalid keys or 4xx)
- `storage.ts` — `SavedAssay` shape, `assay.history` (newest first, cap 50, read-time migration for missing fields, QuotaExceeded evict-half-and-retry)
- `validate.ts` — repair-first validators (clamp, fallback, synthesize; throw only when unusable) + `unescapeArtifacts`
- `radar.ts` / `insights.ts` — pure functions, no React, no `Date.now()` inside (timestamps passed in)
- `markdown.tsx` — safe markdown → React elements (never `dangerouslySetInnerHTML`), screen + print variants
- `router.ts`, `backup.ts`, `ics.ts`, `print.ts`, `ui.ts` (shared `cardClass`, `microLabel`, `STATUS_STYLES`, slug helper), `extractResume.ts`

## Rules that protect the AI layer

1. The shared assay `SYSTEM_PROMPT` in `gemini.ts` is the single source of truth (openaiCompat/anthropic import it). Its numbered rules include anti-fabrication (rule 1 — nothing invented, ever), CV structure, cover-letter structure with banned openers, scoring rubric anchors, knockout-requirements cap, and level-mismatch handling. **Never edit, renumber, or "improve" prompt rules unless a brief says exactly which rule to change.**
2. Prep and follow-up prompts live in their own files and never touch the assay prompt.
3. Never duplicate provider logic — reuse `PROVIDERS`, `RateLimitError`, `extractJson`, and the existing dispatch/failover pattern.
4. Model responses are untrusted: everything goes through a validator before the app sees it. Validators repair; they throw only on fundamentally unusable output. Error messages always tell the user what to do next ("…Run the assay again.").

## Rules that protect user data

- localStorage keys: `assay.history`, `assay.keys`, `assay.provider`, `assay.masterResume`. **Never rename a key or change a stored shape without an explicit migration instruction in a brief.** New fields on `SavedAssay` are optional with read-time migration — never a rewrite pass over stored data.
- `backup.ts` copies raw stored strings verbatim — keep it that way.
- API keys never leave the browser except inside the direct provider request.

## Design language (match exactly — the app must look like one hand built it)

- Paper palette: page `#f4f0e4`; cards `bg-[#faf7f0] border-[#d8d1bf] rounded-xl` + soft double shadow (use `cardClass`); ink `#26221b`; muted `#8a8371` / `#6f6858`; dividers `#e2dccb`; hover fill `#f2eee2`; accent `#b3492b` — **rare** (links, delete-confirm, REJECTED family only).
- Status/verdict families: green `#3d5a2e`/`#e3ecda`/`#b9cba6` · yellow-green `#5a6428`/`#e9efdc`/`#cdd6a8` · amber `#8a5a1d`/`#f3e8d3`/`#e0c795` · clay `#9c3d1e`/`#f3ddd3`/`#e3b39d` · neutral `#6f6858`/`#efe9d9`/`#ddd6c4`.
- Radii system: `rounded-xl` cards, `rounded-lg` controls, `rounded-md` pills/chips. Nothing else.
- Micro-labels: `microLabel` (`font-mono text-[11px] uppercase tracking-[0.18em]`).
- Copy tone: calm, specific, plain everyday English, no jargon; every error says what to do next.
- NO new colors, gradients, icon sprees, charts, or animations beyond what a brief names. When unsure between two designs, ship the quieter one.

## UX discipline (binding on every change)

- The Assay page stays almost empty — nothing new ever lands there. Features live on Pipeline / AppDetail / Insights / Settings.
- Quiet empty states: a feature with no data renders NOTHING (no teaser, no locked state, no empty shell). The page with no data must look like the feature doesn't exist.
- Zero layout shift from state changes; one accordion/dropdown open at a time; Escape and click-outside close popovers; keyed components (`key={assay.id}`) where per-assay state could bleed.
- Mobile: everything must work at 380px width; touch targets ≥32px; no nested scroll boxes (the page scrolls; sticky bars are fine — remember `overflow-hidden` on an ancestor breaks `position: sticky`).

## How work is delivered

- Work arrives as phase briefs with numbered steps and an acceptance checklist. Follow steps in order; **the app must build and run after every step**; one commit per step where the brief says so.
- Output COMPLETE files for everything touched — never `// rest unchanged` or `...` inside a touched file.
- Do only what the brief scopes. Do not refactor, rename, restyle, or fix unrelated bugs while passing through — note them in a final comment instead.
- Commit messages: conventional style, descriptive (`feat: …`, `fix: …`), never bare phase numbers.
- Before finishing: run the brief's acceptance checklist mentally, then `npm run build` and `npm run lint` — both must be clean.

## Never do

- Add a backend, database, analytics, or any network call except the user's own AI-provider requests (a stateless Vercel `/api` function is allowed only if a brief introduces it).
- Weaken anti-fabrication anywhere: the app must never invent experience, skills, metrics, contacts, or dates on the user's behalf.
- Persist AI drafts that the product deliberately keeps ephemeral (follow-up drafts).
- Break the privacy copy ("your resume and keys stay in this browser") by making it untrue.