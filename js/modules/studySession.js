/**
 * @fileoverview Study Session Module  (Prompt 2 — Core Session Functions)
 * Smart Flashcard Learning System — Logic Layer
 *
 * Depends on: sm2.js loaded before this file (provides updateSM2, QUALITY)
 * No DOM access — pure data manipulation only.
 *
 * All functions operate on the module-level `session` state object below.
 * The UI layer (app.js / index.html) calls these functions and reads the
 * returned values to know what to render.
 */

const StudySession = (function () {
  // ─────────────────────────────────────────────────────────────────────────────
  // MODULE-LEVEL SESSION STATE
  // ─────────────────────────────────────────────────────────────────────────────
  // Single source of truth for an in-progress study session.
  // Reset by startStudySession(); read by every other function here.

  let session = {
    deck: null,   // Reference to the full deck object being studied
    queue: [],     // Ordered array of due cards not yet reviewed this session
    queueIndex: 0,      // Pointer to the current position in the queue
    reviewed: [],     // Cards that have been rated (with updated SM-2 values)
    isFlipped: false,  // Whether the answer side of the current card is visible
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. getDueCards(deck)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Filters a deck's cards to those whose dueDate is today or in the past.
   *
   * @param {Object}   deck        - A deck object with a `cards` array
   * @param {Object[]} deck.cards  - Array of flashcard objects
   * @returns {Object[]} Cards that are ready for review right now
   *
   * @example
   * const due = getDueCards(myDeck);  // → [card1, card3, ...]
   */
  function getDueCards(deck) {
    const now = new Date();

    // Compare each card's scheduled dueDate against the current timestamp.
    // new Date(isoString) <= now  means the card is overdue or due today.
    return deck.cards.filter(card => new Date(card.dueDate) <= now);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. startStudySession(deck)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initialises the module-level session state for a new study session.
   * Must be called before any other session function.
   *
   * @param {Object} deck - The deck object to study (must have .cards and .name)
   * @returns {{ started: boolean, totalDue: number }}
   *   started   → false if there are no due cards (nothing to study)
   *   totalDue  → number of cards queued for this session
   *
   * @example
   * const result = startStudySession(programmingDeck);
   * if (!result.started) showMessage('Nothing due today!');
   */
  function startStudySession(deck) {
    const dueCards = getDueCards(deck);

    // Reset the entire session state so a previous session doesn't leak through
    session.deck = deck;
    session.queue = [...dueCards];  // shallow clone — we don't mutate deck.cards directly
    session.queueIndex = 0;
    session.reviewed = [];
    session.isFlipped = false;

    return {
      started: dueCards.length > 0,
      totalDue: dueCards.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. showCard(card)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a render-ready object for the current card's front face.
   * The UI layer uses this data to populate the card display — no DOM here.
   *
   * @param {Object} card        - A flashcard object (from getNextCard())
   * @param {string} card.front  - The question / prompt text
   * @returns {{
   *   front:     string,   - Question text to display
   *   deckName:  string,   - Name of the deck (for the header label)
   *   remaining: number    - How many cards are still in the queue (including this one)
   * }}
   *
   * @example
   * const display = showCard(currentCard);
   * cardEl.textContent = display.front;
   */
  function showCard(card) {
    // Cards remaining = total queue length minus how far we've advanced.
    // +1 because queueIndex points to the *current* card (0-based).
    const remaining = session.queue.length - session.queueIndex;

    return {
      front: card.front,
      deckName: session.deck ? session.deck.name : '',
      remaining,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. flipCard()
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Marks the current card as flipped so the answer side can be revealed.
   * Sets the module-level `session.isFlipped` flag to true.
   *
   * The UI should check this flag before showing rating buttons — you can't
   * rate a card you haven't seen the answer to yet.
   *
   * @returns {{ back: string, isFlipped: boolean }}
   *   back      → the answer text for the current card
   *   isFlipped → always true after a successful flip
   *
   * @example
   * const { back } = flipCard();
   * answerEl.textContent = back;
   */
  function flipCard() {
    const current = getNextCard();

    // Guard: can't flip if there's no active card
    if (!current) return { back: '', isFlipped: false };

    // Set the module-level flag — rating buttons should now be enabled
    session.isFlipped = true;

    return {
      back: current.back,
      isFlipped: true,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. reviewCard(card, quality)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Applies SM-2 to the given card, writes the result back into deck.cards,
   * saves it to the session's reviewed list, and advances the queue pointer.
   *
   * Cards rated AGAIN (quality 0) are re-appended to the end of the queue
   * so the user will see them again before the session ends.
   *
   * @param {Object} card    - The flashcard being rated (must be the current card)
   * @param {number} quality - SM-2 quality score: use QUALITY.AGAIN/HARD/GOOD/EASY
   * @returns {{ updatedCard: Object, isComplete: boolean }}
   *   updatedCard → the card with new SM-2 scheduling values
   *   isComplete  → true if the queue is now empty (session finished)
   *
   * @example
   * const { updatedCard, isComplete } = reviewCard(card, QUALITY.GOOD);
   * if (isComplete) showSummary(finishSession());
   */
  function reviewCard(card, quality) {
    // Guard: the card must be flipped before it can be rated
    if (!session.isFlipped) return { updatedCard: card, isComplete: false };

    // Apply the SM-2 algorithm — returns a new card object (pure function)
    const updatedCard = updateSM2(card, quality);

    // Write the updated scheduling data back into the live deck.cards array
    // so the changes persist when the UI calls saveToStorage() later
    if (session.deck) {
      const idx = session.deck.cards.findIndex(c => c.id === card.id);
      if (idx !== -1) {
        session.deck.cards[idx] = updatedCard;
      }
    }

    // Track reviewed cards for the session summary
    session.reviewed.push(updatedCard);

    // AGAIN cards go to the back of the queue — the user must see them again
    if (quality === QUALITY.AGAIN) {
      session.queue.push(updatedCard);
    }

    // Advance the queue pointer past the card just reviewed
    session.queueIndex += 1;

    // Reset the flip flag ready for the next card
    session.isFlipped = false;

    return {
      updatedCard,
      isComplete: session.queueIndex >= session.queue.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. getNextCard()
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the next card in the queue, or null if the session is complete.
   *
   * The UI calls this after reviewCard() to know what to show next.
   * Also used internally by flipCard() and showCard().
   *
   * @returns {Object|null} The current card object, or null when queue is exhausted
   *
   * @example
   * const card = getNextCard();
   * if (!card) showSessionComplete();
   * else renderCard(showCard(card));
   */
  function getNextCard() {
    // Return null when the queue pointer has reached (or passed) the end
    if (session.queueIndex >= session.queue.length) return null;

    return session.queue[session.queueIndex];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. finishSession()
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Ends the current study session and returns a summary object.
   * Should be called once getNextCard() returns null (queue exhausted),
   * or if the user manually ends the session early.
   *
   * Resets the module-level session state after collecting the summary.
   *
   * @returns {{
   *   reviewed: Object[],  - All cards reviewed this session (with updated SM-2 values)
   *   deck:     Object     - The deck object (with scheduling already written back in)
   * }}
   *
   * @example
   * const summary = finishSession();
   * console.log(`Reviewed ${summary.reviewed.length} cards from "${summary.deck.name}"`);
   */
  function finishSession() {
    // Collect the summary before wiping state
    const summary = {
      reviewed: [...session.reviewed],   // copy so callers get a stable snapshot
      deck: session.deck,
    };

    // Reset module state — a fresh startStudySession() call is required next time
    session.deck = null;
    session.queue = [];
    session.queueIndex = 0;
    session.reviewed = [];
    session.isFlipped = false;

    return summary;
  }

  return {
    getDueCards,
    startStudySession,
    showCard,
    flipCard,
    reviewCard,
    getNextCard,
    finishSession,
    getSessionState: () => session
  };
})();