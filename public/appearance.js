(() => {
  'use strict';

  const key = 'lifesolver-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let preference;
  try { preference = localStorage.getItem(key); } catch { /* Use the device setting. */ }

  function apply() {
    const theme = ['light', 'dark'].includes(preference) ? preference : system.matches ? 'dark' : 'light';
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#2d2d2d' : '#e9e9e9');
    document.querySelector('[data-action="toggle-theme"]')?.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  window.LifesolverAppearance = {
    toggle() {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch { /* Keep the choice for this session. */ }
      apply();
    }
  };
  apply();
  system.addEventListener('change', apply);
})();
