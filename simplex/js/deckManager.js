/**
 * @file deckManager.js
 * @description Deck & Card CRUD layer for the Smart Flashcard Learning System.
 *
 * This module owns all create / read / update / delete operations for decks
 * and their cards, delegating persistence entirely to the storage module.
 *
 * Exposes window.FM.DeckManager (no ES modules, works on file:// protocol).
 *
 * Data flow
 * ─────────
 *   deckManager  →  storage  →  localStorage
 *   deckManager  ←  storage  ←  localStorage
 *
 * Consumed by: main.js / UI layer
 */

window.FM = window.FM || {};

(function () {

  // Retrieve dependencies from global FM namespace
  const { saveDecks, loadDecks } = window.FM.Storage;

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL FACTORIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Fallback UUID generator for non-secure contexts (e.g. file:// protocol)
   * where crypto.randomUUID is not available.
   */
  function _generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Creates a new deck object with default values.
   * @param {string} name
   * @returns {{ id: string, name: string, createdAt: string, cards: [] }}
   */
  function _newDeck(name) {
    return {
      id: _generateUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      cards: [],
    };
  }

  /**
   * Creates a new card object with SM-2 default scheduling values.
   * @param {string} front
   * @param {string} back
   * @returns {{
   *   id: string, front: string, back: string,
   *   repetitions: number, interval: number, easeFactor: number,
   *   dueDate: string, createdAt: string
   * }}
   */
  function _newCard(front, back) {
    return {
      id: _generateUUID(),
      front: front.trim(),
      back: back.trim(),
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      dueDate: new Date().toISOString(),   // due immediately on creation
      createdAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DECK OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns all decks from storage.
   * @returns {Array}
   */
  function getAllDecks() {
    return loadDecks();
  }

  /**
   * Finds a single deck by ID.
   * @param {string} deckId
   * @returns {Object|undefined}
   */
  function getDeckById(deckId) {
    return loadDecks().find(d => d.id === deckId);
  }

  /**
   * Creates a new deck and persists it.
   * @param {string} name - Human-readable deck name (non-empty).
   * @returns {Object} The newly created deck.
   * @throws {Error} If name is empty.
   */
  function createDeck(name) {
    if (!name || !name.trim()) {
      throw new Error('Deck name cannot be empty.');
    }
    const decks = loadDecks();
    const deck = _newDeck(name);
    decks.push(deck);
    saveDecks(decks);
    return deck;
  }

  /**
   * Renames an existing deck.
   * @param {string} deckId
   * @param {string} newName
   * @returns {Object|null} Updated deck, or null if not found.
   * @throws {Error} If newName is empty.
   */
  function renameDeck(deckId, newName) {
    if (!newName || !newName.trim()) {
      throw new Error('Deck name cannot be empty.');
    }
    const decks = loadDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return null;
    deck.name = newName.trim();
    saveDecks(decks);
    return deck;
  }

  /**
   * Deletes a deck (and all its cards) by ID.
   * @param {string} deckId
   * @returns {boolean} true if a deck was removed, false if not found.
   */
  function deleteDeck(deckId) {
    const decks = loadDecks();
    const filtered = decks.filter(d => d.id !== deckId);
    if (filtered.length === decks.length) return false;
    saveDecks(filtered);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CARD OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Adds a new card to the specified deck.
   * @param {string} deckId
   * @param {string} front  - Question text.
   * @param {string} back   - Answer text.
   * @returns {Object} The newly created card.
   * @throws {Error} If deck not found or front/back are empty.
   */
  function addCard(deckId, front, back) {
    if (!front || !front.trim()) throw new Error('Card front text cannot be empty.');
    if (!back || !back.trim()) throw new Error('Card back text cannot be empty.');

    const decks = loadDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) throw new Error(`Deck not found: ${deckId}`);

    const card = _newCard(front, back);
    deck.cards.push(card);
    saveDecks(decks);
    return card;
  }

  /**
   * Edits the front / back text of an existing card.
   * @param {string} deckId
   * @param {string} cardId
   * @param {string} front
   * @param {string} back
   * @returns {Object|null} Updated card, or null if deck/card not found.
   * @throws {Error} If front or back are empty.
   */
  function editCard(deckId, cardId, front, back) {
    if (!front || !front.trim()) throw new Error('Card front text cannot be empty.');
    if (!back || !back.trim()) throw new Error('Card back text cannot be empty.');

    const decks = loadDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return null;

    const idx = deck.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return null;

    deck.cards[idx] = { ...deck.cards[idx], front: front.trim(), back: back.trim() };
    saveDecks(decks);
    return deck.cards[idx];
  }

  /**
   * Deletes a card from a deck.
   * @param {string} deckId
   * @param {string} cardId
   * @returns {boolean} true if the card was removed, false otherwise.
   */
  function deleteCard(deckId, cardId) {
    const decks = loadDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return false;

    const before = deck.cards.length;
    deck.cards = deck.cards.filter(c => c.id !== cardId);
    if (deck.cards.length === before) return false;

    saveDecks(decks);
    return true;
  }

  /**
   * Writes back a batch of updated cards to a deck (used by study session after
   * SM-2 updates).
   * @param {string}   deckId
   * @param {Object[]} updatedCards - Full replacement array for deck.cards.
   * @returns {boolean} true on success.
   */
  function updateDeckCards(deckId, updatedCards) {
    const decks = loadDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return false;
    deck.cards = updatedCards;
    saveDecks(decks);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATISTICS HELPER
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Computes aggregate statistics across all decks for the dashboard.
   * @returns {{
   *   totalDecks:    number,
   *   totalCards:    number,
   *   dueToday:      number,
   *   retentionRate: number,
   * }}
   */
  function getDashboardStats() {
    const decks = loadDecks();
    const now = new Date();
    let totalCards = 0, dueToday = 0, everReviewed = 0, retained = 0;

    for (const deck of decks) {
      totalCards += deck.cards.length;
      for (const card of deck.cards) {
        if (new Date(card.dueDate) <= now) dueToday++;
        if (card.repetitions > 0) {
          everReviewed++;
          if (card.interval > 1) retained++;
        }
      }
    }

    return {
      totalDecks: decks.length,
      totalCards,
      dueToday,
      retentionRate: everReviewed > 0 ? Math.round((retained / everReviewed) * 100) : 0,
    };
  }

  // Expose on global namespace
  window.FM.DeckManager = {
    getAllDecks,
    getDeckById,
    createDeck,
    renameDeck,
    deleteDeck,
    addCard,
    editCard,
    deleteCard,
    updateDeckCards,
    getDashboardStats
  };

})();
