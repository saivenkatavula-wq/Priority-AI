chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;
  chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }).catch(() => {});
});

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const captureSelectionImage = async ({ rect, devicePixelRatio, windowId }) => {
  if (!rect || typeof rect.width !== 'number' || typeof rect.height !== 'number') {
    throw new Error('Invalid capture rectangle.');
  }

  const dpr = Math.max(1, Number(devicePixelRatio) || 1);
  const screenshotUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });

  const response = await fetch(screenshotUrl);
  const screenshotBlob = await response.blob();
  const bitmap = await createImageBitmap(screenshotBlob);

  const sourceX = Math.max(0, Math.floor(rect.left * dpr));
  const sourceY = Math.max(0, Math.floor(rect.top * dpr));
  const sourceWidth = Math.max(1, Math.floor(rect.width * dpr));
  const sourceHeight = Math.max(1, Math.floor(rect.height * dpr));

  const clampedWidth = Math.min(sourceWidth, bitmap.width - sourceX);
  const clampedHeight = Math.min(sourceHeight, bitmap.height - sourceY);

  if (clampedWidth <= 0 || clampedHeight <= 0) {
    bitmap.close();
    throw new Error('Selected area is outside the visible viewport.');
  }

  if (typeof OffscreenCanvas === 'undefined') {
    bitmap.close();
    return {
      dataUrl: screenshotUrl,
      width: bitmap.width,
      height: bitmap.height,
      fullFrame: true,
    };
  }

  const canvas = new OffscreenCanvas(clampedWidth, clampedHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    bitmap,
    sourceX,
    sourceY,
    clampedWidth,
    clampedHeight,
    0,
    0,
    clampedWidth,
    clampedHeight,
  );
  bitmap.close();

  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await croppedBlob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  return {
    dataUrl: `data:image/png;base64,${base64}`,
    width: clampedWidth,
    height: clampedHeight,
    fullFrame: false,
  };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'gpaCaptureSelection') {
    return undefined;
  }

  const windowId = sender.tab?.windowId;
  if (windowId === undefined) {
    sendResponse({ ok: false, error: 'Unable to capture selection (missing window context).' });
    return undefined;
  }

  const rect = {
    left: Number(message.rect?.left) || 0,
    top: Number(message.rect?.top) || 0,
    width: Number(message.rect?.width) || 0,
    height: Number(message.rect?.height) || 0,
  };

  const devicePixelRatio = Number(message.devicePixelRatio) || 1;

  (async () => {
    try {
      const capture = await captureSelectionImage({ rect, devicePixelRatio, windowId });
      sendResponse({ ok: true, ...capture });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error?.message || 'Failed to capture the selected area.',
      });
    }
  })();

  return true;
});
