/**
 * @fileoverview app.js — Application Entry Point
 * Smart Flashcard Learning System — Integration Layer
 * Depends on: sm2.js, studySession.js (must be loaded before this file)
 *
 * Responsibilities:
 *   • localStorage persistence (load / save)
 *   • Application state management
 *   • Event wiring (called from index.html)
 *   • Deck and card CRUD operations
 *   • Import / export helpers
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'flashcard_app_data';
const VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton app state.  Mutated only through the action functions below.
 * @type {{ version: string, decks: Object[] }}
 */
let AppState = {
  version: VERSION,
  decks: [],
};

/** Currently active study session (null when not studying). */
let currentSession = null;

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads persisted data from localStorage into AppState.
 * Safe to call on every page load — falls back to empty state if nothing saved.
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      AppState = { ...AppState, ...parsed };
    }
  } catch (err) {
    console.warn('[app] Failed to load from localStorage:', err);
  }
}

/**
 * Persists the current AppState to localStorage.
 * Call after every state mutation.
 */
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
  } catch (err) {
    console.warn('[app] Failed to save to localStorage:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a new deck to the application.
 *
 * @param {string} name - Human-readable deck name
 * @returns {Object}    - The newly created deck
 */
function addDeck(name) {
  const deck = createDeck(crypto.randomUUID(), name.trim());
  AppState.decks.push(deck);
  saveToStorage();
  return deck;
}

/**
 * Removes a deck (and all its cards) by ID.
 *
 * @param {string} deckId
 */
function deleteDeck(deckId) {
  AppState.decks = AppState.decks.filter(d => d.id !== deckId);
  saveToStorage();
}

/**
 * Finds a deck by ID.
 *
 * @param {string} deckId
 * @returns {Object|undefined}
 */
function getDeckById(deckId) {
  return AppState.decks.find(d => d.id === deckId);
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a new flashcard to a deck.
 *
 * @param {string} deckId
 * @param {string} front  - Question text
 * @param {string} back   - Answer text
 * @returns {Object}      - The newly created card
 */
function addCard(deckId, front, back) {
  const deck = getDeckById(deckId);
  if (!deck) throw new Error(`Deck not found: ${deckId}`);
  const card = createCard(crypto.randomUUID(), front.trim(), back.trim());
  deck.cards.push(card);
  saveToStorage();
  return card;
}

/**
 * Updates the front/back text of an existing card.
 *
 * @param {string} deckId
 * @param {string} cardId
 * @param {string} front
 * @param {string} back
 */
function editCard(deckId, cardId, front, back) {
  const deck = getDeckById(deckId);
  if (!deck) return;
  const idx = deck.cards.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  deck.cards[idx] = { ...deck.cards[idx], front: front.trim(), back: back.trim() };
  saveToStorage();
}

/**
 * Removes a card from a deck.
 *
 * @param {string} deckId
 * @param {string} cardId
 */
function deleteCard(deckId, cardId) {
  const deck = getDeckById(deckId);
  if (!deck) return;
  deck.cards = deck.cards.filter(c => c.id !== cardId);
  saveToStorage();
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDY SESSION INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts a study session for the given deck.
 * Populates currentSession with only the due cards.
 *
 * @param {string} deckId
 * @returns {StudySession|null} null if no cards are due
 */
function startStudySession(deckId) {
  const deck = getDeckById(deckId);
  if (!deck) return null;
  const result = StudySession.startStudySession(deck);
  if (!result.started) return null;
  currentSession = StudySession.getSessionState();
  return currentSession;
}

/**
 * Flips the current card and updates currentSession.
 *
 * @returns {StudySession}
 */
function handleFlip() {
  if (!currentSession) return null;
  StudySession.flipCard();
  return currentSession;
}

/**
 * Rates the current card, applies SM-2, and persists the updated card.
 *
 * @param {number} quality - QUALITY constant
 * @returns {StudySession}
 */
function handleRate(quality) {
  if (!currentSession) return null;

  const currentCard = StudySession.getNextCard();
  if (!currentCard) return null;

  const { updatedCard, isComplete } = StudySession.reviewCard(currentCard, quality);

  // Persist the updated deck in localStorage
  saveToStorage();

  return currentSession;
}

/**
 * Ends the current session and returns a summary object.
 *
 * @returns {Object} Session summary
 */
function endStudySession() {
  if (!currentSession) return null;
  const summary = StudySession.finishSession();
  currentSession = null;
  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes aggregate stats across all decks for the dashboard.
 *
 * @returns {{
 *   totalDecks:      number,
 *   totalCards:      number,
 *   dueToday:        number,
 *   retentionRate:   number
 * }}
 */
function getDashboardStats() {
  let totalCards = 0;
  let dueToday = 0;
  let everReviewed = 0;
  let successfullyReviewed = 0;

  for (const deck of AppState.decks) {
    totalCards += deck.cards.length;
    dueToday += getDueCards(deck.cards).length;

    for (const card of deck.cards) {
      if (card.lastReviewed !== null) {
        everReviewed += 1;
        // A card is "retained" if its interval has grown past the initial 1
        if (card.interval > 1) successfullyReviewed += 1;
      }
    }
  }

  const retentionRate = everReviewed > 0
    ? Math.round((successfullyReviewed / everReviewed) * 100)
    : 0;

  return {
    totalDecks: AppState.decks.length,
    totalCards,
    dueToday,
    retentionRate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports all decks as a formatted JSON string ready for file download.
 *
 * @returns {string} JSON
 */
function exportData() {
  return JSON.stringify({ version: VERSION, decks: AppState.decks }, null, 2);
}

/**
 * Imports decks from a JSON string (produced by exportData).
 * Existing decks are preserved; imported decks are merged by ID.
 *
 * @param {string} jsonString
 * @throws {Error} if the JSON is invalid or the format is unrecognised
 */
function importData(jsonString) {
  const parsed = JSON.parse(jsonString);           // throws if invalid JSON
  if (!Array.isArray(parsed.decks)) {
    throw new Error('Invalid import format: expected a "decks" array.');
  }
  const existingIds = new Set(AppState.decks.map(d => d.id));
  for (const deck of parsed.decks) {
    if (existingIds.has(deck.id)) {
      // Replace the existing deck with the imported version
      const idx = AppState.decks.findIndex(d => d.id === deck.id);
      AppState.decks[idx] = deck;
    } else {
      AppState.decks.push(deck);
    }
  }
  saveToStorage();
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises the application on page load.
 * Call this once from the HTML: <script>initApp();</script>
 */
function initApp() {
  loadFromStorage();
  console.log('[app] Initialised. AppState:', AppState);
}
