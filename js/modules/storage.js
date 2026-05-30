/**
 * @file storage.js
 * @description Storage layer — exposed as window.FM.Storage (no ES modules,
 *              works on file:// protocol without a dev server).
 */

window.FM = window.FM || {};

(function () {

  const STORAGE_KEYS = Object.freeze({
    DECKS: 'flashcard_decks',
    SETTINGS: 'flashcard_settings',
  });

  const DEFAULT_DECKS = () => [];
  const DEFAULT_SETTINGS = () => ({ darkMode: false });

  function _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function _read(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  }

  function saveDecks(decks) {
    try { _write(STORAGE_KEYS.DECKS, decks); }
    catch (err) { console.error('[storage] Failed to save decks:', err.message); }
  }

  function loadDecks() {
    try {
      const data = _read(STORAGE_KEYS.DECKS);
      return Array.isArray(data) ? data : DEFAULT_DECKS();
    } catch (err) {
      console.error('[storage] Failed to load decks:', err.message);
      return DEFAULT_DECKS();
    }
  }

  function saveSettings(settings) {
    try { _write(STORAGE_KEYS.SETTINGS, settings); }
    catch (err) { console.error('[storage] Failed to save settings:', err.message); }
  }

  function loadSettings() {
    try {
      const data = _read(STORAGE_KEYS.SETTINGS);
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return DEFAULT_SETTINGS();
      }
      return data;
    } catch (err) {
      console.error('[storage] Failed to load settings:', err.message);
      return DEFAULT_SETTINGS();
    }
  }

  function clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.DECKS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    } catch (err) {
      console.error('[storage] Failed to clear storage:', err.message);
    }
  }

  // Expose on global namespace
  window.FM.Storage = { saveDecks, loadDecks, saveSettings, loadSettings, clearAll };

})();
