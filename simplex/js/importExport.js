/**
 * @file importExport.js
 * @description Import/Export utilities — exposed as window.FM.ImportExport.
 *
 * Security notes:
 * - Imported JSON is validated (must be an array) before being returned.
 * - Object URL is revoked immediately after download click.
 * - TODO(security): If card content can come from untrusted sources,
 *   run through DOMPurify before rendering.
 */

window.FM = window.FM || {};

(function () {

  /**
   * Serialises decks to a JSON file and triggers a browser download.
   * @param {Array} decks
   */
  function exportDecks(decks) {
    try {
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const filename = `flashcards-export-${dateSuffix}.json`;
      const jsonString = JSON.stringify(decks, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();

      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('[importExport] Failed to export decks:', err.message);
    }
  }

  /**
   * Reads a JSON File and resolves with the parsed decks array.
   * @param {File} file
   * @returns {Promise<Array>}
   */
  function importDecks(file) {
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        reject(new Error('No file provided. Please select a JSON export file.'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!Array.isArray(parsed)) {
            reject(new Error(
              'Invalid file format: the JSON must contain an array of decks at the top level.'
            ));
            return;
          }
          resolve(parsed);
        } catch (_parseErr) {
          console.error('[importExport] JSON parse error:', _parseErr.message);
          reject(new Error(
            'Could not read the file. Make sure it is a valid flashcard export (.json).'
          ));
        }
      };

      reader.onerror = () => {
        console.error('[importExport] FileReader error during import.');
        reject(new Error('An error occurred while reading the file. Please try again.'));
      };

      reader.readAsText(file, 'UTF-8');
    });
  }

  window.FM.ImportExport = { exportDecks, importDecks };

})();
