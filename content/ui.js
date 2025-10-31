let bannerEl = null;
let enableButton = null;

function ensureBanner(onEnable) {
  if (bannerEl) {
    if (enableButton && onEnable) {
      enableButton.onclick = (ev) => {
        ev.preventDefault();
        onEnable();
      };
    }
    return bannerEl;
  }

  bannerEl = document.createElement('div');
  bannerEl.id = 'gpa-enable-banner';
  Object.assign(bannerEl.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '2147483647',
    maxWidth: '320px',
    padding: '12px 16px',
    borderRadius: '12px',
    background: '#1a73e8',
    color: '#fff',
    font: '14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    boxShadow: '0 4px 12px rgba(26, 115, 232, 0.35)',
  });

  const title = document.createElement('div');
  title.textContent = 'Enable AI classification to prioritize this inbox.';
  title.style.marginBottom = '10px';
  title.style.fontWeight = '600';

  enableButton = document.createElement('button');
  enableButton.textContent = 'Enable AI Now';
  Object.assign(enableButton.style, {
    background: '#fff',
    color: '#1a73e8',
    border: 'none',
    borderRadius: '999px',
    padding: '8px 14px',
    fontWeight: '600',
    cursor: 'pointer',
  });

  enableButton.onmouseenter = () => {
    enableButton.style.background = '#f8fbff';
  };
  enableButton.onmouseleave = () => {
    enableButton.style.background = '#fff';
  };

  enableButton.onclick = (ev) => {
    ev.preventDefault();
    if (onEnable) onEnable();
  };

  const tip = document.createElement('div');
  tip.textContent = 'AI runs locally via Gemini Nano; first use may trigger a quick download.';
  tip.style.marginTop = '8px';
  tip.style.fontSize = '12px';
  tip.style.opacity = '0.9';

  bannerEl.appendChild(title);
  bannerEl.appendChild(enableButton);
  bannerEl.appendChild(tip);

  document.body.appendChild(bannerEl);
  return bannerEl;
}

function removeBanner() {
  if (!bannerEl) return;
  bannerEl.remove();
  bannerEl = null;
  enableButton = null;
}

export function updateBanner(status, onEnable) {
  if (!status) return;
  if (!status.aiReady) {
    const banner = ensureBanner(onEnable);
    banner.style.display = 'block';
  } else {
    removeBanner();
  }
}

