export const requestSelectionCapture = async (rect) => {
  if (!chrome.runtime?.sendMessage) {
    return null;
  }
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'gpaCaptureSelection',
          rect,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
        (result) => {
          if (chrome.runtime?.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(result || null);
        },
      );
    });
    return response;
  } catch (_err) {
    return null;
  }
};
