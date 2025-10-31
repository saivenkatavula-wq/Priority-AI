import { truncateText } from './utils.js';
import { MAX_SELECTION_PROMPT_LENGTH } from './constants.js';

const ACTIONS = [
  { kind: 'summarize', label: 'Summarize' },
  { kind: 'translate', label: 'Translate' },
];

const ALL_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'zh-hant', label: 'Chinese (Traditional)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ru', label: 'Russian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'sv', label: 'Swedish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'pl', label: 'Polish' },
  { value: 'tr', label: 'Turkish' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'th', label: 'Thai' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ms', label: 'Malay' },
  { value: 'no', label: 'Norwegian' },
  { value: 'da', label: 'Danish' },
  { value: 'he', label: 'Hebrew' },
  { value: 'el', label: 'Greek' },
  { value: 'cs', label: 'Czech' },
  { value: 'sk', label: 'Slovak' },
  { value: 'sl', label: 'Slovenian' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'ro', label: 'Romanian' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'hr', label: 'Croatian' },
  { value: 'sr', label: 'Serbian' },
  { value: 'lt', label: 'Lithuanian' },
  { value: 'lv', label: 'Latvian' },
  { value: 'et', label: 'Estonian' },
  { value: 'ca', label: 'Catalan' },
  { value: 'eu', label: 'Basque' },
  { value: 'gl', label: 'Galician' },
  { value: 'hi-latn', label: 'Hindi (Latin)' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'mr', label: 'Marathi' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ur', label: 'Urdu' },
  { value: 'fa', label: 'Persian' },
  { value: 'sw', label: 'Swahili' },
  { value: 'zu', label: 'Zulu' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'is', label: 'Icelandic' },
  { value: 'ga', label: 'Irish' },
  { value: 'mt', label: 'Maltese' },
  { value: 'la', label: 'Latin' },
  { value: 'eo', label: 'Esperanto' },
];

const SUGGESTED_LANGUAGE_OPTIONS = ALL_LANGUAGE_OPTIONS.slice(0, 5);

export const createModalController = ({ onAction, onClose } = {}) => {
  let backdropEl = null;
  let modalEl = null;
  let previewTextEl = null;
  let previewImageEl = null;
  let resultEl = null;
  let actionButtons = [];
  let buttonsDisabled = false;
  let detectedLanguageEl = null;
  let languageBadgeRow = null;
  let languageBadgeEl = null;
  let translationSection = null;
  let translationVisible = false;
  let targetLanguageSummaryEl = null;
  let suggestedButtons = [];
  let targetLanguageSearchInput = null;
  let targetLanguageResultsEl = null;
  let selectedTargetLanguage = '';

  const dismiss = () => {
    actionButtons = [];
    buttonsDisabled = false;

    if (previewImageEl) {
      previewImageEl.src = '';
    }
    previewTextEl = null;
    previewImageEl = null;
    resultEl = null;
    detectedLanguageEl = null;
    languageBadgeRow = null;
    languageBadgeEl = null;
    translationSection = null;
    translationVisible = false;
    targetLanguageSummaryEl = null;
    suggestedButtons = [];
    targetLanguageSearchInput = null;
    targetLanguageResultsEl = null;
    selectedTargetLanguage = '';

    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
    if (backdropEl) {
      backdropEl.remove();
      backdropEl = null;
    }

    onClose?.();
  };

  const findLanguageOption = (value) =>
    ALL_LANGUAGE_OPTIONS.find((option) => option.value === value) || null;

  const getSelectedTargetLanguage = () => selectedTargetLanguage;

  const updateTargetLanguageUI = () => {
    suggestedButtons.forEach((button) => {
      const isActive = button.dataset.value === selectedTargetLanguage;
      button.style.background = isActive ? '#174ea6' : '#1a73e8';
      button.style.color = '#fff';
      button.style.opacity = isActive ? '1' : '0.95';
    });

    if (targetLanguageSummaryEl) {
      if (selectedTargetLanguage) {
        const option = findLanguageOption(selectedTargetLanguage);
        targetLanguageSummaryEl.textContent = option
          ? `Selected: ${option.label}`
          : `Selected: ${selectedTargetLanguage}`;
      } else {
        targetLanguageSummaryEl.textContent = 'No language selected.';
      }
    }
  };

  const setTargetLanguage = (value) => {
    const option = findLanguageOption(value);
    selectedTargetLanguage = option ? option.value : '';
    updateTargetLanguageUI();
    if (targetLanguageSearchInput) {
      targetLanguageSearchInput.value = '';
    }
    if (targetLanguageResultsEl) {
      targetLanguageResultsEl.replaceChildren();
      targetLanguageResultsEl.style.display = 'none';
    }
  };

  const renderLanguageSearchResults = (query) => {
    if (!targetLanguageResultsEl) return;

    const normalizedQuery = String(query || '').trim().toLowerCase();
    targetLanguageResultsEl.replaceChildren();

    if (!normalizedQuery) {
      targetLanguageResultsEl.style.display = 'none';
      return;
    }

    const matches = ALL_LANGUAGE_OPTIONS.filter(({ label, value }) => {
      const base = label.toLowerCase();
      const val = value.toLowerCase();
      return base.includes(normalizedQuery) || val.includes(normalizedQuery);
    }).slice(0, 20);

    if (!matches.length) {
      targetLanguageResultsEl.style.display = 'none';
      return;
    }

    targetLanguageResultsEl.style.display = 'flex';
    matches.forEach(({ value, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.value = value;
      button.textContent = label;
      Object.assign(button.style, {
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid #dadce0',
        background: value === selectedTargetLanguage ? '#e8f0fe' : '#fff',
        color: '#202124',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      });
      button.addEventListener('click', () => {
        setTargetLanguage(value);
      });
      targetLanguageResultsEl.appendChild(button);
    });
  };

  const setButtonsDisabled = (disabled) => {
    buttonsDisabled = disabled;
    actionButtons.forEach((button) => {
      button.disabled = disabled;
      button.style.opacity = disabled ? '0.6' : '1';
    });
    if (targetLanguageSearchInput) {
      targetLanguageSearchInput.disabled = disabled;
    }
    suggestedButtons.forEach((button) => {
      button.disabled = disabled;
      if (disabled) {
        button.style.opacity = '0.6';
      } else {
        const isActive = button.dataset.value === selectedTargetLanguage;
        button.style.opacity = isActive ? '1' : '0.95';
      }
    });
    targetLanguageResultsEl?.querySelectorAll('button').forEach((button) => {
      button.disabled = disabled;
      button.style.opacity = disabled ? '0.6' : '1';
    });
  };

  const updateStatus = (message, { isError = false, isPending = false } = {}) => {
    if (!resultEl) {
      return;
    }
    resultEl.textContent = message;
    resultEl.style.color = isError ? '#c5221f' : '#202124';
    resultEl.style.opacity = isPending ? '0.8' : '1';
  };

  const setLoadingMessage = (kind) => {
    if (kind === 'summarize') {
      updateStatus('Summarizing selection with on-device AI…', { isPending: true });
    } else if (kind === 'translate') {
      updateStatus('Translating selection with on-device AI…', { isPending: true });
    } else {
      updateStatus('Contacting Priority AI services…', { isPending: true });
    }
  };

  const setDetectedLanguage = (text) => {
    const label =
      typeof text === 'string' && text.trim().length > 0 ? text.trim() : '—';
    if (detectedLanguageEl) {
      detectedLanguageEl.textContent = `Detected language: ${label}`;
    }
    if (languageBadgeRow && languageBadgeEl) {
      const showBadge = label !== '—';
      languageBadgeEl.textContent = label;
      languageBadgeRow.style.display = showBadge ? 'flex' : 'none';
    }
  };

  const showTranslationOptions = ({ focus = false } = {}) => {
    if (!translationSection) return;
    translationSection.style.display = 'flex';
    translationVisible = true;
    updateTargetLanguageUI();
    if (targetLanguageSearchInput) {
      targetLanguageSearchInput.value = '';
    }
    if (targetLanguageResultsEl) {
      targetLanguageResultsEl.replaceChildren();
      targetLanguageResultsEl.style.display = 'none';
    }
    if (focus && targetLanguageSearchInput) {
      setTimeout(() => targetLanguageSearchInput?.focus(), 0);
    }
  };

  const hideTranslationOptions = () => {
    if (!translationSection) return;
    translationSection.style.display = 'none';
    translationVisible = false;
    setTargetLanguage('');
  };

  const isTranslationOptionsVisible = () => translationVisible;

  const createActionButton = (kind, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      flex: '1',
      minWidth: '120px',
      padding: '10px 14px',
      borderRadius: '999px',
      border: 'none',
      background: '#1a73e8',
      color: '#fff',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(26, 115, 232, 0.25)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    });

    button.addEventListener('mouseenter', () => {
      if (buttonsDisabled) return;
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 6px 18px rgba(26, 115, 232, 0.3)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 12px rgba(26, 115, 232, 0.25)';
    });

    button.addEventListener('click', () => {
      if (buttonsDisabled) return;
      const actionOptions =
        kind === 'translate'
          ? { targetLanguage: getSelectedTargetLanguage() }
          : undefined;
      onAction?.(kind, actionOptions);
    });

    return button;
  };

  const mountModal = (payload) => {
    backdropEl = document.createElement('div');
    Object.assign(backdropEl.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483646',
      background: 'rgba(0,0,0,0.35)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    });

    backdropEl.addEventListener('click', (event) => {
      if (event.target === backdropEl) {
        dismiss();
      }
    });

    modalEl = document.createElement('div');
    Object.assign(modalEl.style, {
      background: '#fff',
      color: '#202124',
      borderRadius: '18px',
      boxShadow: '0 18px 48px rgba(0,0,0,0.2)',
      width: 'min(420px, calc(100vw - 32px))',
      maxHeight: 'min(560px, calc(100vh - 48px))',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      position: 'relative',
      overflowY: 'auto',
      boxSizing: 'border-box',
    });

    const title = document.createElement('h2');
    title.textContent = 'Priority AI';
    Object.assign(title.style, {
      margin: '0',
      fontSize: '20px',
      fontWeight: '600',
    });

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Choose what you would like to do with the selected snippet.';
    Object.assign(subtitle.style, {
      margin: '0',
      color: '#5f6368',
      fontSize: '14px',
    });

    const previewWrapper = document.createElement('div');
    Object.assign(previewWrapper.style, {
      background: '#f1f3f4',
      borderRadius: '12px',
      margin: '0 -20px',
      padding: '12px 20px',
      maxHeight: '35vh',
      overflowY: 'auto',
      fontSize: '13px',
      lineHeight: '1.5',
      color: '#202124',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      position: 'relative',
    });

    const text = payload?.text?.trim();
    previewTextEl = document.createElement('div');
    previewTextEl.style.whiteSpace = 'pre-wrap';
    if (text) {
      previewTextEl.textContent = truncateText(text, MAX_SELECTION_PROMPT_LENGTH);
    } else if (payload?.captureError) {
      previewTextEl.textContent = `No readable text detected. Image capture unavailable: ${payload.captureError}`;
    } else {
      previewTextEl.textContent =
        'No readable text detected. We will send the selected region to the Prompt API as an image.';
    }
    previewWrapper.appendChild(previewTextEl);

    if (payload?.imageDataUrl) {
      previewImageEl = document.createElement('img');
      previewImageEl.src = payload.imageDataUrl;
      Object.assign(previewImageEl.style, {
        width: '100%',
        borderRadius: '10px',
        objectFit: 'cover',
        maxHeight: '180px',
      });
      previewWrapper.appendChild(previewImageEl);
    } else {
      previewImageEl = null;
    }

    languageBadgeRow = document.createElement('div');
    Object.assign(languageBadgeRow.style, {
      display: 'none',
      justifyContent: 'flex-end',
      margin: '10px -4px 0',
      paddingRight: '16px',
    });

    languageBadgeEl = document.createElement('span');
    Object.assign(languageBadgeEl.style, {
      padding: '4px 10px',
      borderRadius: '999px',
      background: '#ffffff',
      color: '#3c4043',
      fontSize: '11px',
      fontWeight: '600',
      border: '1px solid rgba(60, 64, 67, 0.25)',
      letterSpacing: '0.4px',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 3px rgba(60, 64, 67, 0.18)',
    });
    languageBadgeRow.appendChild(languageBadgeEl);

    translationSection = document.createElement('div');
    Object.assign(translationSection.style, {
      marginTop: '12px',
      background: '#f8f9fa',
      borderRadius: '12px',
      padding: '12px',
      display: 'none',
      flexDirection: 'column',
      gap: '10px',
      width: '100%',
    });

    const translationHeader = document.createElement('div');
    translationHeader.textContent = 'Translate to another language';
    Object.assign(translationHeader.style, {
      fontWeight: '600',
      fontSize: '13px',
    });

    detectedLanguageEl = document.createElement('div');
    detectedLanguageEl.textContent = 'Detected language: —';
    Object.assign(detectedLanguageEl.style, {
      fontSize: '12px',
      color: '#5f6368',
    });

    targetLanguageSummaryEl = document.createElement('div');
    Object.assign(targetLanguageSummaryEl.style, {
      fontSize: '12px',
      color: '#202124',
      opacity: '0.9',
    });
    targetLanguageSummaryEl.textContent = 'No language selected.';

    const quickRow = document.createElement('div');
    Object.assign(quickRow.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
    });

    suggestedButtons = SUGGESTED_LANGUAGE_OPTIONS.map(({ value, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.value = value;
      button.textContent = label;
      Object.assign(button.style, {
        padding: '8px 12px',
        borderRadius: '20px',
        border: 'none',
        background: '#1a73e8',
        color: '#fff',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(26,115,232,0.2)',
        flex: '1 1 120px',
      });
      button.addEventListener('click', () => {
        setTargetLanguage(value);
      });
      quickRow.appendChild(button);
      return button;
    });

    const searchWrapper = document.createElement('div');
    Object.assign(searchWrapper.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      width: '100%',
    });

    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Search other languages';
    Object.assign(searchLabel.style, {
      fontSize: '13px',
      color: '#202124',
    });

    targetLanguageSearchInput = document.createElement('input');
    targetLanguageSearchInput.type = 'search';
    targetLanguageSearchInput.placeholder = 'Type to search for any language…';
    Object.assign(targetLanguageSearchInput.style, {
      padding: '8px 10px',
      borderRadius: '8px',
      border: '1px solid #dadce0',
      fontSize: '13px',
      background: '#fff',
      color: '#202124',
    });

    targetLanguageResultsEl = document.createElement('div');
    Object.assign(targetLanguageResultsEl.style, {
      display: 'none',
      flexDirection: 'column',
      gap: '6px',
      maxHeight: '160px',
      overflowY: 'auto',
    });

    targetLanguageSearchInput.addEventListener('input', (event) => {
      renderLanguageSearchResults(event.target.value);
    });

    targetLanguageSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const firstResult = targetLanguageResultsEl?.querySelector('button');
        if (firstResult) {
          firstResult.click();
          event.preventDefault();
        }
      }
    });

    searchWrapper.appendChild(searchLabel);
    searchWrapper.appendChild(targetLanguageSearchInput);
    searchWrapper.appendChild(targetLanguageResultsEl);

    translationSection.appendChild(translationHeader);
    translationSection.appendChild(detectedLanguageEl);
    translationSection.appendChild(targetLanguageSummaryEl);
    translationSection.appendChild(quickRow);
    translationSection.appendChild(searchWrapper);

    const actionsRow = document.createElement('div');
    Object.assign(actionsRow.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      width: '100%',
    });
    actionButtons = ACTIONS.map(({ kind, label }) => {
      const button = createActionButton(kind, label);
      actionsRow.appendChild(button);
      return button;
    });

    resultEl = document.createElement('div');
    Object.assign(resultEl.style, {
      minHeight: '60px',
      background: '#f8f9fa',
      borderRadius: '12px',
      padding: '12px',
      fontSize: '13px',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      color: '#202124',
    });
    updateStatus('Select an action to get started.');

    const footerRow = document.createElement('div');
    Object.assign(footerRow.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: '8px',
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    Object.assign(closeBtn.style, {
      border: 'none',
      background: 'transparent',
      color: '#1a73e8',
      fontWeight: '600',
      cursor: 'pointer',
      padding: '8px 12px',
      alignSelf: 'flex-end',
    });
    closeBtn.addEventListener('click', () => dismiss());
    footerRow.appendChild(closeBtn);

    modalEl.appendChild(title);
    modalEl.appendChild(subtitle);
    modalEl.appendChild(previewWrapper);
    modalEl.appendChild(languageBadgeRow);
    modalEl.appendChild(translationSection);
    modalEl.appendChild(actionsRow);
    modalEl.appendChild(resultEl);
    modalEl.appendChild(footerRow);
    backdropEl.appendChild(modalEl);
    document.body.appendChild(backdropEl);

    setTimeout(() => {
      actionButtons[0]?.focus();
    }, 0);
  };

  const show = (payload) => {
    dismiss();
    mountModal(payload);
    hideTranslationOptions();
    setDetectedLanguage('Detecting…');
  };

  const isVisible = () => !!modalEl;

  return {
    show,
    dismiss,
    updateStatus,
    setButtonsDisabled,
    setLoadingMessage,
    isVisible,
    setDetectedLanguage,
    setTargetLanguage,
    getSelectedTargetLanguage,
    showTranslationOptions,
    hideTranslationOptions,
    isTranslationOptionsVisible,
  };
};
