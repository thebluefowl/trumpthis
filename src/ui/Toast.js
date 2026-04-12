let statusEl = null;
let clearTimer = null;

export function showToast(message, type = 'info', duration = 3000) {
  if (!statusEl) statusEl = document.getElementById('status-msg');
  if (!statusEl) return;

  statusEl.textContent = `> ${message}`;
  statusEl.className = `status-msg ${type}`;

  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status-msg';
  }, duration);
}
