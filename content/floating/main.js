import { SHORTCUT_CODE } from './constants.js';
import { getDefaultState, loadLauncherState, persistLauncherState } from './state.js';
import { createLauncherUI } from './launcher-ui.js';
import { createSelectionController } from './selection.js';
import { createModalController } from './modal.js';
import { requestSelectionCapture } from './capture.js';
import { runPromptAction, detectLanguage } from './prompt-service.js';

export const initFloatingLauncher = async () => {
  if (!document.body) {
    await new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      } else {
        resolve();
      }
    });
  }

  const persistedState = await loadLauncherState();
  const state = { ...getDefaultState(), ...persistedState };

  const persistState = () => {
    persistLauncherState(state);
  };

  const launcherUI = createLauncherUI({
    state,
    onMainAction: () => {
      if (selectionController.isActive()) {
        return;
      }
      modalController.dismiss();
      hideTemporarily();
      selectionController.startSelection();
    },
    onStateChange: (nextState) => {
      Object.assign(state, nextState);
      persistState();
    },
    onHideRequested: persistState,
  });

  const selectionController = createSelectionController({
    onSelectionComplete: async ({ rect, text }) => {
      restoreVisibility();

      const payload = {
        text,
        rect,
        source: location.href,
        imageDataUrl: null,
        imageBlob: null,
        captureError: null,
        detectedLanguage: null,
      };

      try {
        const capture = await requestSelectionCapture({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
        if (capture?.ok && capture.dataUrl) {
          payload.imageDataUrl = capture.dataUrl;
          try {
            const response = await fetch(capture.dataUrl);
            payload.imageBlob = await response.blob();
          } catch (err) {
            payload.captureError =
              err?.message || capture?.error || 'Unable to prepare the captured image for analysis.';
            payload.imageBlob = null;
          }
        } else if (capture && capture.error) {
          payload.captureError = capture.error;
        }
      } catch (err) {
        payload.captureError = err?.message || 'Unable to capture the selected area.';
      }
      console.log('[Priority AI] Selection complete', {
        hasText: !!payload.text?.trim(),
        textPreview: payload.text?.slice(0, 120),
        hasImage: !!payload.imageDataUrl,
        captureError: payload.captureError,
      });
      modalController.show(payload);
      activePayload = payload;

      if (payload.text && payload.text.trim().length > 0) {
        detectLanguage(payload.text).then((result) => {
          if (activePayload !== payload) {
            return;
          }
          if (result?.ok && result.label) {
            modalController.setDetectedLanguage(result.label);
            activePayload.detectedLanguage = result.language || result.normalized || null;
          } else if (result?.error) {
            modalController.setDetectedLanguage('—');
            activePayload.detectedLanguage = null;
            console.warn('[Priority AI] Language detection failed', result.error);
          } else {
            modalController.setDetectedLanguage('—');
            activePayload.detectedLanguage = null;
          }
        }).catch((error) => {
          if (activePayload !== payload) {
            return;
          }
          modalController.setDetectedLanguage('—');
          activePayload.detectedLanguage = null;
          console.warn('[Priority AI] Language detection error', error);
        });
      } else {
        modalController.setDetectedLanguage('—');
        activePayload.detectedLanguage = null;
      }
    },
    onSelectionCancel: () => {
      restoreVisibility();
    },
  });

  let activePayload = null;
  const modalController = createModalController({
    onAction: async (kind, options = {}) => {
      if (!activePayload) {
        return;
      }
      const targetLanguage =
        typeof options?.targetLanguage === 'string' ? options.targetLanguage : '';
      console.log('[Priority AI] Action selected', kind, {
        hasText: !!activePayload.text?.trim(),
        textPreview: activePayload.text?.slice(0, 120),
        hasImage: !!activePayload.imageDataUrl,
        targetLanguage,
      });

      if (kind === 'translate') {
        if (!modalController.isTranslationOptionsVisible()) {
          modalController.showTranslationOptions({ focus: true });
          modalController.updateStatus('Choose a target language, then press Translate again.', {
            isPending: true,
          });
          return;
        }
        if (!targetLanguage) {
          modalController.updateStatus('Please choose a target language before translating.', {
            isError: true,
          });
          return;
        }
      }

      modalController.setButtonsDisabled(true);
      modalController.setLoadingMessage(kind);

      try {
        const response = await runPromptAction(kind, activePayload, {
          targetLanguage,
          onStatus: (message, options) => modalController.updateStatus(message, options),
        });
        const trimmed =
          typeof response === 'string' && response.trim().length > 0 ? response.trim() : response;
        modalController.updateStatus(trimmed || 'No response received.');
      } catch (error) {
        modalController.updateStatus(
          error?.message || error?.name || 'Something went wrong while contacting the Priority AI service.',
          { isError: true },
        );
        console.error('[Priority AI] Action failed', kind, error);
      } finally {
        modalController.setButtonsDisabled(false);
      }
    },
    onClose: () => {
      activePayload = null;
    },
  });

  let temporaryHidden = false;

  const hideTemporarily = () => {
    const element = launcherUI.ensureMounted();
    if (!state.hidden && element) {
      element.style.visibility = 'hidden';
      element.style.pointerEvents = 'none';
      temporaryHidden = true;
    }
  };

  const restoreVisibility = () => {
    const element = launcherUI.ensureMounted();
    if (temporaryHidden && element) {
      element.style.visibility = '';
      element.style.pointerEvents = '';
      temporaryHidden = false;
    }
    launcherUI.updateVisibility();
  };

  const handleGlobalKeydown = (event) => {
    if (event.key === 'Escape') {
      if (modalController.isVisible()) {
        event.preventDefault();
        modalController.dismiss();
        return;
      }
      if (selectionController.isActive()) {
        event.preventDefault();
        selectionController.cancelSelection();
        return;
      }
    }

    if (event.code === SHORTCUT_CODE && event.altKey && event.shiftKey) {
      event.preventDefault();
      if (selectionController.isActive()) {
        selectionController.cancelSelection();
      }
      launcherUI.show();
    }
  };

  const ensureMounted = () => {
    const element = launcherUI.ensureMounted();
    if (state.hidden) {
      launcherUI.hide();
    } else {
      launcherUI.updateVisibility();
    }
    return element;
  };

  ensureMounted();
  persistState();

  document.addEventListener('keydown', handleGlobalKeydown, false);
  window.addEventListener('resize', launcherUI.handleResize, false);

  const observer = new MutationObserver(() => {
    const element = launcherUI.element;
    if (!element || !document.body.contains(element)) {
      ensureMounted();
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
};
