(() => {
  const THEME_KEY = 'dumpspace-theme';
  const THEME_COLORS = { dark: '#0b0b0c', light: '#ffffff' };

  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  };

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = THEME_COLORS[theme];

    for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
      const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
  };

  applyTheme(readTheme());

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(readTheme());

    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-theme-toggle]')) return;

      const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';

      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {}

      applyTheme(theme);
    });
  });

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY) applyTheme(readTheme());
  });
})();
