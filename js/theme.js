/* Theme toggle — dark/light mode with localStorage persistence */

export function init() {
  const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', savedTheme);

  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }
}
