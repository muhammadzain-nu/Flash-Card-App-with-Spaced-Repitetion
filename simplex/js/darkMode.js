/**
 * @file darkMode.js
 * @description Dark-mode manager — exposed as window.FM.DarkMode.
 *
 * Manages the `data-theme="dark"` attribute on document.documentElement
 * and persists the preference via FM.Storage.
 * CSS applies dark styles using: :root[data-theme="dark"] { ... }
 *
 * Security note: theme preference is a non-sensitive boolean — no credentials
 * or PII are handled here.
 *
 * Depends on: js/modules/storage.js (window.FM.Storage)
 */

window.FM = window.FM || {};

(function () {

  let _darkModeEnabled = false;

  function _applyTheme(enable) {
    if (enable) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /**
   * Reads the saved preference and applies it to the DOM.
   * Call once at app start.
   */
  function initDarkMode() {
    try {
      const settings = window.FM.Storage.loadSettings();
      _darkModeEnabled = Boolean(settings.darkMode);
      _applyTheme(_darkModeEnabled);
    } catch (err) {
      console.error('[darkMode] Failed to initialise:', err.message);
      _darkModeEnabled = false;
    }
  }

  /**
   * Flips the theme, updates the DOM attribute, and saves the new preference.
   */
  function toggleDarkMode() {
    try {
      _darkModeEnabled = !_darkModeEnabled;
      _applyTheme(_darkModeEnabled);
      const current = window.FM.Storage.loadSettings();
      window.FM.Storage.saveSettings({ ...current, darkMode: _darkModeEnabled });
    } catch (err) {
      console.error('[darkMode] Failed to toggle:', err.message);
    }
  }

  /**
   * Returns current dark-mode state.
   * @returns {boolean}
   */
  function isDarkMode() {
    return _darkModeEnabled;
  }

  window.FM.DarkMode = { initDarkMode, toggleDarkMode, isDarkMode };

})();
