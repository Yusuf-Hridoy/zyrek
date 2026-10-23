/**
 * Dependency-free .ics (iCalendar) download for follow-up reminders.
 * DTSTART is floating local time (no Z suffix) so the event fires at 09:00
 * wherever the user is. CRLF line endings per RFC 5545.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function downloadFollowUpIcs(
  a: { roleTitle: string; company: string; id: string },
  inDays = 2,
): void {
  const start = new Date()
  start.setDate(start.getDate() + inDays)
  start.setHours(9, 0, 0, 0)

  const stamp = new Date()
  const dtstamp =
    `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}` +
    `T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`
  const dtstart =
    `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}` +
    `T${pad(start.getHours())}${pad(start.getMinutes())}${pad(start.getSeconds())}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zyrek//Assay//EN',
    'BEGIN:VEVENT',
    `UID:${a.id}-${Date.now()}@zyrek`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE-TIME:${dtstart}`,
    `SUMMARY:${icsEscape(`Follow up — ${a.roleTitle} at ${a.company}`)}`,
    `DESCRIPTION:${icsEscape('Nudge from Zyrek/Assay.')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const blob = new Blob([lines.join('\r\n')], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `followup-${slug(a.company) || 'reminder'}.ics`
  anchor.click()
  URL.revokeObjectURL(url)
}
