#!/usr/bin/env node
/**
 * Regenerates the four screenshots embedded in the root README.
 *
 *   node scripts/take-readme-screenshots.mjs              # starts its own dev server
 *   node scripts/take-readme-screenshots.mjs --url http://localhost:5173
 *
 * Re-run it any time the UI changes — it overwrites docs/screenshots/*.png.
 *
 * All four render in a 1280x800 light-mode viewport. home.png and insights.png
 * are captured at that size. result.png and pipeline.png are captured as
 * measured regions of the same 1280-wide page, because what they have to show
 * (score through package tabs; radar through the full history list) is taller
 * than 800px in the real layout — the region is measured from the DOM so the
 * framing follows the UI instead of drifting from a hard-coded height.
 *
 * Everything the screenshots show is FICTIONAL demo data seeded into
 * localStorage before the page loads (see FIXTURE below): invented candidate,
 * invented companies, example.com contacts, a placeholder API key that is
 * never sent anywhere. The real user's resume, contacts, and employers must
 * never reach a screenshot — these images are public.
 *
 * Playwright is a devDependency used only by this script. Nothing under src/
 * imports it, so the shipped bundle is unaffected.
 */

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(HERE, '..') // zyrek/
const OUT_DIR = path.resolve(APP_DIR, '..', 'docs', 'screenshots')

const WIDTH = 1280
const HEIGHT = 800
const DEV_PORT = 5179

// ---------------------------------------------------------------------------
// FICTIONAL DEMO DATA
// ---------------------------------------------------------------------------

const DAY = 86_400_000
const now = Date.now()
const ago = (days) => now - days * DAY

/** Invented person, invented employers. Nothing here belongs to anyone. */
const MASTER_RESUME = `Ayesha Rahman
Frontend Engineer
ayesha.rahman@example.com · +44 20 7946 0000 · Manchester, UK · github.com/example/ayesha

SUMMARY
Frontend engineer with five years building and maintaining customer-facing web
applications in React and TypeScript. Comfortable owning a feature from design
review through release and on-call support.

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, HTML, CSS, SQL
Frameworks: React, Next.js, Node.js, Express
Testing: Jest, React Testing Library, Playwright
Tooling: Vite, Webpack, Git, GitHub Actions, Docker
Other: REST APIs, PostgreSQL, accessibility (WCAG 2.1), design systems

EXPERIENCE
Frontend Engineer | Mar 2022 - Present
Greenfield Software · B2B logistics platform · Manchester
- Rebuilt the shipment tracking dashboard in React and TypeScript, cutting the
  median page load from 4.1s to 1.3s.
- Introduced a shared component library used by four product teams, removing
  roughly 6,000 lines of duplicated markup.
- Added Playwright coverage for the five highest-traffic journeys; release
  regressions dropped from about two per month to one per quarter.
- Mentored two junior engineers through their first six months.

Frontend Developer | Aug 2020 - Feb 2022
Larkspur Digital · Agency · Leeds
- Built responsive marketing sites and client portals in React and Next.js.
- Took the main client portal to WCAG 2.1 AA after an external audit.
- Set up GitHub Actions pipelines that replaced manual FTP deploys.

Junior Developer | Jul 2019 - Jul 2020
Pennine Web · Small studio · Leeds
- Maintained jQuery and PHP sites while migrating three of them to React.
- Wrote the studio's first component documentation.

PROJECTS
Shiftly: open-source shift-swap tool for small teams, React + Node, 400 stars.

EDUCATION
BSc Computer Science - University of Leeds | 2016 - 2019

CERTIFICATIONS
- Professional Scrum Developer I (2021)
`

const DIMENSION_LABELS = [
  'Requirements match',
  'Evidence strength',
  'Domain familiarity',
  'Seniority and scope',
  'Keyword / ATS alignment',
]

const dims = (scores, notes) =>
  DIMENSION_LABELS.map((label, i) => ({
    label,
    score: scores[i],
    note: notes[i],
  }))

const NORTHWIND_CV = `# Ayesha Rahman
**Frontend Engineer**
ayesha.rahman@example.com · +44 20 7946 0000 · Manchester, UK · github.com/example/ayesha

## SUMMARY
Frontend engineer with five years in React and TypeScript, most recently
rebuilding a shipment tracking dashboard that cut median load time from 4.1s to
1.3s. Owns features end to end, from design review to on-call support. Built and
maintained a shared component library used by four product teams. Comfortable
with accessibility work to WCAG 2.1 AA.

## TECHNICAL SKILLS
**Languages:** TypeScript, JavaScript, HTML, CSS, SQL
**Frameworks:** React, Next.js, Node.js, Express
**Testing:** Jest, React Testing Library, Playwright
**Tooling:** Vite, Webpack, Git, GitHub Actions, Docker
**Other:** REST APIs, PostgreSQL, accessibility (WCAG 2.1), design systems

## EXPERIENCE
### Frontend Engineer | Mar 2022 - Present
*Greenfield Software · B2B logistics platform · Manchester*
- Rebuilt the shipment tracking dashboard in React and TypeScript, cutting the median page load from 4.1s to 1.3s.
- Introduced a shared component library used by four product teams, removing roughly 6,000 lines of duplicated markup.
- Added Playwright coverage for the five highest-traffic journeys; release regressions dropped from about two per month to one per quarter.
- Mentored two junior engineers through their first six months.

### Frontend Developer | Aug 2020 - Feb 2022
*Larkspur Digital · Agency · Leeds*
- Built responsive marketing sites and client portals in React and Next.js.
- Took the main client portal to WCAG 2.1 AA after an external audit.
- Set up GitHub Actions pipelines that replaced manual FTP deploys.

### Junior Developer | Jul 2019 - Jul 2020
*Pennine Web · Small studio · Leeds*
- Maintained jQuery and PHP sites while migrating three of them to React.
- Wrote the studio's first component documentation.

## PROJECTS
**Shiftly:** open-source shift-swap tool for small teams, React + Node, 400 stars.

## EDUCATION
### BSc Computer Science - University of Leeds | 2016 - 2019

## CERTIFICATIONS
- Professional Scrum Developer I (2021)
`

const NORTHWIND_LETTER = `Dear Hiring Team,

I rebuilt the shipment tracking dashboard at Greenfield Software in React and
TypeScript, taking its median load from 4.1 seconds to 1.3. That work is the
closest thing I have to the performance problem your posting describes. At
Greenfield I own customer-facing features end to end, from design review through
release and the on-call rota that follows.

Your posting puts weight on a maintainable component library and on
accessibility, and both are where I have spent the last two years. The shared
library I introduced is now used by four product teams, and I took a client
portal through a WCAG 2.1 AA audit at Larkspur Digital. Northwind Labs describes
its design system as the team's shared vocabulary, which matches how I have seen
one actually pay off.

If it helps, I would start by walking through the dashboard rebuild and where I
would look first for the same wins in your product.

Best regards,
Ayesha Rahman
`

/** The complete, graded application the result + pipeline shots are built on. */
const NORTHWIND = {
  id: 'demo-northwind-labs',
  createdAt: ago(13),
  appliedAt: ago(11),
  statusChangedAt: ago(11),
  status: 'APPLIED',
  notes: 'Referred by the meetup organiser. Take-home was a small dashboard.',
  contact: { name: 'Dana Whitfield', email: 'dana.whitfield@example.com' },
  jd: `Northwind Labs is hiring a Senior Frontend Engineer to own our customer
dashboard. You will work in React and TypeScript, extend the design system that
is the team's shared vocabulary, and keep the dashboard fast and accessible.
Requirements: 5+ years frontend, strong React and TypeScript, component library
experience, WCAG familiarity, comfort with end-to-end testing. Nice to have:
Next.js, GraphQL, data visualisation.`,
  result: {
    roleTitle: 'Senior Frontend Engineer',
    company: 'Northwind Labs',
    companyContext: 'Workflow software for logistics teams',
    verdict: 'STRONG MATCH',
    overallScore: 86,
    summary:
      'Your dashboard rebuild and component library work line up almost exactly with what this post asks for. The one soft spot is GraphQL, which the posting lists as nice to have.',
    dimensions: dims(
      [89, 90, 78, 84, 88],
      [
        'Hits every required line except GraphQL, which is listed as optional.',
        'Each claim traces to a specific, measurable result in the resume.',
        'Logistics software at Greenfield is adjacent to the same customer problem.',
        'Five years and mentoring support the senior title without stretching it.',
        "Uses the posting's own terms — design system, end-to-end testing, WCAG.",
      ],
    ),
    reviewers: [
      {
        role: 'RECRUITER',
        title: 'Six-second scan',
        comment:
          'React, TypeScript and a component library are all visible in the top third. The 4.1s to 1.3s number is the line that would make me read on.',
      },
      {
        role: 'HIRING MGR',
        title: 'Would I interview this?',
        comment:
          'Yes. The dashboard rebuild is the same shape of problem as ours. I would want to hear how the component library was adopted by four teams.',
      },
      {
        role: 'FACT-CHECK',
        title: 'Anything unsupported?',
        comment:
          'Nothing invented. Every figure in the CV appears in the master resume. GraphQL is correctly absent rather than implied.',
      },
    ],
    tailoredCv: NORTHWIND_CV,
    coverLetter: NORTHWIND_LETTER,
    formAnswers: [
      {
        question:
          'Describe a project where you improved the performance of a web application.',
        answer:
          'At Greenfield Software I rebuilt the shipment tracking dashboard in React and TypeScript. Median page load went from 4.1 seconds to 1.3. Most of the win came from splitting a single oversized bundle and moving the heaviest table to virtualised rendering, with the rest from dropping two unused chart libraries.',
      },
      {
        question: 'How do you approach accessibility in a component library?',
        answer:
          'I treat it as part of the component contract rather than a later pass. At Larkspur Digital a client portal went through an external WCAG 2.1 AA audit, and the fixes that stuck were the ones made inside the shared components — focus handling, labelling, and colour contrast — so every consumer got them at once.',
      },
      {
        question: 'How do you keep a shared component library adopted?',
        answer:
          'The library I introduced at Greenfield is used by four product teams. Adoption came from migrating the two loudest duplicated patterns first, around 6,000 lines of markup, so teams got something back before they were asked to change anything.',
      },
    ],
    signals: [
      { skill: 'React', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'TypeScript', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Design systems', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Accessibility (WCAG)', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'End-to-end testing', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Next.js', demand: 'PREFERRED', evidence: 'WEAK' },
      { skill: 'GraphQL', demand: 'PREFERRED', evidence: 'MISSING' },
      { skill: 'Data visualisation', demand: 'PREFERRED', evidence: 'WEAK' },
    ],
  },
}

const CONTOSO = {
  id: 'demo-contoso-health',
  createdAt: ago(27),
  appliedAt: ago(25),
  statusChangedAt: ago(6),
  status: 'REJECTED',
  notes: 'Rejected at CV stage — they wanted hands-on GraphQL.',
  jd: 'Contoso Health is looking for a Frontend Engineer for its patient portal. React, TypeScript, GraphQL, and a strong accessibility background are required.',
  result: {
    roleTitle: 'Frontend Engineer',
    company: 'Contoso Health',
    companyContext: 'Patient-facing healthcare portal',
    verdict: 'GOOD MATCH',
    overallScore: 74,
    summary:
      'Strong on React, TypeScript and accessibility. GraphQL is required here rather than optional, and there is no evidence for it in the resume.',
    dimensions: dims(
      [71, 82, 62, 76, 79],
      [
        'GraphQL is a hard requirement and has no supporting evidence.',
        'Accessibility and React claims are backed by specific audited work.',
        'No healthcare or regulated-domain experience in the resume.',
        'Scope matches a mid-level posting comfortably.',
        "Most of the posting's vocabulary is already in the CV.",
      ],
    ),
    reviewers: [
      {
        role: 'RECRUITER',
        title: 'Six-second scan',
        comment:
          'React and accessibility read well. I would check the GraphQL line before passing it on.',
      },
      {
        role: 'HIRING MGR',
        title: 'Would I interview this?',
        comment:
          'Probably not for this one. The portal work is GraphQL-heavy from day one.',
      },
      {
        role: 'FACT-CHECK',
        title: 'Anything unsupported?',
        comment: 'Clean. GraphQL is left out rather than softened into a claim.',
      },
    ],
    tailoredCv: NORTHWIND_CV,
    coverLetter: NORTHWIND_LETTER,
    formAnswers: [
      {
        question: 'Describe your experience with accessible web applications.',
        answer:
          'I took a client portal at Larkspur Digital through an external WCAG 2.1 AA audit and fixed the findings inside the shared components so every consumer inherited them.',
      },
    ],
    signals: [
      { skill: 'React', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'TypeScript', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'GraphQL', demand: 'REQUIRED', evidence: 'MISSING' },
      { skill: 'Accessibility (WCAG)', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Design systems', demand: 'PREFERRED', evidence: 'STRONG' },
      { skill: 'Data visualisation', demand: 'PREFERRED', evidence: 'MISSING' },
    ],
  },
}

const FABRIKAM = {
  id: 'demo-fabrikam-robotics',
  createdAt: ago(19),
  appliedAt: ago(17),
  statusChangedAt: ago(6),
  status: 'INTERVIEW',
  notes: 'First call went well. Second round is a system design chat.',
  contact: { name: 'Priya Nair', email: 'priya.nair@example.com' },
  jd: 'Fabrikam Robotics needs a Product Engineer (React) to build operator tooling. React, TypeScript, Node.js, and data visualisation experience required. GraphQL preferred.',
  result: {
    roleTitle: 'Product Engineer (React)',
    company: 'Fabrikam Robotics',
    companyContext: 'Operator tooling for warehouse robotics',
    verdict: 'PARTIAL MATCH',
    overallScore: 68,
    summary:
      'React and Node.js are well evidenced. Data visualisation is required here and the resume only touches it indirectly.',
    dimensions: dims(
      [64, 77, 58, 72, 70],
      [
        'Data visualisation is required and only indirectly evidenced.',
        'React and Node claims are specific and checkable.',
        'No robotics or hardware-adjacent work in the resume.',
        'Product ownership at Greenfield matches the posting well.',
        'Some of the posting’s tooling vocabulary is missing from the CV.',
      ],
    ),
    reviewers: [
      {
        role: 'RECRUITER',
        title: 'Six-second scan',
        comment: 'Reads as a solid React engineer. The dashboard line helps.',
      },
      {
        role: 'HIRING MGR',
        title: 'Would I interview this?',
        comment:
          'Worth a call. I would probe how much of the dashboard work was charting versus layout.',
      },
      {
        role: 'FACT-CHECK',
        title: 'Anything unsupported?',
        comment:
          'No invented claims. The visualisation gap is stated rather than papered over.',
      },
    ],
    tailoredCv: NORTHWIND_CV,
    coverLetter: NORTHWIND_LETTER,
    formAnswers: [
      {
        question: 'Tell us about a tool you built for internal users.',
        answer:
          'Shiftly, an open-source shift-swap tool for small teams, built in React and Node. It is the project where I had to design for people using it under time pressure rather than browsing.',
      },
    ],
    signals: [
      { skill: 'React', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'TypeScript', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Node.js', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Data visualisation', demand: 'REQUIRED', evidence: 'WEAK' },
      { skill: 'GraphQL', demand: 'PREFERRED', evidence: 'MISSING' },
      { skill: 'End-to-end testing', demand: 'PREFERRED', evidence: 'STRONG' },
    ],
  },
}

const TAILSPIN = {
  id: 'demo-tailspin-analytics',
  createdAt: ago(4),
  statusChangedAt: ago(4),
  status: 'SAVED',
  notes: '',
  jd: 'Tailspin Analytics is hiring a Senior React Engineer for its reporting product. React, TypeScript, design systems, and data visualisation. Next.js preferred.',
  result: {
    roleTitle: 'Senior React Engineer',
    company: 'Tailspin Analytics',
    companyContext: 'Reporting and dashboards for finance teams',
    verdict: 'GOOD MATCH',
    overallScore: 71,
    summary:
      'Design system and React evidence is strong. Charting is the gap, and it is central to a reporting product.',
    dimensions: dims(
      [69, 80, 61, 78, 74],
      [
        'Four of five required lines are covered; charting is not.',
        'The component library result is the strongest piece of evidence.',
        'Finance reporting is new ground relative to logistics.',
        'Senior scope is supported by the mentoring and ownership lines.',
        'Reads naturally against the posting apart from charting terms.',
      ],
    ),
    reviewers: [
      {
        role: 'RECRUITER',
        title: 'Six-second scan',
        comment: 'Senior-looking CV, clear React and design system signal.',
      },
      {
        role: 'HIRING MGR',
        title: 'Would I interview this?',
        comment:
          'Likely yes, with charting as the thing to probe in the first call.',
      },
      {
        role: 'FACT-CHECK',
        title: 'Anything unsupported?',
        comment: 'All claims trace back to the master resume.',
      },
    ],
    tailoredCv: NORTHWIND_CV,
    coverLetter: NORTHWIND_LETTER,
    formAnswers: [
      {
        question: 'How do you decide what belongs in a design system?',
        answer:
          'Whatever two teams have already built twice. At Greenfield the first components in the shared library were the ones duplicated across four product areas, which is why adoption did not need pushing.',
      },
    ],
    signals: [
      { skill: 'React', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'TypeScript', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Design systems', demand: 'REQUIRED', evidence: 'STRONG' },
      { skill: 'Data visualisation', demand: 'REQUIRED', evidence: 'MISSING' },
      { skill: 'Next.js', demand: 'PREFERRED', evidence: 'WEAK' },
      { skill: 'Accessibility (WCAG)', demand: 'PREFERRED', evidence: 'STRONG' },
    ],
  },
}

/** Newest first, the order zyrek.history is stored in. */
const HISTORY = [TAILSPIN, FABRIKAM, NORTHWIND, CONTOSO]

const FIXTURE = {
  'zyrek.masterResume': MASTER_RESUME,
  'zyrek.history': JSON.stringify(HISTORY),
  // Placeholder only — shaped like a key so the header reads "connected".
  // No request is ever made with it.
  'zyrek.keys': JSON.stringify({ gemini: 'AIzaSyDEMO-not-a-real-key-000000' }),
  'zyrek.provider': 'gemini',
}

// ---------------------------------------------------------------------------
// SHOTS
// ---------------------------------------------------------------------------

const SHOTS = [
  {
    file: 'home.png',
    hash: '#/',
    caption: 'the three-step screen with a saved resume',
  },
  {
    file: 'result.png',
    hash: `#/app/${NORTHWIND.id}`,
    caption: 'a graded application',
    // Score, decision line and package tabs sit further apart than one
    // 1280x800 frame can hold, so this shot is captured as a measured region
    // running from the top of the scorecard to just inside the tailored CV.
    // Measuring it (rather than hard-coding a height) keeps the framing right
    // when the scorecard grows or shrinks.
    region: () => {
      // The label is uppercased by CSS — match the source text, not the paint.
      const label = [...document.querySelectorAll('span')].find(
        (el) => el.textContent?.trim().toLowerCase() === 'graded package',
      )
      const card = label?.closest('.rounded-xl')
      const tab = [...document.querySelectorAll('button')].find(
        (el) => el.textContent?.trim() === 'Tailored CV',
      )
      const bar = tab?.closest('.sticky')
      if (!card || !bar) throw new Error('result.png: anchors not found')
      const top = card.getBoundingClientRect().top + window.scrollY - 16
      const barBottom = bar.getBoundingClientRect().bottom + window.scrollY
      return {
        x: 0,
        y: Math.max(0, top),
        width: document.documentElement.clientWidth,
        height: barBottom + 150 - Math.max(0, top),
      }
    },
  },
  {
    file: 'pipeline.png',
    hash: '#/pipeline',
    caption: 'the pipeline',
    // Run the frame to the foot of the history card so every tracked
    // application and its status is in the shot, not just the first two.
    region: () => {
      const label = [...document.querySelectorAll('span')].find(
        (el) => el.textContent?.trim().toLowerCase() === 'history',
      )
      const card = label?.closest('.rounded-xl')
      if (!card) throw new Error('pipeline.png: history card not found')
      const bottom = card.getBoundingClientRect().bottom + window.scrollY
      return {
        x: 0,
        y: 0,
        width: document.documentElement.clientWidth,
        height: bottom + 24,
      }
    },
  },
  { file: 'insights.png', hash: '#/insights', caption: 'insights' },
]

// ---------------------------------------------------------------------------
// DEV SERVER
// ---------------------------------------------------------------------------

function parseUrlArg(argv) {
  const i = argv.indexOf('--url')
  if (i !== -1 && argv[i + 1]) return argv[i + 1].replace(/\/$/, '')
  const inline = argv.find((a) => a.startsWith('--url='))
  return inline ? inline.slice('--url='.length).replace(/\/$/, '') : null
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' })
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Dev server did not come up at ${url} within ${timeoutMs}ms`)
}

function startDevServer() {
  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--port', String(DEV_PORT), '--strictPort'],
    { cwd: APP_DIR, shell: true, stdio: 'ignore' },
  )
  return {
    url: `http://localhost:${DEV_PORT}`,
    stop() {
      if (child.pid === undefined) return
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
        })
      } else {
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch {
          child.kill('SIGTERM')
        }
      }
    },
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const externalUrl = parseUrlArg(process.argv.slice(2))
  const server = externalUrl ? null : startDevServer()
  const baseUrl = externalUrl ?? server.url

  await mkdir(OUT_DIR, { recursive: true })

  let browser
  try {
    console.log(`Waiting for ${baseUrl} …`)
    await waitForServer(baseUrl)

    browser = await chromium.launch()
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })

    await context.addInitScript((fixture) => {
      try {
        for (const [key, value] of Object.entries(fixture)) {
          localStorage.setItem(key, value)
        }
      } catch {
        // a screenshot run with no storage is not worth failing over
      }
    }, FIXTURE)

    const page = await context.newPage()

    for (const shot of SHOTS) {
      // Fresh document per shot so the init script reseeds and the hash route
      // is read at mount rather than through a same-page hash change.
      await page.goto('about:blank')
      await page.goto(`${baseUrl}/${shot.hash}`, { waitUntil: 'load' })
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)

      // AppDetailView scrolls itself to the top on mount; let that settle
      // before anything is measured or captured.
      await page.waitForTimeout(500)

      const out = path.join(OUT_DIR, shot.file)
      if (shot.region) {
        const clip = await page.evaluate(shot.region)
        await page.screenshot({ path: out, fullPage: true, clip })
        console.log(
          `  ✓ ${shot.file} — ${shot.caption} (${clip.width}x${Math.round(clip.height)})`,
        )
      } else {
        await page.screenshot({ path: out })
        console.log(`  ✓ ${shot.file} — ${shot.caption} (${WIDTH}x${HEIGHT})`)
      }
    }

    await context.close()
  } finally {
    if (browser) await browser.close()
    if (server) server.stop()
  }

  console.log(`\nWrote ${SHOTS.length} screenshots to ${OUT_DIR}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
