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

  const DEFAULT_DECKS = () => [
    {
      id: "seeded-deck-js",
      name: "🚀 JavaScript Masterclass",
      createdAt: new Date().toISOString(),
      cards: [
        {
          id: "seeded-card-closure",
          front: "What is a Closure in JavaScript?",
          back: "A closure is the combination of a function bundled together (enclosed) with references to its surrounding state (the lexical environment). In other words, a closure gives an inner function access to the outer function's scope even after the outer function has returned.",
          repetitions: 0,
          interval: 1,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
          createdAt: new Date().toISOString()
        },
        {
          id: "seeded-card-variables",
          front: "What is the difference between let, const, and var?",
          back: "• var is function-scoped, hoisted, and permits re-declaration.\n• let is block-scoped, not initialized (Temporal Dead Zone) until defined, and prevents re-declaration.\n• const behaves like let, but forbids re-assignment of the variable identifier (though objects/arrays are still mutable).",
          repetitions: 0,
          interval: 1,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      ]
    },
    {
      id: "seeded-deck-ui",
      name: "🎨 Web Design & UI Aesthetics",
      createdAt: new Date().toISOString(),
      cards: [
        {
          id: "seeded-card-glassmorphism",
          front: "What is Glassmorphism and how is it styled in CSS?",
          back: "Glassmorphism is a popular modern design style characterized by translucent frosted-glass-like elements. It is achieved in CSS using:\n\n1. background: rgba(255, 255, 255, 0.05);\n2. backdrop-filter: blur(12px) -webkit-backdrop-filter: blur(12px);\n3. border: 1px solid rgba(255, 255, 255, 0.08) to create a subtle glow boundary.",
          repetitions: 0,
          interval: 1,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
          createdAt: new Date().toISOString()
        },
        {
          id: "seeded-card-hsl",
          front: "Why is the HSL color model preferred for UI systems?",
          back: "HSL (Hue, Saturation, Lightness) is highly intuitive because it reflects human perception. \n• Hue (0-360) lets you dial the base color wheel.\n• Saturation (0-100%) controls intensity.\n• Lightness (0-100%) adjusts brightness.\n\nThis makes generating complementary systems or UI color levels (hover states, dark modes) programmatically trivial by just scaling Lightness up/down.",
          repetitions: 0,
          interval: 1,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      ]
    }
  ];
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
