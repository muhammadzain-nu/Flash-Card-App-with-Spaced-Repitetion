/**
 * @file main.js
 * @description ES Module entry point for the Smart Flashcard Learning System.
 *
 * Responsibilities:
 *   • Bootstrap: dark mode, initial data load, stat rendering
 *   • Navigation / view switching
 *   • Deck & Card CRUD (modal open/close, form submit)
 *   • Study session flow (flip, rate, progress, complete screen)
 *   • Import / Export wiring
 *   • Toast notifications
 *
 * DOM Security Rule (enforced throughout):
 *   ALL user-supplied text is inserted via textContent or createTextNode —
 *   NEVER via innerHTML / outerHTML / insertAdjacentHTML — to prevent XSS.
 *
 * Depends on (classic scripts loaded before this module in index.html):
 *   • js/sm2.js        → window.QUALITY, window.updateSM2, window.createCard,
 *                        window.createDeck, window.getDueCards
 *   • js/studySession.js → window.StudySession
 */

const { initDarkMode, toggleDarkMode, isDarkMode } = window.FM.DarkMode;
const { exportDecks, importDecks } = window.FM.ImportExport;
const {
  getAllDecks, getDeckById, createDeck, renameDeck, deleteDeck,
  addCard, editCard, deleteCard, updateDeckCards, getDashboardStats,
} = window.FM.DeckManager;

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

const init = () => {
  initDarkMode();
  syncDarkModeToggle();
  renderDashboard();
  wireNavigation();
  wireDarkModeToggle();
  wireDeckModal();
  wireCardModal();
  wireConfirmModal();
  wireImportExport();
  wireStudySession();
  wireTopBarNewDeck();
  wireMobileMenu();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows a toast message. Never uses innerHTML — text is set via textContent.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = icons[type] ?? 'ℹ️';

  const text = document.createElement('span');
  text.textContent = message;   // ✅ Safe — never innerHTML

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  // Auto-remove after 3 s (matches CSS animation)
  setTimeout(() => {
    if (toast.parentNode === container) container.removeChild(toast);
  }, 3100);
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION & VIEW SWITCHING
// ─────────────────────────────────────────────────────────────────────────────

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  decks: 'My Decks',
  study: 'Study',
  deckDetail: 'Deck',
};

/** Currently active view id */
let _activeView = 'dashboard';
/** ID of the deck being viewed in deck-detail */
let _activeDeckId = null;

function wireNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'study') renderStudyPicker();
      switchView(view);
    });
  });

  // "View All" button on dashboard
  const btnViewAll = document.getElementById('btn-view-all-decks');
  if (btnViewAll) {
    btnViewAll.addEventListener('click', () => {
      renderDecksView();
      switchView('decks');
    });
  }
}

/**
 * Switches the visible view.
 * @param {'dashboard'|'decks'|'study'|'deckDetail'} viewKey
 */
function switchView(viewKey) {
  _activeView = viewKey;

  const viewMap = {
    dashboard: 'view-dashboard',
    decks: 'view-decks',
    study: 'view-study',
    deckDetail: 'view-deck-detail',
  };

  // Toggle .active on all view sections
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(viewMap[viewKey]);
  if (target) target.classList.add('active');

  // Update top bar heading — using textContent only
  const heading = document.getElementById('page-heading');
  if (heading) heading.textContent = VIEW_TITLES[viewKey] ?? viewKey;

  // Sync nav active state
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewKey);
  });

  // Render the view
  if (viewKey === 'dashboard') renderDashboard();
  if (viewKey === 'decks') renderDecksView();
  if (viewKey === 'study') renderStudyPicker();
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

function wireDarkModeToggle() {
  const btn = document.getElementById('dark-mode-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    toggleDarkMode();
    syncDarkModeToggle();
  });
}

function syncDarkModeToggle() {
  const btn = document.getElementById('dark-mode-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(isDarkMode()));
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE MENU
// ─────────────────────────────────────────────────────────────────────────────

function wireMobileMenu() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (!mobileBtn || !sidebar) return;

  if (window.innerWidth <= 768) mobileBtn.style.display = 'flex';

  mobileBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  window.addEventListener('resize', () => {
    mobileBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    if (window.innerWidth > 768) sidebar.classList.remove('open');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD RENDERING
// ─────────────────────────────────────────────────────────────────────────────

function renderDashboard() {
  const stats = getDashboardStats();

  _setText('stat-total-decks', String(stats.totalDecks));
  _setText('stat-total-cards', String(stats.totalCards));
  _setText('stat-due-today', String(stats.dueToday));
  _setText('stat-retention', `${stats.retentionRate}%`);

  // Show up to 4 recent decks
  const decks = getAllDecks().slice(-4).reverse();
  const grid = document.getElementById('dashboard-deck-grid');
  if (!grid) return;
  grid.replaceChildren();  // ✅ Safe clear — no innerHTML
  renderDeckCards(decks, grid, { compact: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// DECKS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function renderDecksView() {
  const grid = document.getElementById('all-deck-grid');
  if (!grid) return;
  grid.replaceChildren();
  renderDeckCards(getAllDecks(), grid, { compact: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DECK CARD BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const DECK_EMOJIS = ['📚', '🧠', '🔬', '💡', '🎯', '🌍', '🎵', '⚗️', '🖥️', '📐'];

/**
 * Renders deck cards into a grid container using safe DOM methods.
 * @param {Array}       decks
 * @param {HTMLElement} container
 * @param {{ compact: boolean }} opts
 */
function renderDeckCards(decks, container, { compact }) {
  if (decks.length === 0) {
    const empty = _buildEmptyState(
      '🃏', 'No decks yet', 'Create your first deck to start learning!', 'New Deck',
      () => openDeckModal()
    );
    container.appendChild(empty);
    return;
  }

  decks.forEach((deck, idx) => {
    const now = new Date();
    const dueCount = deck.cards.filter(c => new Date(c.dueDate) <= now).length;
    const emoji = DECK_EMOJIS[idx % DECK_EMOJIS.length];

    // Root card element
    const card = document.createElement('div');
    card.className = 'deck-card';
    card.setAttribute('role', 'listitem');

    // Header row
    const header = document.createElement('div');
    header.className = 'deck-card__header';

    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'deck-card__emoji';
    emojiDiv.setAttribute('aria-hidden', 'true');
    emojiDiv.textContent = emoji;   // ✅ textContent

    const actions = document.createElement('div');
    actions.className = 'deck-card__actions';

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon btn-sm';
    editBtn.setAttribute('aria-label', `Rename deck ${deck.name}`);
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openDeckModal(deck); });

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.setAttribute('aria-label', `Delete deck ${deck.name}`);
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openConfirmModal(
        'Delete Deck?',
        `"${deck.name}" and all its cards will be permanently deleted.`,
        () => {
          deleteDeck(deck.id);
          renderDashboard();
          renderDecksView();
          showToast('Deck deleted.', 'success');
        }
      );
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    header.appendChild(emojiDiv);
    header.appendChild(actions);

    // Name
    const name = document.createElement('div');
    name.className = 'deck-card__name';
    name.textContent = deck.name;   // ✅ textContent

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'deck-card__meta';

    const cardsSpan = document.createElement('span');
    cardsSpan.textContent = `${deck.cards.length} card${deck.cards.length !== 1 ? 's' : ''}`;

    const dueSpan = document.createElement('span');
    dueSpan.className = 'deck-card__due';
    dueSpan.textContent = dueCount > 0 ? `${dueCount} due` : '✓ up to date';

    meta.appendChild(cardsSpan);
    meta.appendChild(dueSpan);

    // Open detail / study button
    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-secondary btn-sm deck-card__btn';
    openBtn.setAttribute('aria-label', `Open deck ${deck.name}`);
    openBtn.textContent = compact ? 'Open Deck' : 'Manage Cards';
    openBtn.addEventListener('click', () => openDeckDetail(deck.id));

    card.appendChild(header);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(openBtn);
    container.appendChild(card);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

function openDeckDetail(deckId) {
  _activeDeckId = deckId;
  renderDeckDetail();
  switchView('deckDetail');
}

function renderDeckDetail() {
  const deck = getDeckById(_activeDeckId);
  if (!deck) { switchView('decks'); return; }

  _setText('deck-detail-title', deck.name);   // ✅ safe

  const list = document.getElementById('card-list');
  if (!list) return;
  list.replaceChildren();

  if (deck.cards.length === 0) {
    const empty = _buildEmptyState(
      '➕', 'No cards yet', 'Add your first card to this deck.', 'Add Card',
      () => openCardModal()
    );
    list.appendChild(empty);
    return;
  }

  const now = new Date();
  deck.cards.forEach(card => {
    const isDue = new Date(card.dueDate) <= now;

    const item = document.createElement('div');
    item.className = 'card-item';
    item.setAttribute('role', 'listitem');

    // Body
    const body = document.createElement('div');
    body.className = 'card-item__body';

    const front = document.createElement('div');
    front.className = 'card-item__front';
    front.textContent = card.front;   // ✅ textContent

    const back = document.createElement('div');
    back.className = 'card-item__back';
    back.textContent = card.back;     // ✅ textContent

    body.appendChild(front);
    body.appendChild(back);

    // Due badge
    const badge = document.createElement('span');
    badge.className = `card-item__badge ${isDue ? 'badge-due' : 'badge-ok'}`;
    badge.textContent = isDue ? 'Due' : 'OK';

    // Actions
    const actions = document.createElement('div');
    actions.className = 'card-item__actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon btn-sm';
    editBtn.setAttribute('aria-label', `Edit card: ${card.front}`);
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => openCardModal(card));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.setAttribute('aria-label', `Delete card: ${card.front}`);
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => {
      openConfirmModal(
        'Delete Card?',
        'This card will be permanently deleted.',
        () => {
          deleteCard(_activeDeckId, card.id);
          renderDeckDetail();
          showToast('Card deleted.', 'success');
        }
      );
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(body);
    item.appendChild(badge);
    item.appendChild(actions);
    list.appendChild(item);
  });

  // Wire back / study buttons once per render
  _once('btn-back-to-decks', 'click', () => { renderDecksView(); switchView('decks'); });
  _once('btn-study-this-deck', 'click', () => beginStudySession(_activeDeckId));
  _once('btn-add-card', 'click', () => openCardModal());
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK MODAL (Create / Rename)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Object|null} Deck being edited, or null for create mode */
let _editingDeck = null;

function wireDeckModal() {
  document.getElementById('modal-deck-close')?.addEventListener('click', closeDeckModal);
  document.getElementById('modal-deck-cancel')?.addEventListener('click', closeDeckModal);
  document.getElementById('modal-deck-save')?.addEventListener('click', submitDeckModal);

  document.getElementById('input-deck-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitDeckModal();
  });

  // Close on backdrop click
  document.getElementById('modal-deck')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDeckModal();
  });
}

function openDeckModal(deck = null) {
  _editingDeck = deck;
  const title = document.getElementById('modal-deck-title');
  const input = document.getElementById('input-deck-name');
  if (title) title.textContent = deck ? 'Rename Deck' : 'New Deck';
  if (input) {
    input.value = deck ? deck.name : '';
    setTimeout(() => input.focus(), 80);
  }
  document.getElementById('modal-deck')?.classList.add('open');
}

function closeDeckModal() {
  document.getElementById('modal-deck')?.classList.remove('open');
  _editingDeck = null;
}

function submitDeckModal() {
  const input = document.getElementById('input-deck-name');
  const name = input?.value?.trim() ?? '';
  if (!name) { showToast('Deck name cannot be empty.', 'error'); return; }

  try {
    if (_editingDeck) {
      renameDeck(_editingDeck.id, name);
      showToast('Deck renamed!', 'success');
    } else {
      createDeck(name);
      showToast('Deck created!', 'success');
    }
    closeDeckModal();
    renderDashboard();
    renderDecksView();
    if (_activeView === 'deckDetail') renderDeckDetail();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function wireTopBarNewDeck() {
  document.getElementById('btn-new-deck')?.addEventListener('click', () => openDeckModal());
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD MODAL (Add / Edit)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Object|null} Card being edited, or null for create mode */
let _editingCard = null;

function wireCardModal() {
  document.getElementById('modal-card-close')?.addEventListener('click', closeCardModal);
  document.getElementById('modal-card-cancel')?.addEventListener('click', closeCardModal);
  document.getElementById('modal-card-save')?.addEventListener('click', submitCardModal);

  document.getElementById('modal-card')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCardModal();
  });
}

function openCardModal(card = null) {
  _editingCard = card;
  const title = document.getElementById('modal-card-title');
  const front = document.getElementById('input-card-front');
  const back = document.getElementById('input-card-back');
  if (title) title.textContent = card ? 'Edit Card' : 'Add Card';
  if (front) front.value = card?.front ?? '';
  if (back) back.value = card?.back ?? '';
  document.getElementById('modal-card')?.classList.add('open');
  setTimeout(() => front?.focus(), 80);
}

function closeCardModal() {
  document.getElementById('modal-card')?.classList.remove('open');
  _editingCard = null;
}

function submitCardModal() {
  const front = document.getElementById('input-card-front')?.value?.trim() ?? '';
  const back = document.getElementById('input-card-back')?.value?.trim() ?? '';
  if (!front) { showToast('Front text cannot be empty.', 'error'); return; }
  if (!back) { showToast('Back text cannot be empty.', 'error'); return; }
  if (!_activeDeckId) { showToast('No deck selected.', 'error'); return; }

  try {
    if (_editingCard) {
      editCard(_activeDeckId, _editingCard.id, front, back);
      showToast('Card updated!', 'success');
    } else {
      addCard(_activeDeckId, front, back);
      showToast('Card added!', 'success');
    }
    closeCardModal();
    renderDeckDetail();
    renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Function|null} */
let _confirmCallback = null;

function wireConfirmModal() {
  document.getElementById('modal-confirm-close')?.addEventListener('click', closeConfirmModal);
  document.getElementById('modal-confirm-cancel')?.addEventListener('click', closeConfirmModal);
  document.getElementById('modal-confirm-ok')?.addEventListener('click', () => {
    if (_confirmCallback) _confirmCallback();
    closeConfirmModal();
  });
  document.getElementById('modal-confirm')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeConfirmModal();
  });
}

/**
 * @param {string}   title
 * @param {string}   body
 * @param {Function} onConfirm
 */
function openConfirmModal(title, body, onConfirm) {
  _confirmCallback = onConfirm;
  const t = document.getElementById('modal-confirm-title');
  const b = document.getElementById('modal-confirm-body');
  if (t) t.textContent = title;   // ✅ textContent
  if (b) b.textContent = body;    // ✅ textContent
  document.getElementById('modal-confirm')?.classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('modal-confirm')?.classList.remove('open');
  _confirmCallback = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function wireImportExport() {
  // Export
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const decks = getAllDecks();
    if (decks.length === 0) { showToast('No decks to export.', 'info'); return; }
    exportDecks(decks);
    showToast('Export started!', 'success');
  });

  // Import
  const fileInput = document.getElementById('import-file-input');
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const importedDecks = await importDecks(file);

      // Merge: imported decks by ID; keep existing if no conflict
      const existing = getAllDecks();
      const existingMap = new Map(existing.map(d => [d.id, d]));

      for (const d of importedDecks) {
        existingMap.set(d.id, d);  // overwrite on ID collision
      }

      const { saveDecks } = window.FM.Storage;
      saveDecks([...existingMap.values()]);

      renderDashboard();
      renderDecksView();
      showToast(`Imported ${importedDecks.length} deck(s) successfully!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      // Reset so the same file can be re-imported if needed
      fileInput.value = '';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDY SESSION
// ─────────────────────────────────────────────────────────────────────────────

/** Track which deck the active session belongs to */
let _studyDeckId = null;
let _sessionTotal = 0;
let _sessionReviewed = 0;

function renderStudyPicker() {
  // Show picker, hide session and complete screens
  _setDisplay('study-picker', 'block');
  _setDisplay('study-session-ui', 'none');
  _setDisplay('study-complete-ui', 'none');

  const grid = document.getElementById('study-deck-grid');
  if (!grid) return;
  grid.replaceChildren();

  const decks = getAllDecks();
  const now = new Date();

  if (decks.length === 0) {
    const empty = _buildEmptyState('🃏', 'No decks yet', 'Create a deck first, then come back to study.', null, null);
    grid.appendChild(empty);
    return;
  }

  decks.forEach((deck, idx) => {
    const dueCount = deck.cards.filter(c => new Date(c.dueDate) <= now).length;
    const emoji = DECK_EMOJIS[idx % DECK_EMOJIS.length];

    const card = document.createElement('div');
    card.className = 'deck-card';
    card.setAttribute('role', 'listitem');

    const header = document.createElement('div');
    header.className = 'deck-card__header';
    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'deck-card__emoji';
    emojiDiv.setAttribute('aria-hidden', 'true');
    emojiDiv.textContent = emoji;
    header.appendChild(emojiDiv);

    const name = document.createElement('div');
    name.className = 'deck-card__name';
    name.textContent = deck.name;

    const meta = document.createElement('div');
    meta.className = 'deck-card__meta';
    const dueSpan = document.createElement('span');
    dueSpan.className = dueCount > 0 ? 'deck-card__due' : '';
    dueSpan.textContent = dueCount > 0 ? `${dueCount} card${dueCount !== 1 ? 's' : ''} due` : '✓ Nothing due today';
    meta.appendChild(dueSpan);

    const studyBtn = document.createElement('button');
    studyBtn.className = 'btn btn-primary btn-sm deck-card__btn';
    studyBtn.textContent = dueCount > 0 ? 'Study Now' : 'Review Early';
    studyBtn.setAttribute('aria-label', `Study deck ${deck.name}`);
    studyBtn.disabled = false;
    studyBtn.addEventListener('click', () => beginStudySession(deck.id));

    card.appendChild(header);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(studyBtn);
    grid.appendChild(card);
  });
}

function wireStudySession() {
  // Flashcard flip on click or Enter/Space keydown
  const flashcard = document.getElementById('flashcard');
  flashcard?.addEventListener('click', () => handleFlip());
  flashcard?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFlip(); }
  });

  // Rating buttons
  document.getElementById('rate-again')?.addEventListener('click', () => handleRate(QUALITY.AGAIN));
  document.getElementById('rate-hard')?.addEventListener('click', () => handleRate(QUALITY.HARD));
  document.getElementById('rate-good')?.addEventListener('click', () => handleRate(QUALITY.GOOD));
  document.getElementById('rate-easy')?.addEventListener('click', () => handleRate(QUALITY.EASY));

  // End session
  document.getElementById('btn-end-session')?.addEventListener('click', () => {
    endSession();
  });

  // Complete screen buttons
  document.getElementById('btn-study-again')?.addEventListener('click', () => {
    if (_studyDeckId) beginStudySession(_studyDeckId);
  });
  document.getElementById('btn-back-from-complete')?.addEventListener('click', () => {
    switchView('dashboard');
  });
}

/**
 * Starts a study session for the given deck.
 * Uses the existing StudySession global (from studySession.js).
 * @param {string} deckId
 */
function beginStudySession(deckId) {
  const deck = getDeckById(deckId);
  if (!deck) { showToast('Deck not found.', 'error'); return; }

  // Allow studying all cards even if not due (for early review)
  const allCards = deck.cards;
  if (allCards.length === 0) {
    showToast('This deck has no cards yet.', 'info');
    return;
  }

  _studyDeckId = deckId;
  _sessionReviewed = 0;

  // Use the classic StudySession (global from studySession.js)
  const result = StudySession.startStudySession(deck);
  _sessionTotal = result.totalDue > 0 ? result.totalDue : allCards.length;

  // If nothing due, force all cards into the queue by passing a deck copy
  // where all cards are due — user chose "Review Early"
  if (!result.started) {
    const forcedDeck = {
      ...deck,
      cards: deck.cards.map(c => ({ ...c, dueDate: new Date().toISOString() })),
    };
    StudySession.startStudySession(forcedDeck);
    _sessionTotal = forcedDeck.cards.length;
  }

  _setDisplay('study-picker', 'none');
  _setDisplay('study-session-ui', 'block');
  _setDisplay('study-complete-ui', 'none');

  switchView('study');
  renderNextCard();
}

function renderNextCard() {
  const card = StudySession.getNextCard();
  if (!card) { endSession(); return; }

  // Reset flip state
  const flashcard = document.getElementById('flashcard');
  flashcard?.classList.remove('flipped');

  // Set text — never innerHTML
  _setText('card-front-text', card.front);
  _setText('card-back-text', card.back);

  // Hide rating buttons until flipped
  document.getElementById('rating-buttons')?.classList.add('hidden');

  updateProgress();
}

function handleFlip() {
  const session = StudySession.getSessionState();
  if (session.isFlipped) return;  // already flipped

  StudySession.flipCard();

  document.getElementById('flashcard')?.classList.add('flipped');
  document.getElementById('rating-buttons')?.classList.remove('hidden');
}

function handleRate(quality) {
  const card = StudySession.getNextCard();
  if (!card) return;

  const { isComplete } = StudySession.reviewCard(card, quality);
  _sessionReviewed++;

  // Persist the updated deck via deckManager
  const session = StudySession.getSessionState();
  if (session.deck) {
    updateDeckCards(_studyDeckId, session.deck.cards);
  }

  renderDashboard();  // keep stats fresh

  if (isComplete) {
    endSession();
  } else {
    renderNextCard();
  }
}

function endSession() {
  const summary = StudySession.finishSession();

  // Persist final state
  if (summary?.deck) {
    updateDeckCards(_studyDeckId, summary.deck.cards);
  }

  renderDashboard();

  _setDisplay('study-session-ui', 'none');
  _setDisplay('study-complete-ui', 'block');
  _setText('complete-reviewed', String(_sessionReviewed));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

function updateProgress() {
  const total = _sessionTotal;
  const done = _sessionReviewed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('progress-bar');
  const track = document.getElementById('progress-track');
  const label = document.getElementById('progress-label');

  if (bar) bar.style.width = `${pct}%`;
  if (track) track.setAttribute('aria-valuenow', String(pct));
  if (label) label.textContent = `${done} / ${total}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM UTILITIES  (all safe — never innerHTML)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sets textContent of an element by id.
 * @param {string} id
 * @param {string} text
 */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;   // ✅ safe
}

/**
 * Sets display style of an element by id.
 * @param {string} id
 * @param {string} value
 */
function _setDisplay(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.display = value;
}

/**
 * Registers a one-time event listener (replaces the element clone to drop old handlers).
 * @param {string}   id
 * @param {string}   event
 * @param {Function} fn
 */
function _once(id, event, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  const clone = el.cloneNode(true);
  el.parentNode?.replaceChild(clone, el);
  clone.addEventListener(event, fn);
}

/**
 * Builds a reusable empty-state element (no innerHTML).
 * @param {string}        emoji
 * @param {string}        title
 * @param {string}        text
 * @param {string|null}   btnLabel
 * @param {Function|null} btnFn
 * @returns {HTMLElement}
 */
function _buildEmptyState(emoji, title, text, btnLabel, btnFn) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'empty-state__icon';
  iconDiv.setAttribute('aria-hidden', 'true');
  iconDiv.textContent = emoji;

  const titleEl = document.createElement('div');
  titleEl.className = 'empty-state__title';
  titleEl.textContent = title;

  const textEl = document.createElement('p');
  textEl.className = 'empty-state__text';
  textEl.textContent = text;

  wrap.appendChild(iconDiv);
  wrap.appendChild(titleEl);
  wrap.appendChild(textEl);

  if (btnLabel && btnFn) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = btnLabel;
    btn.addEventListener('click', btnFn);
    wrap.appendChild(btn);
  }

  return wrap;
}
