export const PRIORITY_LEVELS = new Set(['Urgent', 'Action', 'FYI', 'Low']);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getThreadRows() {
  return Array.from(document.querySelectorAll('tr.zA'));
}

export function extractMeta(row) {
  const subject = row.querySelector('.bog')?.innerText?.trim()
    || row.querySelector('[role="link"]')?.innerText?.trim()
    || '';
  const snippet = row.querySelector('.y2')?.innerText?.replace(/^ - /, '')?.trim() || '';
  const sender = row.querySelector('.yX.xY .yW span, .yX .yW span')?.getAttribute('email')
    || row.querySelector('.yX.xY .yW span, .yX .yW span')?.innerText?.trim()
    || '';
  const threadId = row.getAttribute('data-legacy-thread-id')
    || row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id')
    || '';
  return { subject, snippet, sender, threadId };
}

export function buildCacheKey(meta) {
  if (meta.threadId) return meta.threadId;
  return `${meta.subject}::${meta.snippet.slice(0, 60)}::${meta.sender}`;
}

export function normalizeLevel(rawLevel) {
  if (PRIORITY_LEVELS.has(rawLevel)) return rawLevel;
  const cleaned = String(rawLevel || '').trim().toLowerCase();
  switch (cleaned) {
    case 'critical':
    case 'high':
    case 'urgent':
      return 'Urgent';
    case 'medium':
    case 'action':
      return 'Action';
    case 'low':
    case 'later':
      return 'Low';
    case 'fyi':
    default:
      return 'FYI';
  }
}

export function injectBadge(row, level, reason = '') {
  const anchor = row.querySelector('.bog') || row.querySelector('[role="link"]');
  if (!anchor) return;

  const existing = row.querySelector('.gpa-badge');
  if (existing) {
    if (existing.textContent === level) {
      existing.title = reason || '';
      return;
    }
    existing.remove();
  }

  const badge = document.createElement('span');
  badge.className = `gpa-badge gpa-${level}`;
  badge.textContent = level;
  if (reason) badge.title = reason;
  anchor.insertAdjacentElement('afterend', badge);
}

export function pageSignature(rows) {
  if (!rows.length) return '';
  const first = rows[0].getAttribute('data-legacy-thread-id')
    || rows[0].querySelector('[data-thread-id]')?.getAttribute('data-thread-id')
    || rows[0].innerText.slice(0, 64);
  const lastElem = rows[rows.length - 1];
  const last = lastElem?.getAttribute('data-legacy-thread-id')
    || lastElem?.querySelector('[data-thread-id]')?.getAttribute('data-thread-id')
    || lastElem?.innerText.slice(0, 64);
  return `${first}::${last}::${rows.length}`;
}

export function isBadgeOnlyMutation(mutation) {
  if (mutation.removedNodes?.length) return false;
  if (!mutation.addedNodes?.length) return false;
  return Array.from(mutation.addedNodes).every(
    (node) => node.nodeType === 1 && node.classList?.contains('gpa-badge'),
  );
}

export function getScrollableContainer() {
  const containers = document.querySelectorAll('div[role="main"] .aeF, div[role="main"] .a3s');
  for (const el of containers) {
    if (el.scrollHeight > el.clientHeight + 20) return el;
  }
  return document.scrollingElement || document.body;
}

export async function autoScrollToLoad({ targetCount = 100, step = 600, delay = 150 } = {}) {
  const container = getScrollableContainer();
  let lastCount = getThreadRows().length;
  let attempts = 0;

  while (getThreadRows().length < targetCount && attempts < 12) {
    const before = getThreadRows().length;
    container.scrollBy({ top: step, left: 0, behavior: 'smooth' });
    await sleep(delay);
    const after = getThreadRows().length;
    if (after <= before) {
      attempts += 1;
    } else {
      attempts = 0;
    }
    lastCount = after;
  }
}
