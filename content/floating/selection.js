import { rectanglesIntersect } from './utils.js';

const clampRectToViewport = (rect) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.min(Math.max(0, rect.left), viewportWidth);
  const top = Math.min(Math.max(0, rect.top), viewportHeight);
  const right = Math.max(left + 1, Math.min(viewportWidth, rect.right));
  const bottom = Math.max(top + 1, Math.min(viewportHeight, rect.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
};

const collectTextFromRect = (rect) => {
  if (!rect) {
    return '';
  }

  const bounds = {
    left: rect.left,
    top: rect.top,
    right: rect.right ?? rect.left + rect.width,
    bottom: rect.bottom ?? rect.top + rect.height,
  };

  const parts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const rawValue = node?.nodeValue;
    if (!rawValue || !rawValue.trim()) {
      continue;
    }

    const parent = node.parentElement;
    if (!parent) {
      continue;
    }

    const style = window.getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      continue;
    }

    const parentRect = parent.getBoundingClientRect();
    if (!parentRect || parentRect.width === 0 || parentRect.height === 0) {
      continue;
    }

    if (!rectanglesIntersect(parentRect, bounds)) {
      continue;
    }

    parts.push(rawValue.trim());
  }

  const combined = parts.join(' ');
  return combined.replace(/\s+/g, ' ').trim();
};

export const createSelectionController = ({
  onSelectionComplete,
  onSelectionCancel,
  instructionDuration = 2500,
}) => {
  let active = false;
  let overlayEl = null;
  let selectionBoxEl = null;
  let selectionPointerId = null;
  let selectionStartX = 0;
  let selectionStartY = 0;
  let selectionCurrentX = 0;
  let selectionCurrentY = 0;

  const removeOverlay = () => {
    if (!overlayEl) {
      return;
    }
    overlayEl.removeEventListener('pointerdown', handlePointerDown);
    overlayEl.removeEventListener('pointermove', handlePointerMove);
    overlayEl.removeEventListener('pointerup', handlePointerUp);
    overlayEl.removeEventListener('pointercancel', handlePointerCancel);
    overlayEl.remove();
    overlayEl = null;
    selectionBoxEl = null;
  };

  const getSelectionRect = () => {
    const left = Math.min(selectionStartX, selectionCurrentX);
    const top = Math.min(selectionStartY, selectionCurrentY);
    const right = Math.max(selectionStartX, selectionCurrentX);
    const bottom = Math.max(selectionStartY, selectionCurrentY);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    return { left, top, right, bottom, width, height };
  };

  const updateSelectionBox = () => {
    if (!selectionBoxEl) {
      return;
    }
    const rect = getSelectionRect();
    selectionBoxEl.style.display = 'block';
    selectionBoxEl.style.left = `${rect.left}px`;
    selectionBoxEl.style.top = `${rect.top}px`;
    selectionBoxEl.style.width = `${rect.width}px`;
    selectionBoxEl.style.height = `${rect.height}px`;
  };

  const finalizeSelection = () => {
    const drawnRect = getSelectionRect();

    let normalizedRect = drawnRect;
    if (drawnRect.width < 8 && drawnRect.height < 8) {
      const target = document.elementFromPoint(selectionCurrentX, selectionCurrentY);
      if (target) {
        const targetRect = target.getBoundingClientRect();
        normalizedRect = {
          left: targetRect.left,
          top: targetRect.top,
          right: targetRect.right,
          bottom: targetRect.bottom,
          width: targetRect.width,
          height: targetRect.height,
        };
      }
    }

    normalizedRect = clampRectToViewport(normalizedRect);

    active = false;
    removeOverlay();

    const text = collectTextFromRect(normalizedRect);
    onSelectionComplete?.({
      rect: normalizedRect,
      text,
    });
  };

  const cancelSelection = () => {
    if (!active) {
      return;
    }

    if (overlayEl && selectionPointerId !== null && overlayEl.hasPointerCapture?.(selectionPointerId)) {
      try {
        overlayEl.releasePointerCapture(selectionPointerId);
      } catch (_err) {
        // Ignore release failures.
      }
    }
    selectionPointerId = null;
    active = false;
    removeOverlay();
    onSelectionCancel?.();
  };

  const handlePointerDown = (event) => {
    if (selectionPointerId !== null || event.button !== 0) {
      return;
    }
    event.preventDefault();
    selectionPointerId = event.pointerId;
    selectionStartX = event.clientX;
    selectionStartY = event.clientY;
    selectionCurrentX = event.clientX;
    selectionCurrentY = event.clientY;

    if (overlayEl?.setPointerCapture) {
      try {
        overlayEl.setPointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore capture failures.
      }
    }
    updateSelectionBox();
  };

  const handlePointerMove = (event) => {
    if (selectionPointerId !== event.pointerId) {
      return;
    }
    selectionCurrentX = event.clientX;
    selectionCurrentY = event.clientY;
    updateSelectionBox();
  };

  const handlePointerUp = (event) => {
    if (selectionPointerId !== event.pointerId) {
      return;
    }

    if (overlayEl?.hasPointerCapture?.(event.pointerId)) {
      try {
        overlayEl.releasePointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore release failures.
      }
    }

    selectionPointerId = null;
    finalizeSelection();
  };

  const handlePointerCancel = (event) => {
    if (selectionPointerId !== event.pointerId) {
      return;
    }

    if (overlayEl?.hasPointerCapture?.(event.pointerId)) {
      try {
        overlayEl.releasePointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore release failures.
      }
    }

    selectionPointerId = null;
    cancelSelection();
  };

  const createOverlay = () => {
    overlayEl = document.createElement('div');
    overlayEl.id = 'gpa-selection-overlay';
    overlayEl.setAttribute('role', 'presentation');
    overlayEl.tabIndex = -1;
    Object.assign(overlayEl.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483646',
      cursor: 'crosshair',
      background: 'rgba(26,115,232,0.08)',
      backdropFilter: 'blur(1px)',
    });

    overlayEl.addEventListener('contextmenu', (event) => event.preventDefault());

    const instructionEl = document.createElement('div');
    instructionEl.textContent = 'Drag to select an area. Press Esc to cancel.';
    Object.assign(instructionEl.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#fff',
      padding: '8px 14px',
      borderRadius: '999px',
      fontSize: '13px',
      pointerEvents: 'none',
      zIndex: '2147483647',
      boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
    });

    selectionBoxEl = document.createElement('div');
    Object.assign(selectionBoxEl.style, {
      position: 'fixed',
      border: '2px solid #1a73e8',
      background: 'rgba(26,115,232,0.18)',
      borderRadius: '12px',
      pointerEvents: 'none',
      display: 'none',
      boxShadow: '0 6px 18px rgba(26, 115, 232, 0.25)',
    });

    overlayEl.addEventListener('pointerdown', handlePointerDown);
    overlayEl.addEventListener('pointermove', handlePointerMove);
    overlayEl.addEventListener('pointerup', handlePointerUp);
    overlayEl.addEventListener('pointercancel', handlePointerCancel);

    document.body.appendChild(overlayEl);
    overlayEl.appendChild(selectionBoxEl);
    overlayEl.appendChild(instructionEl);

    instructionEl.style.opacity = '0';
    instructionEl.style.transition = 'opacity 0.25s ease';
    requestAnimationFrame(() => {
      instructionEl.style.opacity = '0.9';
    });
    setTimeout(() => {
      instructionEl.style.opacity = '0';
      setTimeout(() => instructionEl.remove(), 250);
    }, instructionDuration);
  };

  const startSelection = () => {
    if (active) {
      return;
    }
    active = true;
    selectionPointerId = null;
    createOverlay();
  };

  return {
    isActive: () => active,
    startSelection,
    cancelSelection,
  };
};
