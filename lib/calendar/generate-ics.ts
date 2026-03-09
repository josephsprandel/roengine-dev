/**
 * RFC 5545 compliant ICS calendar event generator.
 * No external dependencies — pure string building.
 */

export interface ICSEventParams {
  id: string | number
  start: Date
  end: Date
  summary: string
  description: string
  location: string
  uid: string
  organizerEmail: string
  organizerName: string
}

/** Escape special characters per RFC 5545 §3.3.11 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1 */
function foldLine(line: string): string {
  const maxLen = 75
  if (line.length <= maxLen) return line
  const parts: string[] = []
  parts.push(line.slice(0, maxLen))
  let pos = maxLen
  while (pos < line.length) {
    parts.push(' ' + line.slice(pos, pos + maxLen - 1))
    pos += maxLen - 1
  }
  return parts.join('\r\n')
}

/** Format a Date as YYYYMMDDTHHMMSS (no trailing Z — used with TZID) */
function formatLocalDateTime(d: Date, tz: string): string {
  // Convert to the target timezone and extract components
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find(p => p.type === type)?.value || '00'
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`
}

/** Format a Date as UTC: YYYYMMDDTHHMMSSZ */
function formatUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

const TIMEZONE = 'America/Chicago'

/**
 * VTIMEZONE block for America/Chicago (US Central).
 * Covers standard DST rules (2nd Sunday March → 1st Sunday November).
 */
function vtimezoneBlock(): string {
  return [
    'BEGIN:VTIMEZONE',
    'TZID:America/Chicago',
    'X-LIC-LOCATION:America/Chicago',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0500',
    'TZNAME:CDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n')
}

export function generateICS(params: ICSEventParams): string {
  const {
    start,
    end,
    summary,
    description,
    location,
    uid,
    organizerEmail,
    organizerName,
  } = params

  const now = formatUTC(new Date())
  const dtStart = formatLocalDateTime(start, TIMEZONE)
  const dtEnd = formatLocalDateTime(end, TIMEZONE)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RO Engine//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vtimezoneBlock(),
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}`),
    `DTSTAMP:${now}`,
    `CREATED:${now}`,
    foldLine(`DTSTART;TZID=${TIMEZONE}:${dtStart}`),
    foldLine(`DTEND;TZID=${TIMEZONE}:${dtEnd}`),
    foldLine(`SUMMARY:${escapeText(summary)}`),
    foldLine(`DESCRIPTION:${escapeText(description)}`),
    foldLine(`LOCATION:${escapeText(location)}`),
    foldLine(`ORGANIZER;CN=${escapeText(organizerName)}:mailto:${organizerEmail}`),
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n') + '\r\n'
}

/** Build a Google Calendar deep link URL */
export function buildGoogleCalendarLink(params: {
  summary: string
  start: Date
  end: Date
  description: string
  location: string
}): string {
  const { summary, start, end, description, location } = params
  // Google Calendar expects UTC dates in compact format
  const startStr = formatUTC(start).replace('Z', '') + 'Z'
  const endStr = formatUTC(end).replace('Z', '') + 'Z'

  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', summary)
  url.searchParams.set('dates', `${startStr}/${endStr}`)
  url.searchParams.set('details', description)
  url.searchParams.set('location', location)
  return url.toString()
}
