const statusListeners = new Set();
const pending = new Map();

let bridgeInitialized = false;
let pageInjected = false;
let reqId = 0;
let aiReady = false;
let aiWhy = 'init';
let aiModel = null;

function injectPageScript() {
  if (pageInjected) return;
  
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('page.js');
    script.onload = () => {
      console.log('[GPA] Page script injected successfully');
      // Auto-probe AI availability on script load
      setTimeout(probeAIAvailability, 1000);
    };
    script.onerror = () => {
      console.error('[GPA] Failed to inject page script');
      setStatus(false, 'script-injection-failed');
    };
    
    (document.head || document.documentElement).appendChild(script);
    pageInjected = true;
  } catch (err) {
    console.error('[GPA] Script injection error:', err);
    setStatus(false, 'injection-error');
  }
}

function handleWindowMessage(ev) {
  // Only accept messages from our own page script
  if (ev.source !== window) return;
  
  const msg = ev.data;
  if (!msg || msg.source !== 'GPA_PAGE') return;

  if (msg.type === 'CLASSIFY_RESULT' && pending.has(msg.id)) {
    const { resolve, reject, timeout } = pending.get(msg.id);
    clearTimeout(timeout);
    pending.delete(msg.id);
    
    if (msg.error) {
      reject(new Error(msg.error));
    } else {
      resolve(msg);
    }
    return;
  }

  if (msg.type === 'ENABLE_RESULT') {
    const success = !!msg.ok;
    const why = msg.why || (success ? 'ready' : 'unavailable');
    setStatus(success, why);
    
    // Notify all pending requests about status change
    if (!success && pending.size > 0) {
      for (const [id, { reject }] of pending) {
        reject(new Error(`AI not available: ${why}`));
        pending.delete(id);
      }
    }
  }

  if (msg.type === 'AI_STATUS_UPDATE') {
    setStatus(msg.ready, msg.why);
  }
}

function setStatus(nextReady, nextWhy) {
  if (aiReady === nextReady && aiWhy === nextWhy) return;
  
  console.log(`[GPA] AI status changed: ${aiReady}->${nextReady}, ${aiWhy}->${nextWhy}`);
  aiReady = nextReady;
  aiWhy = nextWhy;
  notifyStatusListeners();
}

function notifyStatusListeners() {
  const snapshot = getAIStatus();
  statusListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('[GPA] Status listener error', err);
    }
  });
}

function askAI(meta) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    
    const timeoutDuration = aiReady ? 20000 : 30000;
    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('Classification timeout'));
      }
    }, timeoutDuration); // Allow longer for first-time model warmup
    
    pending.set(id, { resolve, reject, timeout });
    
    window.postMessage({ 
      source: 'GPA_CONTENT', 
      type: 'CLASSIFY', 
      id, 
      meta 
    }, '*');
  });
}

export function initAIBridge({ onStatusChange } = {}) {
  if (!bridgeInitialized) {
    window.addEventListener('message', handleWindowMessage);
    bridgeInitialized = true;
    console.log('[GPA] AI bridge initialized');
  }
  
  injectPageScript();
  
  if (typeof onStatusChange === 'function') {
    statusListeners.add(onStatusChange);
    // Immediately call with current status
    onStatusChange(getAIStatus());
  }
}

export function teardownStatusListener(listener) {
  statusListeners.delete(listener);
}

export async function classifyWithAI(meta) {
  // Check AI status before attempting classification
  const status = getAIStatus();
  if (!status.aiReady) {
    console.log('[GPA] AI not ready, skipping classification:', status.aiWhy);
    return { success: false, reason: status.aiWhy || 'not-ready', retry: true };
  }

  try {
    const result = await askAI(meta);
    
    if (result.fallback || !result.out?.level) {
      console.log('[GPA] Classification failed or fell back:', result.why);
      return { success: false, reason: result.why || 'fallback', retry: true };
    }
    
    return {
      success: true,
      level: result.out.level,
      reason: typeof result.out.reason === 'string' ? result.out.reason : '',
    };
  } catch (err) {
    const message = err?.message || 'error';
    console.warn('[GPA] Classification error:', message);
    const lower = message.toLowerCase();
    const shouldRetry = lower.includes('timeout') || lower.includes('network') || lower.includes('busy');
    return { success: false, reason: message, retry: shouldRetry };
  }
}

export function requestEnableAI(reason = 'user-click') {
  console.log('[GPA] Requesting AI enable, reason:', reason);
  window.postMessage({ 
    source: 'GPA_CONTENT', 
    type: 'ENABLE_AI', 
    reason 
  }, '*');
}

export function probeAIAvailability() {
  requestEnableAI('auto-check');
}

export function getAIStatus() {
  return { aiReady, aiWhy };
}

export function isAIReady() {
  return aiReady;
}

// Cleanup function
export function cleanup() {
  window.removeEventListener('message', handleWindowMessage);
  bridgeInitialized = false;
  pending.clear();
  statusListeners.clear();
}
