import { describe, expect, it } from 'vitest'
import {
  buildContactLine,
  extractContactItems,
  isContactLine,
  withBuiltContactLine,
} from './contactLine'

// Every contact detail below is invented. Phone digits are fake.

describe('extractContactItems', () => {
  it('restores the separator the resume lost between email and LinkedIn', () => {
    const resume = `Ayesha Rahman
QA Automation Engineer
+880 1712-345640 | ayesha.rahman@example.com linkedin.com/in/ayesha-rahman | ayesharahman.netlify.app

SUMMARY
Five years in test automation.`

    expect(buildContactLine(extractContactItems(resume))).toBe(
      '+880 1712-345640 | ayesha.rahman@example.com | linkedin.com/in/ayesha-rahman | ayesharahman.netlify.app',
    )
  })

  it('joins items that had no separators at all', () => {
    const resume = `Ayesha Rahman
a@b.com linkedin.com/in/x github.com/x

EXPERIENCE
- did things`

    expect(extractContactItems(resume)).toEqual([
      'a@b.com',
      'linkedin.com/in/x',
      'github.com/x',
    ])
    expect(buildContactLine(extractContactItems(resume))).toBe(
      'a@b.com | linkedin.com/in/x | github.com/x',
    )
  })

  it('ignores an email that appears in a project bullet further down', () => {
    const resume = `Ayesha Rahman
QA Automation Engineer
ayesha.rahman@example.com

SUMMARY
Five years in test automation.

PROJECTS
- Built a mailer that sends from noreply@someclient.com every night.
- Contact the maintainer at other.person@example.org for access.`

    expect(extractContactItems(resume)).toEqual(['ayesha.rahman@example.com'])
  })

  it('keeps items exactly as written, adding no scheme', () => {
    const resume = `Ayesha Rahman
ayesharahman.netlify.app · https://github.com/ayesha

SKILLS
Playwright`

    expect(extractContactItems(resume)).toEqual([
      'ayesharahman.netlify.app',
      'https://github.com/ayesha',
    ])
  })

  it('keeps a location that shares the contact line', () => {
    const resume = `Ayesha Rahman
ayesha.rahman@example.com · +44 20 7946 0000 · Manchester, UK · github.com/ayesha

SUMMARY
Frontend engineer.`

    expect(extractContactItems(resume)).toEqual([
      'ayesha.rahman@example.com',
      '+44 20 7946 0000',
      'Manchester, UK',
      'github.com/ayesha',
    ])
  })

  it('drops field labels and duplicate items', () => {
    const resume = `Ayesha Rahman
Email: ayesha.rahman@example.com | Phone: +44 20 7946 0000
ayesha.rahman@example.com

EXPERIENCE
- things`

    expect(extractContactItems(resume)).toEqual([
      'ayesha.rahman@example.com',
      '+44 20 7946 0000',
    ])
  })

  it('does not treat Node.js or a year range as contact details', () => {
    const resume = `Ayesha Rahman
Node.js and React.js engineer, 2016 - 2019
ayesha.rahman@example.com

SUMMARY
Engineer.`

    expect(extractContactItems(resume)).toEqual(['ayesha.rahman@example.com'])
  })

  it('returns nothing when the resume has no contact details', () => {
    expect(extractContactItems('Ayesha Rahman\nQA Engineer\n\nSUMMARY\nHi.')).toEqual([])
  })
})

describe('isContactLine', () => {
  it('recognises a line with contact details and rejects a plain one', () => {
    expect(isContactLine('a@b.com | linkedin.com/in/x')).toBe(true)
    expect(isContactLine('**QA Automation Engineer**')).toBe(false)
    expect(isContactLine('# Ayesha Rahman')).toBe(false)
  })
})

describe('withBuiltContactLine', () => {
  const resume = `Ayesha Rahman
QA Automation Engineer
+880 1712-345640 | ayesha.rahman@example.com | linkedin.com/in/ayesha-rahman

SUMMARY
Five years in test automation.`

  it('restores a separator the model dropped from the CV header', () => {
    const cv = `# Ayesha Rahman
**QA Automation Engineer**
+880 1712-345640 | ayesha.rahman@example.com linkedin.com/in/ayesha-rahman

## SUMMARY
Five years in test automation.`

    expect(withBuiltContactLine(cv, resume)).toBe(
      `# Ayesha Rahman
**QA Automation Engineer**
+880 1712-345640 | ayesha.rahman@example.com | linkedin.com/in/ayesha-rahman

## SUMMARY
Five years in test automation.`,
    )
  })

  it('restores an item the model omitted entirely', () => {
    const cv = `# Ayesha Rahman
**QA Automation Engineer**
ayesha.rahman@example.com

## SUMMARY
Five years in test automation.`

    expect(withBuiltContactLine(cv, resume)).toContain(
      '+880 1712-345640 | ayesha.rahman@example.com | linkedin.com/in/ayesha-rahman',
    )
  })

  it('inserts a contact line under the title when the CV has none', () => {
    const cv = `# Ayesha Rahman
**QA Automation Engineer**

## SUMMARY
Five years in test automation.`

    expect(withBuiltContactLine(cv, resume).split('\n')[2]).toBe(
      '+880 1712-345640 | ayesha.rahman@example.com | linkedin.com/in/ayesha-rahman',
    )
  })

  it('collapses two contact lines in the header into one', () => {
    const cv = `# Ayesha Rahman
**QA Automation Engineer**
+880 1712-345640
ayesha.rahman@example.com | linkedin.com/in/ayesha-rahman

## SUMMARY
Five years in test automation.`

    const out = withBuiltContactLine(cv, resume)
    expect(out.split('\n').filter((l) => l.includes('@')).length).toBe(1)
    expect(out).toBe(
      `# Ayesha Rahman
**QA Automation Engineer**
+880 1712-345640 | ayesha.rahman@example.com | linkedin.com/in/ayesha-rahman

## SUMMARY
Five years in test automation.`,
    )
  })

  it('leaves the model line alone when the resume has no contact details', () => {
    const cv = `# Ayesha Rahman
**QA Automation Engineer**
somehow@invented.example

## SUMMARY
Five years in test automation.`

    expect(withBuiltContactLine(cv, 'Ayesha Rahman\nQA Engineer\n\nSUMMARY\nHi.')).toBe(cv)
  })

  it('leaves the rest of the CV untouched', () => {
    const cv = `# Ayesha Rahman
**QA Automation Engineer**
ayesha.rahman@example.com

## EXPERIENCE
### QA Engineer | Mar 2022 - Present
*Greenfield Software · Manchester*
- Reached the team at ops@greenfield.example daily.`

    expect(withBuiltContactLine(cv, resume)).toContain(
      '- Reached the team at ops@greenfield.example daily.',
    )
  })
})
