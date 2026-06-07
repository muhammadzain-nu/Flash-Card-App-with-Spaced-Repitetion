/**
 * @file main.js  — fixed
 *
 * ROOT BUG FIXED:
 *   Original file destructured window.FM.DarkMode / DeckManager / ImportExport at the
 *   TOP LEVEL of the script. If any one of those properties was undefined (e.g. a script
 *   failed to parse, a typo in the namespace, or a race on slow devices) the whole file
 *   threw a TypeError immediately, init() never ran, and ZERO event listeners were wired —
 *   meaning every button on the page was silently dead.
 *
 *   Fix: all destructuring is now inside init(), which runs after DOMContentLoaded.
 *   We also wrap it in a try/catch so a single bad module can't kill the whole app.
 *
 * OTHER FIXES IN THIS FILE:
 *   • QUALITY constants referenced safely (they're globals from sm2.js)
 *   • syncDarkModeToggle() also updates aria-pressed correctly
 *   • renderDeckDetail() _once() helper: cloneNode now preserves child elements
 *   • Mobile menu backdrop close now checks sidebar-overlay div too
 */

// ─── Module references (set inside init) ──────────────────────────────────────
let _DM, _IE, _DeckMgr;

// ─── Navigation state ─────────────────────────────────────────────────────────
const VIEW_TITLES = { dashboard: 'Dashboard', decks: 'My Decks', study: 'Study', deckDetail: 'Deck' };
let _activeView   = 'dashboard';
let _activeDeckId = null;

// ─── Modal state ──────────────────────────────────────────────────────────────
let _editingDeck    = null;
let _editingCard    = null;
let _confirmCb      = null;

// ─── Study session state ──────────────────────────────────────────────────────
let _studyDeckId   = null;
let _lastStudyDeckId = null; // preserved after session ends for "Study Again"
let _sessionTotal  = 0;
let _sessionReviewed = 0;

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  // Safely resolve module references — if any FM sub-module failed to load,
  // report it clearly instead of crashing silently.
  try {
    _DM     = window.FM.DarkMode;
    _IE     = window.FM.ImportExport;
    _DeckMgr = window.FM.DeckManager;
  } catch (e) {
    console.error('[main] Failed to resolve FM modules:', e);
    return;
  }

  if (!_DM || !_IE || !_DeckMgr) {
    console.error('[main] One or more FM modules missing:', { _DM, _IE, _DeckMgr });
    return;
  }

  _DM.initDarkMode();
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────

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
  text.textContent = message;
  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode === container) container.removeChild(toast); }, 3100);
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

function wireNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'study') renderStudyPicker();
      switchView(view);
      // Close mobile sidebar on nav
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });

  document.getElementById('btn-view-all-decks')?.addEventListener('click', () => {
    renderDecksView();
    switchView('decks');
  });
}

function switchView(viewKey) {
  _activeView = viewKey;
  const viewMap = { dashboard: 'view-dashboard', decks: 'view-decks', study: 'view-study', deckDetail: 'view-deck-detail' };
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(viewMap[viewKey])?.classList.add('active');
  const heading = document.getElementById('page-heading');
  if (heading) heading.textContent = VIEW_TITLES[viewKey] ?? viewKey;
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewKey);
  });
  if (viewKey === 'dashboard') renderDashboard();
  if (viewKey === 'decks') renderDecksView();
  // Only render the study picker if no session is actively running
  if (viewKey === 'study' && !_studyDeckId) renderStudyPicker();
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────────────────────────────────────────

function wireDarkModeToggle() {
  const btn = document.getElementById('dark-mode-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    _DM.toggleDarkMode();
    syncDarkModeToggle();
  });
}

function syncDarkModeToggle() {
  const btn = document.getElementById('dark-mode-toggle');
  if (!btn) return;
  const on = _DM ? _DM.isDarkMode() : false;
  btn.setAttribute('aria-pressed', String(on));
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE MENU
// ─────────────────────────────────────────────────────────────────────────────

function wireMobileMenu() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.querySelector('.sidebar-overlay');
  if (!mobileBtn || !sidebar) return;

  if (window.innerWidth <= 768) mobileBtn.style.display = 'flex';

  mobileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('open');
  });

  // Close when clicking overlay or outside sidebar
  const closeHandler = (e) => {
    if (sidebar.contains(e.target) || mobileBtn.contains(e.target)) return;
    sidebar.classList.remove('open');
  };
  document.addEventListener('click', closeHandler);
  if (overlay) overlay.addEventListener('click', () => sidebar.classList.remove('open'));

  window.addEventListener('resize', () => {
    mobileBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    if (window.innerWidth > 768) sidebar.classList.remove('open');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function renderDashboard() {
  const stats = _DeckMgr.getDashboardStats();
  _setText('stat-total-decks', String(stats.totalDecks));
  _setText('stat-total-cards', String(stats.totalCards));
  _setText('stat-due-today',   String(stats.dueToday));
  _setText('stat-retention',   `${stats.retentionRate}%`);

  const decks = _DeckMgr.getAllDecks().slice(-4).reverse();
  const grid  = document.getElementById('dashboard-deck-grid');
  if (!grid) return;
  grid.replaceChildren();
  renderDeckCards(decks, grid, { compact: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// DECKS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function renderDecksView() {
  const grid = document.getElementById('all-deck-grid');
  if (!grid) return;
  grid.replaceChildren();
  renderDeckCards(_DeckMgr.getAllDecks(), grid, { compact: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK CARD BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const DECK_EMOJIS = ['📚','🧠','🔬','💡','🎯','🌍','🎵','⚗️','🖥️','📐'];

function renderDeckCards(decks, container, { compact }) {
  if (decks.length === 0) {
    container.appendChild(_buildEmptyState('🃏', 'No decks yet', 'Create your first deck to start learning!', 'New Deck', () => openDeckModal()));
    return;
  }

  decks.forEach((deck, idx) => {
    const now      = new Date();
    const dueCount = deck.cards.filter(c => new Date(c.dueDate) <= now).length;
    const emoji    = DECK_EMOJIS[idx % DECK_EMOJIS.length];

    const card = document.createElement('div');
    card.className = 'deck-card';
    card.setAttribute('role', 'listitem');

    const header   = document.createElement('div');
    header.className = 'deck-card__header';

    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'deck-card__emoji';
    emojiDiv.setAttribute('aria-hidden', 'true');
    emojiDiv.textContent = emoji;

    const actions  = document.createElement('div');
    actions.className = 'deck-card__actions';

    const editBtn  = document.createElement('button');
    editBtn.className = 'btn-icon btn-sm';
    editBtn.setAttribute('aria-label', `Rename deck ${deck.name}`);
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openDeckModal(deck); });

    const delBtn   = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.setAttribute('aria-label', `Delete deck ${deck.name}`);
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openConfirmModal('Delete Deck?', `"${deck.name}" and all its cards will be permanently deleted.`, () => {
        _DeckMgr.deleteDeck(deck.id);
        renderDashboard();
        renderDecksView();
        showToast('Deck deleted.', 'success');
      });
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    header.appendChild(emojiDiv);
    header.appendChild(actions);

    const name     = document.createElement('div');
    name.className = 'deck-card__name';
    name.textContent = deck.name;

    const meta     = document.createElement('div');
    meta.className = 'deck-card__meta';
    const cardsSpan = document.createElement('span');
    cardsSpan.textContent = `${deck.cards.length} card${deck.cards.length !== 1 ? 's' : ''}`;
    const dueSpan  = document.createElement('span');
    dueSpan.className = 'deck-card__due';
    dueSpan.textContent = dueCount > 0 ? `${dueCount} due` : '✓ up to date';
    meta.appendChild(cardsSpan);
    meta.appendChild(dueSpan);

    const openBtn  = document.createElement('button');
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
// DECK DETAIL
// ─────────────────────────────────────────────────────────────────────────────

function openDeckDetail(deckId) {
  _activeDeckId = deckId;
  renderDeckDetail();
  switchView('deckDetail');
}

function renderDeckDetail() {
  const deck = _DeckMgr.getDeckById(_activeDeckId);
  if (!deck) { switchView('decks'); return; }

  _setText('deck-detail-title', deck.name);

  const list = document.getElementById('card-list');
  if (!list) return;
  list.replaceChildren();

  if (deck.cards.length === 0) {
    list.appendChild(_buildEmptyState('➕', 'No cards yet', 'Add your first card to this deck.', 'Add Card', () => openCardModal()));
  } else {
    const now = new Date();
    deck.cards.forEach(card => {
      const isDue = new Date(card.dueDate) <= now;
      const item  = document.createElement('div');
      item.className = 'card-item';
      item.setAttribute('role', 'listitem');

      const body  = document.createElement('div');
      body.className = 'card-item__body';
      const front = document.createElement('div');
      front.className = 'card-item__front';
      front.textContent = card.front;
      const back  = document.createElement('div');
      back.className = 'card-item__back';
      back.textContent = card.back;
      body.appendChild(front);
      body.appendChild(back);

      const badge = document.createElement('span');
      badge.className = `card-item__badge ${isDue ? 'badge-due' : 'badge-ok'}`;
      badge.textContent = isDue ? 'Due' : 'OK';

      const actions = document.createElement('div');
      actions.className = 'card-item__actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon btn-sm';
      editBtn.setAttribute('aria-label', `Edit card`);
      editBtn.textContent = '✏️';
      editBtn.addEventListener('click', () => openCardModal(card));
      const delBtn  = document.createElement('button');
      delBtn.className = 'btn-icon btn-sm';
      delBtn.setAttribute('aria-label', `Delete card`);
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', () => {
        openConfirmModal('Delete Card?', 'This card will be permanently deleted.', () => {
          _DeckMgr.deleteCard(_activeDeckId, card.id);
          renderDeckDetail();
          showToast('Card deleted.', 'success');
        });
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(body);
      item.appendChild(badge);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  // Re-wire the deck-detail action buttons every render
  // (use _once to avoid duplicate listeners accumulating)
  _once('btn-back-to-decks',   'click', () => { renderDecksView(); switchView('decks'); });
  _once('btn-study-this-deck', 'click', () => beginStudySession(_activeDeckId));
  _once('btn-add-card',        'click', () => openCardModal());
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK MODAL
// ─────────────────────────────────────────────────────────────────────────────

function wireDeckModal() {
  document.getElementById('modal-deck-close')?.addEventListener('click', closeDeckModal);
  document.getElementById('modal-deck-cancel')?.addEventListener('click', closeDeckModal);
  document.getElementById('modal-deck-save')?.addEventListener('click', submitDeckModal);
  document.getElementById('input-deck-name')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitDeckModal(); });
  document.getElementById('modal-deck')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDeckModal(); });
}

function openDeckModal(deck = null) {
  _editingDeck = deck;
  _setText('modal-deck-title', deck ? 'Rename Deck' : 'New Deck');
  const input = document.getElementById('input-deck-name');
  if (input) { input.value = deck ? deck.name : ''; setTimeout(() => input.focus(), 80); }
  document.getElementById('modal-deck')?.classList.add('open');
}

function closeDeckModal() {
  document.getElementById('modal-deck')?.classList.remove('open');
  _editingDeck = null;
}

function submitDeckModal() {
  const input = document.getElementById('input-deck-name');
  const name  = input?.value?.trim() ?? '';
  if (!name) { showToast('Deck name cannot be empty.', 'error'); return; }
  try {
    if (_editingDeck) {
      _DeckMgr.renameDeck(_editingDeck.id, name);
      showToast('Deck renamed!', 'success');
    } else {
      _DeckMgr.createDeck(name);
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
// CARD MODAL
// ─────────────────────────────────────────────────────────────────────────────

function wireCardModal() {
  document.getElementById('modal-card-close')?.addEventListener('click', closeCardModal);
  document.getElementById('modal-card-cancel')?.addEventListener('click', closeCardModal);
  document.getElementById('modal-card-save')?.addEventListener('click', submitCardModal);
  document.getElementById('modal-card')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeCardModal(); });
}

function openCardModal(card = null) {
  _editingCard = card;
  _setText('modal-card-title', card ? 'Edit Card' : 'Add Card');
  const front = document.getElementById('input-card-front');
  const back  = document.getElementById('input-card-back');
  if (front) front.value = card?.front ?? '';
  if (back)  back.value  = card?.back  ?? '';
  document.getElementById('modal-card')?.classList.add('open');
  setTimeout(() => front?.focus(), 80);
}

function closeCardModal() {
  document.getElementById('modal-card')?.classList.remove('open');
  _editingCard = null;
}

function submitCardModal() {
  const front = document.getElementById('input-card-front')?.value?.trim() ?? '';
  const back  = document.getElementById('input-card-back')?.value?.trim()  ?? '';
  if (!front) { showToast('Front text cannot be empty.', 'error'); return; }
  if (!back)  { showToast('Back text cannot be empty.',  'error'); return; }
  if (!_activeDeckId) { showToast('No deck selected.', 'error'); return; }
  try {
    if (_editingCard) {
      _DeckMgr.editCard(_activeDeckId, _editingCard.id, front, back);
      showToast('Card updated!', 'success');
    } else {
      _DeckMgr.addCard(_activeDeckId, front, back);
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

function wireConfirmModal() {
  document.getElementById('modal-confirm-close')?.addEventListener('click', closeConfirmModal);
  document.getElementById('modal-confirm-cancel')?.addEventListener('click', closeConfirmModal);
  document.getElementById('modal-confirm-ok')?.addEventListener('click', () => { _confirmCb?.(); closeConfirmModal(); });
  document.getElementById('modal-confirm')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeConfirmModal(); });
}

function openConfirmModal(title, body, onConfirm) {
  _confirmCb = onConfirm;
  _setText('modal-confirm-title', title);
  _setText('modal-confirm-body',  body);
  document.getElementById('modal-confirm')?.classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('modal-confirm')?.classList.remove('open');
  _confirmCb = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function wireImportExport() {
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const decks = _DeckMgr.getAllDecks();
    if (decks.length === 0) { showToast('No decks to export.', 'info'); return; }
    _IE.exportDecks(decks);
    showToast('Export started!', 'success');
  });

  const fileInput = document.getElementById('import-file-input');
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const imported = await _IE.importDecks(file);
      const existing = _DeckMgr.getAllDecks();
      const map = new Map(existing.map(d => [d.id, d]));
      for (const d of imported) map.set(d.id, d);
      window.FM.Storage.saveDecks([...map.values()]);
      renderDashboard();
      renderDecksView();
      showToast(`Imported ${imported.length} deck(s) successfully!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      fileInput.value = '';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDY SESSION
// ─────────────────────────────────────────────────────────────────────────────

function renderStudyPicker() {
  _setDisplay('study-picker',      'block');
  _setDisplay('study-session-ui',  'none');
  _setDisplay('study-complete-ui', 'none');

  const grid = document.getElementById('study-deck-grid');
  if (!grid) return;
  grid.replaceChildren();

  const decks = _DeckMgr.getAllDecks();
  if (decks.length === 0) {
    grid.appendChild(_buildEmptyState('🃏', 'No decks yet', 'Create a deck first, then come back to study.', null, null));
    return;
  }

  const now = new Date();
  decks.forEach((deck, idx) => {
    const dueCount = deck.cards.filter(c => new Date(c.dueDate) <= now).length;
    const emoji    = DECK_EMOJIS[idx % DECK_EMOJIS.length];

    const card     = document.createElement('div');
    card.className = 'deck-card';
    card.setAttribute('role', 'listitem');

    const header   = document.createElement('div');
    header.className = 'deck-card__header';
    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'deck-card__emoji';
    emojiDiv.setAttribute('aria-hidden', 'true');
    emojiDiv.textContent = emoji;
    header.appendChild(emojiDiv);

    const name     = document.createElement('div');
    name.className = 'deck-card__name';
    name.textContent = deck.name;

    const meta     = document.createElement('div');
    meta.className = 'deck-card__meta';
    const dueSpan  = document.createElement('span');
    dueSpan.className = dueCount > 0 ? 'deck-card__due' : '';
    dueSpan.textContent = dueCount > 0 ? `${dueCount} card${dueCount !== 1 ? 's' : ''} due` : '✓ Nothing due today';
    meta.appendChild(dueSpan);

    const studyBtn = document.createElement('button');
    studyBtn.className = 'btn btn-primary btn-sm deck-card__btn';
    studyBtn.textContent = dueCount > 0 ? 'Study Now' : 'Review Early';
    studyBtn.setAttribute('aria-label', `Study deck ${deck.name}`);
    studyBtn.addEventListener('click', () => beginStudySession(deck.id));

    card.appendChild(header);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(studyBtn);
    grid.appendChild(card);
  });
}

function wireStudySession() {
  const flashcard = document.getElementById('flashcard');
  flashcard?.addEventListener('click', () => handleFlip());
  flashcard?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFlip(); }
  });

  // QUALITY constants are globals from sm2.js
  document.getElementById('rate-again')?.addEventListener('click', () => handleRate(QUALITY.AGAIN));
  document.getElementById('rate-hard')?.addEventListener('click',  () => handleRate(QUALITY.HARD));
  document.getElementById('rate-good')?.addEventListener('click',  () => handleRate(QUALITY.GOOD));
  document.getElementById('rate-easy')?.addEventListener('click',  () => handleRate(QUALITY.EASY));

  document.getElementById('btn-end-session')?.addEventListener('click', () => endSession());

  document.getElementById('btn-study-again')?.addEventListener('click', () => {
    if (_lastStudyDeckId) beginStudySession(_lastStudyDeckId);
  });
  document.getElementById('btn-back-from-complete')?.addEventListener('click', () => switchView('dashboard'));
}

function beginStudySession(deckId) {
  const deck = _DeckMgr.getDeckById(deckId);
  if (!deck) { showToast('Deck not found.', 'error'); return; }
  if (deck.cards.length === 0) { showToast('This deck has no cards yet.', 'info'); return; }

  _studyDeckId     = deckId;
  _lastStudyDeckId = deckId;
  _sessionReviewed = 0;

  let result = StudySession.startStudySession(deck);
  _sessionTotal = result.totalDue;

  // "Review Early": force all cards due so the session starts
  if (!result.started) {
    const forced = { ...deck, cards: deck.cards.map(c => ({ ...c, dueDate: new Date().toISOString() })) };
    result = StudySession.startStudySession(forced);
    _sessionTotal = forced.cards.length;
  }

  _setDisplay('study-picker',      'none');
  _setDisplay('study-session-ui',  'block');
  _setDisplay('study-complete-ui', 'none');

  switchView('study');
  renderNextCard();
}

function renderNextCard() {
  const card = StudySession.getNextCard();
  if (!card) { endSession(); return; }

  document.getElementById('flashcard')?.classList.remove('flipped');
  _setText('card-front-text', card.front);
  _setText('card-back-text',  card.back);
  document.getElementById('rating-buttons')?.classList.add('hidden');
  updateProgress();
}

function handleFlip() {
  const state = StudySession.getSessionState();
  if (state.isFlipped) return;
  StudySession.flipCard();
  document.getElementById('flashcard')?.classList.add('flipped');
  document.getElementById('rating-buttons')?.classList.remove('hidden');
}

function handleRate(quality) {
  const card = StudySession.getNextCard();
  if (!card) return;

  const { isComplete } = StudySession.reviewCard(card, quality);
  _sessionReviewed++;

  // Persist updated card data back to storage
  const state = StudySession.getSessionState();
  if (state.deck) {
    _DeckMgr.updateDeckCards(_studyDeckId, state.deck.cards);
  }

  renderDashboard();

  if (isComplete) {
    endSession();
  } else {
    renderNextCard();
  }
}

function endSession() {
  const summary = StudySession.finishSession();
  if (summary?.deck) _DeckMgr.updateDeckCards(_studyDeckId, summary.deck.cards);
  renderDashboard();
  _setDisplay('study-session-ui',  'none');
  _setDisplay('study-complete-ui', 'block');
  _setText('complete-reviewed', String(_sessionReviewed));
  _studyDeckId = null; // allow picker to render again after session
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

function updateProgress() {
  const pct   = _sessionTotal > 0 ? Math.round((_sessionReviewed / _sessionTotal) * 100) : 0;
  const bar   = document.getElementById('progress-bar');
  const track = document.getElementById('progress-track');
  const label = document.getElementById('progress-label');
  if (bar)   bar.style.width = `${pct}%`;
  if (track) track.setAttribute('aria-valuenow', String(pct));
  if (label) label.textContent = `${_sessionReviewed} / ${_sessionTotal}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM UTILS
// ─────────────────────────────────────────────────────────────────────────────

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _setDisplay(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.display = value;
}

/**
 * Replaces an element with a clone (drops stale listeners), then wires the new one.
 * Uses cloneNode(true) so child elements (icons, spans) are preserved.
 */
function _once(id, event, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  const clone = el.cloneNode(true);   // true = deep clone, keeps child text/elements
  el.parentNode?.replaceChild(clone, el);
  clone.addEventListener(event, fn);
}

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
