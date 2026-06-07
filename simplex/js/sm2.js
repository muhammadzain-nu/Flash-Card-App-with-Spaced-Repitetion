/**
 * @fileoverview SM-2 Spaced Repetition Algorithm
 * Smart Flashcard Learning System — Foundation Layer
 * No UI, no imports/exports — consumed inline in a single HTML file.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DATA STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new flashcard with SM-2 default scheduling values.
 *
 * @param {string} id        - Unique identifier (e.g. crypto.randomUUID())
 * @param {string} front     - Question / prompt shown to the user
 * @param {string} back      - Answer / explanation revealed on flip
 * @returns {Object} A fully initialised flashcard ready for scheduling
 *
 * @example
 * const card = createCard('c1', 'What is a closure?', 'A function that captures its lexical scope.');
 */
function createCard(id, front, back) {
  return {
    id,
    front,
    back,
    repetitions: 0,       // Number of times reviewed with quality >= 3
    interval: 1,          // Days until next review
    easeFactor: 2.5,      // Multiplier for interval growth (minimum 1.3)
    dueDate: new Date().toISOString(),  // ISO-8601; card is due immediately on creation
    lastReviewed: null,   // ISO-8601 of the last review session, or null if never
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps review-button labels to SM-2 quality scores (0–5).
 *
 * SM-2 quality scale:
 *   0 = complete blackout (Again)
 *   3 = correct with significant difficulty (Hard)
 *   4 = correct after some hesitation (Good)
 *   5 = perfect, immediate recall (Easy)
 *
 * @readonly
 * @enum {number}
 */
const QUALITY = {
  AGAIN: 0,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
};

// ─────────────────────────────────────────────────────────────────────────────
// SM-2 ALGORITHM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies the SM-2 spaced-repetition algorithm to a card and returns
 * a new card object with updated scheduling data.
 *
 * Pure function — the original card is never mutated.
 *
 * Algorithm steps:
 *   1. If quality < 3 (Again) → reset to beginning (rep=0, interval=1).
 *   2. Else increment repetitions and compute new interval:
 *        rep == 1 → interval = 1
 *        rep == 2 → interval = 6
 *        rep  > 2 → interval = round(prevInterval × easeFactor)
 *   3. Update easeFactor:
 *        EF' = EF + (0.1 − (5−q) × (0.08 + (5−q) × 0.02))
 *        Clamped to a minimum of 1.3.
 *   4. Set dueDate = today + interval days.
 *   5. Set lastReviewed = now.
 *
 * @param {Object} card           - Flashcard object (see createCard)
 * @param {number} quality        - Review quality score (use QUALITY constants)
 * @returns {Object}              - New card object with updated SM-2 fields
 *
 * @example
 * const updated = updateSM2(card, QUALITY.GOOD);
 * console.log(updated.interval, updated.dueDate);
 */
function updateSM2(card, quality) {
  // Shallow-clone so the function remains pure
  const updated = { ...card };
  const now = new Date();

  updated.lastReviewed = now.toISOString();

  if (quality < 3) {
    // ── Failure path: the user did not recall the card ──────────────────────
    updated.repetitions = 0;
    updated.interval = 1;
  } else {
    // ── Success path: increment repetitions and grow interval ────────────────
    updated.repetitions += 1;

    if (updated.repetitions === 1) {
      updated.interval = 1;
    } else if (updated.repetitions === 2) {
      updated.interval = 6;
    } else {
      // Use the *previous* interval (card.interval) × the *current* easeFactor
      updated.interval = Math.round(card.interval * card.easeFactor);
    }
  }

  // ── Ease-factor update (applied regardless of pass/fail) ──────────────────
  // Formula: EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  updated.easeFactor = Math.max(1.3, card.easeFactor + delta);

  // ── Schedule next review date ─────────────────────────────────────────────
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + updated.interval);
  updated.dueDate = nextReview.toISOString();

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK HELPERS  (used by studySession.js and app.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all cards from a deck whose dueDate is today or in the past.
 *
 * @param {Object[]} cards - Array of flashcard objects
 * @returns {Object[]}     - Subset of cards that are due for review
 */
function getDueCards(cards) {
  const now = new Date();
  return cards.filter(card => new Date(card.dueDate) <= now);
}

/**
 * Creates a new deck object.
 *
 * @param {string} id    - Unique identifier
 * @param {string} name  - Human-readable deck name
 * @returns {Object}     - Deck object with an empty cards array
 *
 * @example
 * const deck = createDeck('d1', 'JavaScript Fundamentals');
 */
function createDeck(id, name) {
  return {
    id,
    name,
    cards: [],
    createdAt: new Date().toISOString(),
  };
}
