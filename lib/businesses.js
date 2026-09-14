'use strict';

/**
 * Business records, including how each one's availability is known.
 *
 * This is the prototype's stand-in for a database, and the shape is the point:
 * three fields decide a business's tier.
 *
 *   icsUrl        - a calendar feed. Ask the business for one URL from Google
 *                   Calendar, Outlook, Square, Jane or Calendly. This is the
 *                   only field that can produce genuinely live slots.
 *   declaredHours - what they typed into the provider dashboard, keyed by
 *                   JS getDay() (0 = Sunday). Indicative, never live.
 *   placeId       - a Google Place id, for licensed OPENING HOURS only.
 *
 * Most real businesses will arrive with none of the three, which is why
 * `unknown` is a first-class tier rather than an error state.
 */

/** 9-5 weekdays, the most common declared pattern. */
const WEEKDAYS_9_5 = { 1: [['09:00', '17:00']], 2: [['09:00', '17:00']], 3: [['09:00', '17:00']], 4: [['09:00', '17:00']], 5: [['09:00', '17:00']] };
const WEEKDAYS_8_6 = { 1: [['08:00', '18:00']], 2: [['08:00', '18:00']], 3: [['08:00', '18:00']], 4: [['08:00', '18:00']], 5: [['08:00', '18:00']] };
const SIX_DAY_SALON = { 2: [['10:00', '19:00']], 3: [['10:00', '19:00']], 4: [['10:00', '19:00']], 5: [['10:00', '20:00']], 6: [['09:00', '18:00']] };

const BUSINESSES = {
  // --- tier 1: connected. A real feed, so slots are live. -------------------
  // ICS_URL_* let the demo point at a genuine calendar without committing a
  // secret feed address to the repository.
  sparkle: {
    id: 'sparkle', name: 'Sparkle Home Services', category: 'Cleaning',
    icsUrl: process.env.ICS_URL_SPARKLE || null,
    declaredHours: WEEKDAYS_8_6,
  },
  bowriver: {
    id: 'bowriver', name: 'Bow River Family Clinic', category: 'Clinic',
    icsUrl: process.env.ICS_URL_BOWRIVER || null,
    declaredHours: WEEKDAYS_8_6,
    placeId: process.env.PLACE_ID_BOWRIVER || null,
  },

  // --- tier 2: declared. They told us their hours; we confirm each request. -
  haneul: { id: 'haneul', name: 'Studio Haneul Hair', category: 'Hair', declaredHours: SIX_DAY_SALON },
  riverbend: { id: 'riverbend', name: 'Riverbend Dental', category: 'Dental', declaredHours: WEEKDAYS_8_6 },
  crescent: { id: 'crescent', name: 'Crescent Clean Co.', category: 'Cleaning', declaredHours: WEEKDAYS_9_5 },
  nova: { id: 'nova', name: 'Nova Hair Studio', category: 'Hair', declaredHours: SIX_DAY_SALON },
  elbow: { id: 'elbow', name: 'Elbow Park Dental', category: 'Dental', declaredHours: { 2: [['09:00', '20:00']], 3: [['09:00', '20:00']], 4: [['09:00', '20:00']], 5: [['09:00', '17:00']], 6: [['09:00', '15:00']] } },
  north: { id: 'north', name: 'Northstar Learning', category: 'Tutoring', declaredHours: { 1: [['15:30', '20:00']], 2: [['15:30', '20:00']], 3: [['15:30', '20:00']], 4: [['15:30', '20:00']], 6: [['09:00', '15:00']] } },
  prairie: { id: 'prairie', name: 'Prairie Tutors', category: 'Tutoring', declaredHours: { 1: [['16:00', '20:00']], 3: [['16:00', '20:00']], 6: [['10:00', '16:00']] } },
  aurora: { id: 'aurora', name: 'Aurora Auto Repair', category: 'Auto', declaredHours: WEEKDAYS_8_6 },

  // --- tier 3: unknown. No feed, no declared hours, nothing readable. -------
  // This is the realistic default for a marketplace that has just signed a
  // business up, and the app has to work for them from day one.
  maple: { id: 'maple', name: 'Maple Grove Property Group', category: 'Rentals' },
  bright: { id: 'bright', name: 'Bright Path Immigration', category: 'Immigration' },
  truebuild: { id: 'truebuild', name: 'TrueBuild Renovations', category: 'Renovation' },
  hometable: { id: 'hometable', name: 'Home Table Catering', category: 'Catering' },
  chinook: { id: 'chinook', name: 'Chinook Tax and Bookkeeping', category: 'Taxes' },
  bowness: { id: 'bowness', name: 'Bowness Rentals', category: 'Rentals' },
};

function get(id) {
  return Object.prototype.hasOwnProperty.call(BUSINESSES, id) ? BUSINESSES[id] : null;
}

function all() {
  return Object.values(BUSINESSES);
}

module.exports = { get, all, BUSINESSES };
