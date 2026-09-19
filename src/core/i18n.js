(function init(root) {
  'use strict';

  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;

  function valuesOf(substitutions) {
    if (Array.isArray(substitutions)) return substitutions.map(value => String(value));
    if (substitutions && typeof substitutions === 'object') return Object.values(substitutions).map(value => String(value));
    if (substitutions == null) return [];
    return [String(substitutions)];
  }

  function getUILanguage() {
    try {
      return String(chromeApi && chromeApi.i18n && chromeApi.i18n.getUILanguage() || 'zh-CN');
    } catch {
      return 'zh-CN';
    }
  }

  function t(key, fallback = '', substitutions) {
    try {
      const getMessage = chromeApi && chromeApi.i18n && chromeApi.i18n.getMessage;
      if (typeof getMessage === 'function') {
        const message = getMessage.call(chromeApi.i18n, String(key), valuesOf(substitutions));
        if (message) return message;
      }
    } catch {}
    return typeof fallback === 'function' ? fallback(substitutions) : String(fallback == null ? '' : fallback);
  }

  function apply(scope = typeof document !== 'undefined' ? document : null) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    for (const node of scope.querySelectorAll('[data-i18n]')) {
      const key = node.getAttribute('data-i18n');
      if (key) node.textContent = t(key, node.textContent || '');
    }
    for (const node of scope.querySelectorAll('[data-i18n-attr]')) {
      const definitions = String(node.getAttribute('data-i18n-attr') || '').split(';');
      for (const definition of definitions) {
        const separator = definition.indexOf(':');
        if (separator < 1) continue;
        const attribute = definition.slice(0, separator).trim();
        const key = definition.slice(separator + 1).trim();
        if (attribute && key) node.setAttribute(attribute, t(key, node.getAttribute(attribute) || ''));
      }
    }
    if (scope.documentElement) scope.documentElement.lang = getUILanguage().replace('_', '-');
  }

  const api = { t, apply, getUILanguage };
  if (root) root.BiliTubeI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
