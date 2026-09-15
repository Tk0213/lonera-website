/**
 * Calendar events for confirmed bookings.
 *
 * Pure builders and one pure decision function. The network calls live in the
 * server, because they need OAuth tokens and a retry queue; what is decided
 * here is *what* each calendar should contain, which is the part that has to
 * be the same no matter which calendar it is.
 *
 * Three delivery paths, and why there are three:
 *
 *   Google Calendar  - the API, with a client-chosen event id. Google lets the
 *                      caller pick an id (base32hex, 5-1024 chars), so a retry
 *                      after a timeout collides with the event already created
 *                      instead of creating a second one. That makes insert
 *                      idempotent without a lookup.
 *   Apple Calendar   - there is no server-side Apple Calendar API a web app can
 *                      write to. The honest options are an emailed iCalendar
 *                      invitation (METHOD:REQUEST), which Apple Calendar adds
 *                      and later updates or cancels by UID and SEQUENCE; a
 *                      private webcal subscription feed, which updates on the
 *                      device's own refresh schedule rather than instantly; or
 *                      EventKit from the native app, which writes straight to
 *                      the device calendar. The native app is the only one of
 *                      the three that is genuinely immediate.
 *   Everything else  - the same .ics. Outlook, Proton and Fastmail all honour
 *                      UID + SEQUENCE + METHOD.
 *
 * The UID is derived from the booking id and never changes. SEQUENCE goes up on
 * every change. Those two rules are what let a reschedule update the event a
 * user already has instead of leaving the old one behind next to a new one.
 */

export const PRODID = '-//Lonera//Scheduling//EN';

export const eventUid = (bookingId) => `booking-${bookingId}@lonera.app`;

const B32HEX = '0123456789abcdefghijklmnopqrstuv';

/** A Google Calendar event id for a booking: stable, base32hex, prefixed. */
export function googleEventId(bookingId) {
  const bytes = [];
  for (const ch of String(bookingId)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32HEX[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32HEX[(value << (5 - bits)) & 31];
  return `lonera${out}`;
}

/** RFC 5545 TEXT escaping. */
export function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const utf8Len = (cp) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/**
 * Fold a content line at 75 octets. Octets, not characters: a Korean tutor's
 * name is three bytes per character, and folding by character count produces
 * lines Apple Calendar rejects. A fold never splits a multi-byte character.
 */
export function foldLine(line) {
  const out = [];
  let cur = '';
  let len = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8Len(ch.codePointAt(0));
    if (len + n > limit) {
      out.push(cur);
      cur = ' ';
      len = 1;
      limit = 75;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

const pad = (n) => String(n).padStart(2, '0');
export function icsDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** The human-readable parts every destination shows. */
export function describe({ booking, tutor, subjectLabel, purposeLabel, lang = 'en' }) {
  const who = tutor ? (lang === 'ko' && tutor.nameKo ? tutor.nameKo : tutor.name) : '';
  const summary = lang === 'ko'
    ? `${subjectLabel || '과외'} - ${who}`
    : `${subjectLabel || 'Tutoring'} with ${who}`;
  const mins = Math.round((booking.end - booking.start) / 60000);
  const lines = [
    lang === 'ko' ? `튜터: ${who}` : `Tutor: ${who}`,
    subjectLabel ? (lang === 'ko' ? `과목: ${subjectLabel}` : `Subject: ${subjectLabel}`) : null,
    purposeLabel ? (lang === 'ko' ? `목적: ${purposeLabel}` : `Focus: ${purposeLabel}`) : null,
    lang === 'ko' ? `시간: ${mins}분` : `Length: ${mins} minutes`,
    tutor && tutor.location ? (lang === 'ko' ? `장소: ${tutor.location}` : `Where: ${tutor.location}`) : null,
    lang === 'ko' ? '변경 또는 취소는 로네라 앱에서 할 수 있습니다.' : 'Change or cancel in the Lonera app.',
  ].filter(Boolean);
  return { summary, description: lines.join('\n'), minutes: mins };
}

/**
 * A complete VCALENDAR for one booking.
 * method: 'REQUEST' for create and update, 'CANCEL' to remove.
 */
export function icsForBooking({
  booking, tutor, subjectLabel, purposeLabel, sequence = 0, method = 'REQUEST',
  now = Date.now(), organizerEmail = 'bookings@lonera.app', attendeeEmail, url, lang = 'en',
}) {
  const { summary, description } = describe({ booking, tutor, subjectLabel, purposeLabel, lang });
  const cancelled = method === 'CANCEL' || booking.status === 'cancelled';
  const lines = [
    'BEGIN:VCALENDAR',
    `PRODID:${PRODID}`,
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${eventUid(booking.id)}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(booking.start)}`,
    `DTEND:${icsDate(booking.end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    tutor && tutor.location ? `LOCATION:${escapeText(tutor.location)}` : null,
    url ? `URL:${url}` : null,
    `ORGANIZER;CN=Lonera:mailto:${organizerEmail}`,
    attendeeEmail ? `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${attendeeEmail}` : null,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    cancelled ? null : 'BEGIN:VALARM',
    cancelled ? null : 'ACTION:DISPLAY',
    cancelled ? null : `DESCRIPTION:${escapeText(summary)}`,
    cancelled ? null : 'TRIGGER:-PT1H',
    cancelled ? null : 'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** Request body for Google Calendar events.insert / events.patch. */
export function googleEventBody({ booking, tutor, subjectLabel, purposeLabel, timeZone = 'America/Edmonton', lang = 'en' }) {
  const { summary, description } = describe({ booking, tutor, subjectLabel, purposeLabel, lang });
  return {
    id: googleEventId(booking.id),
    summary,
    description,
    location: tutor && tutor.location ? tutor.location : undefined,
    start: { dateTime: new Date(booking.start).toISOString(), timeZone },
    end: { dateTime: new Date(booking.end).toISOString(), timeZone },
    status: booking.status === 'cancelled' ? 'cancelled' : 'confirmed',
    transparency: 'opaque',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    // Lets a lost event id be recovered with privateExtendedProperty search.
    extendedProperties: { private: { lonera_booking_id: String(booking.id), lonera_version: String(booking.version ?? 0) } },
  };
}

/**
 * What one calendar link should do next, given the booking now and what was
 * last written. Pure, so the sync worker's behaviour is testable without a
 * network: it replays this until the link reports the booking's version.
 *
 * link: { externalId, sequence, syncedVersion, state: 'none'|'created'|'deleted' }
 */
export function nextCalendarOp(booking, link = {}) {
  const state = link.state || 'none';
  const syncedVersion = link.syncedVersion ?? -1;
  const sequence = link.sequence ?? -1;
  const live = booking.status === 'confirmed';

  // A write that failed after the event was created still has an event to
  // update or delete. A failed first insert has nothing: retrying it as an
  // update would patch an event that does not exist, forever.
  const exists = state === 'created' || (state === 'failed' && Boolean(link.externalId));

  if (!live) {
    if (exists) return { op: 'delete', sequence: sequence + 1 };
    return { op: 'noop' };
  }
  if (!exists) return { op: 'insert', sequence: 0 };
  if (booking.version > syncedVersion) return { op: 'update', sequence: sequence + 1 };
  return { op: 'noop' };
}
