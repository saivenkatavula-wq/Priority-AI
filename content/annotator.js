import { classifyWithAI, requestEnableAI } from './ai-bridge.js';
import {
  buildCacheKey,
  extractMeta,
  getThreadRows,
  injectBadge,
  isBadgeOnlyMutation,
  normalizeLevel,
  pageSignature,
  sleep,
  autoScrollToLoad,
} from './dom.js';

const classificationCache = new Map();
const cacheOrder = [];
const MAX_CACHE_ENTRIES = 400;
const MAX_CONCURRENT_REQUESTS = 1;
const REQUEST_DELAY = 80;
const MAX_RETRIES = 5;
const START_DELAY_BASE = 60;

let lastPageSignature = '';
let annotating = false;
let annotateQueued = false;
let activeRequests = 0;

function touchCacheKey(cacheKey) {
  const index = cacheOrder.indexOf(cacheKey);
  if (index !== -1) cacheOrder.splice(index, 1);
  cacheOrder.push(cacheKey);
  while (cacheOrder.length > MAX_CACHE_ENTRIES) {
    const oldest = cacheOrder.shift();
    classificationCache.delete(oldest);
  }
}

export function handleMutations(mutations) {
  if (mutations.every(isBadgeOnlyMutation)) return;
  
  // Debounce rapid mutations
  clearTimeout(window._gpaAnnotationDebounce);
  window._gpaAnnotationDebounce = setTimeout(() => {
    annotatePage();
  }, 300);
}

export async function annotatePage() {
  if (annotating) {
    annotateQueued = true;
    return;
  }
  
  annotating = true;
  try {
    await autoScrollToLoad({ targetCount: 120 });
    const rows = getThreadRows();
    const signature = pageSignature(rows);

    const queue = [];
    for (const row of rows) {
      const meta = extractMeta(row);
      if (!meta.subject && !meta.snippet) continue;

      const cacheKey = buildCacheKey(meta);
      if (classificationCache.has(cacheKey)) {
        const cached = classificationCache.get(cacheKey);
        injectBadge(row, cached.level, cached.reason);
        touchCacheKey(cacheKey);
        continue;
      }

      queue.push({ row, meta, cacheKey });
    }

    if (signature && signature === lastPageSignature && queue.length === 0) {
      // Nothing new to classify
      return;
    }
    lastPageSignature = signature;

    await processQueue(queue);
  } finally {
    annotating = false;
    if (annotateQueued) {
      annotateQueued = false;
      setTimeout(annotatePage, 100);
    }
  }
}

async function processQueue(queue) {
  const pending = queue.map((item) => ({ ...item, attempt: item.attempt || 0 }));
  const retryLater = [];
  const promises = [];

  while (pending.length) {
    const item = pending.shift();

    while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      await sleep(REQUEST_DELAY);
    }

    if (!item.row.isConnected) continue;

    const promise = processQueueItem(item).then((status) => {
      if (status === 'retry' && item.attempt + 1 <= MAX_RETRIES) {
        retryLater.push({ ...item, attempt: item.attempt + 1 });
      }
    }).finally(() => {
      activeRequests--;
    });

    activeRequests++;
    promises.push(promise);
    const staggerDelay = START_DELAY_BASE + item.attempt * 40;
    await sleep(staggerDelay);
  }

  await Promise.allSettled(promises);

  if (retryLater.length) {
    await processQueue(retryLater);
  }
}

async function processQueueItem(item) {
  const { row, meta, cacheKey } = item;
  
  try {
    const outcome = await classifyWithAI(meta);
    if (!outcome?.success) {
      if (outcome?.reason === 'after-download' || outcome?.reason === 'needs-gesture') {
        requestEnableAI('auto-check');
      }
      return outcome?.retry ? 'retry' : 'skip';
    }
    
    const level = normalizeLevel(outcome.level);
    const reason = outcome.reason || '';
    
    classificationCache.set(cacheKey, { level, reason });
    touchCacheKey(cacheKey);
    
    // Only inject if row is still connected
    if (row.isConnected) {
      injectBadge(row, level, reason);
    }
    return 'ok';
  } catch (err) {
    console.warn('[GPA] Classification failed for:', meta.subject, err);
    return 'retry';
  }
}

export function clearCache() {
  classificationCache.clear();
  cacheOrder.length = 0;
}

export function getCacheStats() {
  return {
    size: classificationCache.size,
    hits: cacheOrder.length
  };
}
