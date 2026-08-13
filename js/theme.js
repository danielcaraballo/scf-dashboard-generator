window.FleetTheme = (function () {
  const STORAGE_KEY = 'scf-theme';
  const themeBtn = document.getElementById('themeBtn');

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function get() {
    return isDark() ? 'dark' : 'light';
  }

  function syncButton() {
    if (!themeBtn) return;
    const dark = isDark();
    const sun = themeBtn.querySelector('[data-icon="sun"]');
    const moon = themeBtn.querySelector('[data-icon="moon"]');
    if (sun) sun.classList.toggle('hidden', dark);
    if (moon) moon.classList.toggle('hidden', !dark);
    themeBtn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    themeBtn.title = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  }

  function set(dark) {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch (err) {
    }
    syncButton();
  }

  function toggle() {
    set(!isDark());
  }

  function refreshUI() {
    if (window.FleetUI && window.FleetUI.refresh) {
      window.FleetUI.refresh();
    }
  }

  function init() {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
    }
    const dark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
    syncButton();
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      toggle();
      refreshUI();
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      document.documentElement.classList.toggle('dark', e.newValue === 'dark');
      syncButton();
      refreshUI();
    }
  });

  init();

  return { get, set, toggle, isDark, init };
})();