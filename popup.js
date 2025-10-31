const statusEl = document.getElementById('status');

async function getGmailTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshStatus() {
  const tab = await getGmailTab();
  if (!tab?.id) {
    statusEl.textContent = 'Open Gmail to see AI priority indicators.';
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { getStatus: true });
    if (res?.aiReady) {
      statusEl.textContent = 'Built-in AI active. Priorities are model-driven.';
    } else {
      switch (res?.aiWhy) {
        case 'no_api':
          statusEl.textContent = 'This Chrome channel lacks built-in AI yet.';
          break;
        case 'after-download':
          statusEl.textContent = 'Model download pending. Click enable to finish.';
          break;
        case 'downloading':
          statusEl.textContent = 'Downloading Gemini Nano model… keep this tab active.';
          break;
        case 'unavailable':
          statusEl.textContent = 'Built-in AI temporarily unavailable. Try again soon.';
          break;
        case 'needs-gesture':
          statusEl.textContent = 'Click the button to finish enabling Gemini Nano.';
          break;
        case 'error':
          statusEl.textContent = 'Error creating AI session. Retry after refreshing Gmail.';
          break;
        default:
          statusEl.textContent = 'AI warming up. Priorities will appear once ready.';
      }
    }
  } catch (err) {
    statusEl.textContent = 'Waiting for Gmail page to load extension…';
  }
}

document.getElementById('enable').addEventListener('click', async () => {
  // User gesture to allow Prompt API downloads
  const tab = await getGmailTab();
  if (!tab?.id) {
    statusEl.textContent = 'Active tab is not Gmail. Open Gmail and retry.';
    return;
  }
  statusEl.textContent = 'Requesting built-in AI…';
  try {
    await chrome.tabs.sendMessage(tab.id, { enableAI: true });
    setTimeout(refreshStatus, 800);
  } catch (err) {
    statusEl.textContent = 'Could not reach Gmail content script. Refresh Gmail.';
  }
});

refreshStatus();
