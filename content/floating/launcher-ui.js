import {
  DEFAULT_OFFSET,
  EDGE_PADDING,
  HOVER_SHADOW,
  RESTING_SHADOW,
} from './constants.js';

const clampPosition = (value, min, max) => Math.min(Math.max(min, value), max);

export const createLauncherUI = ({
  state,
  onMainAction,
  onStateChange,
  onHideRequested,
}) => {
  let container = null;
  let closeButton = null;
  let isDragging = false;
  let dragPointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let pointerMoved = false;
  let justDragged = false;

  const notifyStateChange = () => {
    onStateChange?.({ ...state });
  };

  const ensureContainer = () => {
    if (container) {
      return container;
    }

    container = document.createElement('div');
    container.id = 'gmail-priority-ai-floating-launcher';
    container.setAttribute('role', 'button');
    container.setAttribute('tabindex', '0');
    Object.assign(container.style, {
      position: 'fixed',
      bottom: `${DEFAULT_OFFSET}px`,
      right: `${DEFAULT_OFFSET}px`,
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 18px',
      borderRadius: '999px',
      background: '#1a73e8',
      color: '#fff',
      font: '600 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      cursor: 'pointer',
      boxShadow: RESTING_SHADOW,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      touchAction: 'none',
      userSelect: 'none',
    });

    const label = document.createElement('span');
    label.textContent = 'Priority AI';
    label.style.pointerEvents = 'none';
    container.appendChild(label);

    closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Hide Priority AI launcher');
    closeButton.title = 'Hide launcher (Alt+Shift+P to show)';
    closeButton.innerHTML = '&times;';
    Object.assign(closeButton.style, {
      position: 'absolute',
      top: '-6px',
      right: '-6px',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      border: 'none',
      background: '#202124',
      color: '#fff',
      fontSize: '12px',
      fontWeight: '700',
      lineHeight: '20px',
      cursor: 'pointer',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      padding: '0',
    });

    closeButton.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      hide();
      onHideRequested?.();
      notifyStateChange();
    });

    container.addEventListener('mouseenter', () => {
      if (state.hidden) {
        return;
      }
      container.style.transform = 'translateY(-2px)';
      container.style.boxShadow = HOVER_SHADOW;
    });

    container.addEventListener('mouseleave', () => {
      container.style.transform = 'translateY(0)';
      container.style.boxShadow = RESTING_SHADOW;
    });

    container.addEventListener('click', () => {
      if (justDragged) {
        justDragged = false;
        return;
      }
      onMainAction?.();
    });

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerCancel);
    container.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        onMainAction?.();
      }
    });

    container.appendChild(closeButton);
    document.body.appendChild(container);
    applyStatePosition(false);

    return container;
  };

  const updateVisibility = () => {
    if (!container) {
      return;
    }
    container.style.display = state.hidden ? 'none' : 'flex';
  };

  const applyStatePosition = (persist = true) => {
    if (!container) {
      return;
    }
    if (typeof state.left === 'number' && typeof state.top === 'number') {
      setPosition(state.left, state.top, { persist });
    } else {
      container.style.top = '';
      container.style.left = '';
      container.style.bottom = `${DEFAULT_OFFSET}px`;
      container.style.right = `${DEFAULT_OFFSET}px`;
      if (persist) {
        delete state.left;
        delete state.top;
        notifyStateChange();
      }
    }
  };

  const setPosition = (left, top, { persist = true } = {}) => {
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const maxLeft = Math.max(EDGE_PADDING, window.innerWidth - rect.width - EDGE_PADDING);
    const maxTop = Math.max(EDGE_PADDING, window.innerHeight - rect.height - EDGE_PADDING);

    const clampedLeft = clampPosition(left, EDGE_PADDING, maxLeft);
    const clampedTop = clampPosition(top, EDGE_PADDING, maxTop);

    container.style.left = `${clampedLeft}px`;
    container.style.top = `${clampedTop}px`;
    container.style.right = 'auto';
    container.style.bottom = 'auto';

    state.left = clampedLeft;
    state.top = clampedTop;

    if (persist) {
      notifyStateChange();
    }
  };

  const show = () => {
    state.hidden = false;
    ensureContainer();
    updateVisibility();
    applyStatePosition(false);
    notifyStateChange();
    if (container && typeof container.focus === 'function') {
      container.focus();
    }
  };

  const hide = () => {
    state.hidden = true;
    updateVisibility();
    notifyStateChange();
  };

  const handlePointerDown = (event) => {
    if (!container || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    isDragging = true;
    pointerMoved = false;
    justDragged = false;
    dragPointerId = event.pointerId;
    const rect = container.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;

    if (container.setPointerCapture) {
      try {
        container.setPointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore capture errors.
      }
    }
  };

  const handlePointerMove = (event) => {
    if (!isDragging || event.pointerId !== dragPointerId) {
      return;
    }

    const deltaX = event.clientX - dragStartClientX;
    const deltaY = event.clientY - dragStartClientY;

    if (!pointerMoved) {
      if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
        return;
      }
      pointerMoved = true;
    }

    const targetLeft = event.clientX - dragOffsetX;
    const targetTop = event.clientY - dragOffsetY;
    setPosition(targetLeft, targetTop, { persist: false });
  };

  const finishDrag = () => {
    if (!isDragging) {
      return;
    }
    if (pointerMoved) {
      justDragged = true;
      pointerMoved = false;
      const rect = container.getBoundingClientRect();
      state.left = rect.left;
      state.top = rect.top;
      notifyStateChange();
    }
    isDragging = false;
    dragPointerId = null;
  };

  const handlePointerUp = (event) => {
    if (event.pointerId !== dragPointerId) {
      return;
    }
    if (container?.releasePointerCapture && container.hasPointerCapture?.(event.pointerId)) {
      try {
        container.releasePointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore release errors.
      }
    }
    finishDrag();
  };

  const handlePointerCancel = (event) => {
    if (event.pointerId !== dragPointerId) {
      return;
    }
    if (container?.releasePointerCapture && container.hasPointerCapture?.(event.pointerId)) {
      try {
        container.releasePointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore release errors.
      }
    }
    finishDrag();
  };

  const handleResize = () => {
    if (!container || state.hidden) {
      return;
    }
    if (typeof state.left === 'number' && typeof state.top === 'number') {
      setPosition(state.left, state.top);
    }
  };

  const destroy = () => {
    if (container) {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerCancel);
      container.remove();
      container = null;
    }
  };

  const ensureMounted = () => {
    const node = ensureContainer();
    updateVisibility();
    return node;
  };

  return {
    ensureMounted,
    show,
    hide,
    isHidden: () => !!state.hidden,
    updateVisibility,
    applyStatePosition,
    setPosition,
    handleResize,
    destroy,
    get element() {
      return container;
    },
  };
};
