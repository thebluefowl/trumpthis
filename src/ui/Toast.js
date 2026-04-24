let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

export function showToast(message, type = 'info', duration = 3000) {
  const host = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  // Force reflow so the enter transition fires
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback in case transitionend doesn't fire
    setTimeout(() => toast.remove(), 500);
  }, duration);
}
