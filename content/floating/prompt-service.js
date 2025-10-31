import { MAX_SELECTION_PROMPT_LENGTH } from './constants.js';
import { truncateText } from './utils.js';

const LANGUAGE_LABELS = new Map([
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['pt', 'Portuguese'],
  ['it', 'Italian'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['zh', 'Chinese'],
  ['zh-hans', 'Chinese (Simplified)'],
  ['zh-hant', 'Chinese (Traditional)'],
  ['hi', 'Hindi'],
  ['hi-latn', 'Hindi (Latin)'],
  ['ar', 'Arabic'],
  ['ru', 'Russian'],
  ['nl', 'Dutch'],
  ['sv', 'Swedish'],
  ['fi', 'Finnish'],
  ['pl', 'Polish'],
  ['tr', 'Turkish'],
  ['vi', 'Vietnamese'],
  ['th', 'Thai'],
  ['id', 'Indonesian'],
  ['ms', 'Malay'],
  ['no', 'Norwegian'],
  ['da', 'Danish'],
  ['he', 'Hebrew'],
  ['el', 'Greek'],
  ['cs', 'Czech'],
  ['sk', 'Slovak'],
  ['sl', 'Slovenian'],
  ['hu', 'Hungarian'],
  ['ro', 'Romanian'],
  ['bg', 'Bulgarian'],
  ['uk', 'Ukrainian'],
  ['hr', 'Croatian'],
  ['sr', 'Serbian'],
  ['lt', 'Lithuanian'],
  ['lv', 'Latvian'],
  ['et', 'Estonian'],
  ['ca', 'Catalan'],
  ['eu', 'Basque'],
  ['gl', 'Galician'],
  ['bn', 'Bengali'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['ml', 'Malayalam'],
  ['gu', 'Gujarati'],
  ['kn', 'Kannada'],
  ['mr', 'Marathi'],
  ['pa', 'Punjabi'],
  ['ur', 'Urdu'],
  ['fa', 'Persian'],
  ['sw', 'Swahili'],
  ['zu', 'Zulu'],
  ['af', 'Afrikaans'],
  ['is', 'Icelandic'],
  ['ga', 'Irish'],
  ['mt', 'Maltese'],
  ['la', 'Latin'],
  ['eo', 'Esperanto'],
]);

const normalizeLanguageCode = (code) => {
  if (!code) return '';
  return String(code).trim().toLowerCase().replace('_', '-');
};

const extractBaseLanguageCode = (code) => {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) return '';
  return normalized.split(/[-]/)[0];
};

const formatLanguageLabel = (code) => {
  if (!code) return '';
  const normalized = normalizeLanguageCode(code);
  const base = extractBaseLanguageCode(normalized);
  const label = LANGUAGE_LABELS.get(normalized) || LANGUAGE_LABELS.get(base);
  if (!label) return normalized;
  return `${label} (${base})`;
};

let languageDetectorInstance = null;
let languageDetectorPromise = null;
let languageDetectorAvailability = null;

const describeLanguageDetectorIssue = (status) => {
  switch (status) {
    case 'unavailable':
      return 'Language Detector API is unavailable on this device.';
    case 'error':
      return 'Language Detector API availability check failed.';
    default:
      return null;
  }
};

const resetLanguageDetector = () => {
  languageDetectorInstance = null;
  languageDetectorPromise = null;
};

const ensureLanguageDetector = async ({ onStatus } = {}) => {
  if (languageDetectorInstance) {
    return languageDetectorInstance;
  }
  if (languageDetectorPromise) {
    return languageDetectorPromise;
  }

  if (typeof LanguageDetector === 'undefined') {
    throw new Error('Language Detector API is not supported in this browser yet.');
  }

  const availability = await LanguageDetector.availability();
  languageDetectorAvailability = availability;
  if (availability === 'downloading' && onStatus) {
    onStatus('Downloading language detection model…', { isPending: true });
  }

  const issue = describeLanguageDetectorIssue(availability);
  if (issue && availability !== 'downloading' && availability !== 'downloadable') {
    throw new Error(issue);
  }

  const requiresActivation = typeof navigator !== 'undefined' && 'userActivation' in navigator;
  if (requiresActivation && !navigator.userActivation.isActive && availability !== 'available') {
    throw new Error('Please click again to allow on-device language detection.');
  }

  languageDetectorPromise = LanguageDetector.create({
    monitor(monitor) {
      if (!onStatus) return;
      monitor.addEventListener('downloadprogress', (event) => {
        const loaded = typeof event.loaded === 'number' ? event.loaded : 0;
        const percent = Math.min(100, Math.round((loaded || 0) * 100));
        if (percent >= 100) {
          onStatus('Language detection model is ready.', { isPending: false });
        } else {
          onStatus(`Downloading language detection model… ${percent}%`, { isPending: true });
        }
      });
    },
  })
    .then((detector) => {
      languageDetectorInstance = detector;
      return detector;
    })
    .catch((error) => {
      resetLanguageDetector();
      throw error;
    })
    .finally(() => {
      languageDetectorPromise = null;
    });

  return languageDetectorPromise;
};

export const detectLanguage = async (text, { onStatus } = {}) => {
  const snippet = typeof text === 'string' ? text.trim() : '';
  if (!snippet) {
    return {
      ok: false,
      language: null,
      normalized: '',
      label: '',
      confidence: 0,
      reason: 'empty',
    };
  }

  try {
    const detector = await ensureLanguageDetector({ onStatus });
    const results = await detector.detect(snippet);
    const candidates = Array.isArray(results) ? results : [];
    if (!candidates.length) {
      return {
        ok: false,
        language: null,
        normalized: '',
        label: '',
        confidence: 0,
        reason: 'no-match',
      };
    }
    const best = candidates[0] || {};
    const language = normalizeLanguageCode(best.detectedLanguage || '');
    const normalized = extractBaseLanguageCode(language);
    const confidence = typeof best.confidence === 'number' ? best.confidence : 0;
    return {
      ok: true,
      language,
      normalized,
      label: formatLanguageLabel(language),
      confidence,
      candidates,
    };
  } catch (error) {
    return {
      ok: false,
      language: null,
      normalized: '',
      label: '',
      confidence: 0,
      reason: 'error',
      error: error?.message || String(error),
    };
  }
};

let summarizerInstance = null;
let summarizerPromise = null;
let summarizerAvailability = null;

const translatorCache = new Map();
const translatorPromises = new Map();

const getTranslatorKey = (sourceLanguage, targetLanguage) =>
  `${normalizeLanguageCode(sourceLanguage || 'unknown')}->${normalizeLanguageCode(targetLanguage || 'unknown')}`;

const describeTranslatorAvailabilityIssue = (status) => {
  switch (status) {
    case 'unavailable':
      return 'Translator API is unavailable for this language pair.';
    case 'error':
      return 'Translator API availability check failed.';
    default:
      return null;
  }
};

const ensureTranslator = async ({ sourceLanguage, targetLanguage, onStatus } = {}) => {
  if (!sourceLanguage || !targetLanguage) {
    throw new Error('Translator requires both source and target languages.');
  }

  if (typeof Translator === 'undefined') {
    throw new Error('Translator API is not supported in this browser yet.');
  }

  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);
  const key = getTranslatorKey(normalizedSource, normalizedTarget);

  if (translatorCache.has(key)) {
    return translatorCache.get(key);
  }
  if (translatorPromises.has(key)) {
    return translatorPromises.get(key);
  }

  const options = {
    sourceLanguage: normalizedSource,
    targetLanguage: normalizedTarget,
    monitor(monitor) {
      if (!onStatus) return;
      monitor.addEventListener('downloadprogress', (event) => {
        const loaded = typeof event.loaded === 'number' ? event.loaded : 0;
        const percent = Math.min(100, Math.round((loaded || 0) * 100));
        if (percent >= 100) {
          onStatus('Translation model is ready.', { isPending: false });
        } else {
          onStatus(`Downloading translation model… ${percent}%`, { isPending: true });
        }
      });
    },
  };

  const availability = await Translator.availability(options);
  const issue = describeTranslatorAvailabilityIssue(availability);
  if (issue && availability !== 'downloading' && availability !== 'downloadable') {
    throw new Error(issue);
  }
  if ((availability === 'downloading' || availability === 'downloadable') && onStatus) {
    onStatus('Downloading translation model…', { isPending: true });
  }

  const requiresActivation = typeof navigator !== 'undefined' && 'userActivation' in navigator;
  if (requiresActivation && !navigator.userActivation.isActive && availability !== 'available') {
    throw new Error('Please click Translate again to allow on-device translation.');
  }

  const promise = Translator.create(options)
    .then((translator) => {
      translatorCache.set(key, translator);
      translatorPromises.delete(key);
      return translator;
    })
    .catch((error) => {
      translatorPromises.delete(key);
      throw error;
    });

  translatorPromises.set(key, promise);
  return promise;
};

const translateWithStreaming = async ({ translator, text, onStatus }) => {
  if (!translator) {
    throw new Error('Translator session is not available.');
  }

  if (typeof translator.translateStreaming === 'function') {
    try {
      const stream = await translator.translateStreaming(text);
      if (stream?.[Symbol.asyncIterator]) {
        let aggregated = '';
        for await (const chunk of stream) {
          const piece =
            typeof chunk === 'string'
              ? chunk
              : typeof chunk?.text === 'string'
                ? chunk.text
                : Array.isArray(chunk)
                  ? chunk.join('')
                  : '';
          if (!piece) continue;
          aggregated += piece;
          onStatus?.(aggregated.trim(), { isPending: true });
        }
        const finalText = aggregated.trim();
        if (finalText) {
          onStatus?.(finalText, { isPending: false });
          return finalText;
        }
      }
    } catch (error) {
      console.warn('[Priority AI] Streaming translation failed, falling back to batch mode.', error);
    }
  }

  const translation = await translator.translate(text);
  if (typeof translation === 'string') {
    const trimmed = translation.trim();
    if (trimmed) {
      onStatus?.(trimmed, { isPending: false });
    }
    return trimmed;
  }
  if (translation && typeof translation === 'object') {
    const maybeText = translation.translation || translation.text || translation.result;
    if (typeof maybeText === 'string') {
      const trimmed = maybeText.trim();
      if (trimmed) {
        onStatus?.(trimmed, { isPending: false });
      }
      return trimmed;
    }
    return JSON.stringify(translation);
  }
  return '';
};

const describeSummarizerAvailabilityIssue = (status) => {
  switch (status) {
    case 'no-permission':
      return 'Summarizer API requires Chromium AI features to be enabled.';
    case 'unavailable':
      return 'Summarizer API is unavailable on this device.';
    case 'error':
      return 'Summarizer API availability check failed.';
    default:
      return null;
  }
};

const resetSummarizer = () => {
  if (summarizerInstance?.destroy) {
    try {
      summarizerInstance.destroy();
    } catch (_err) {
      // Ignore cleanup failures.
    }
  }
  summarizerInstance = null;
  summarizerPromise = null;
};

const ensureSummarizer = async ({ onStatus } = {}) => {
  if (summarizerInstance) {
    return summarizerInstance;
  }
  if (summarizerPromise) {
    return summarizerPromise;
  }

  if (typeof Summarizer === 'undefined') {
    throw new Error('Summarizer API is not supported in this browser yet.');
  }

  const availability = await Summarizer.availability();
  summarizerAvailability = availability;
  if (availability === 'downloading' && onStatus) {
    onStatus('Downloading Summarizer model…', { isPending: true });
  }

  const availabilityIssue = describeSummarizerAvailabilityIssue(availability);
  if (availabilityIssue && availability !== 'downloading') {
    throw new Error(availabilityIssue);
  }

  const requiresActivation = typeof navigator !== 'undefined' && 'userActivation' in navigator;
  if (requiresActivation && !navigator.userActivation.isActive) {
    throw new Error('Please click Summarize again to allow on-device AI access.');
  }

  summarizerPromise = Summarizer.create({
    type: 'tldr',
    length: 'medium',
    format: 'plain-text',
    expectedInputLanguages: ['en', 'es', 'ja'],
    outputLanguage: 'en',
    expectedContextLanguages: ['en'],
    monitor: (monitor) => {
      if (!onStatus) return;
      monitor.addEventListener('downloadprogress', (event) => {
        const loaded = typeof event.loaded === 'number' ? event.loaded : 0;
        const percent = Math.min(100, Math.round((loaded || 0) * 100));
        if (percent >= 100) {
          onStatus('Summarizer model is ready.', { isPending: false });
        } else {
          onStatus(`Downloading Summarizer model… ${percent}%`, { isPending: true });
        }
      });
    },
  })
    .then((summarizer) => {
      summarizerInstance = summarizer;
      return summarizer;
    })
    .catch((error) => {
      resetSummarizer();
      throw error;
    })
    .finally(() => {
      summarizerPromise = null;
    });

  return summarizerPromise;
};

export const runPromptAction = async (kind, payload, { onStatus, targetLanguage } = {}) => {
  const snippet = payload?.text ? truncateText(payload.text.trim(), MAX_SELECTION_PROMPT_LENGTH) : '';

  if (!snippet) {
    if (payload?.captureError) {
      throw new Error(
        `We couldn't read any text from the selection (${payload.captureError}). Please try again.`,
      );
    }
    if (payload?.imageBlob) {
      throw new Error(
        'Image selections are not supported yet. Please include some text in your selection.',
      );
    }
    throw new Error('We could not capture any text. Please try selecting the content again.');
  }

  if (kind === 'translate') {
    if (!targetLanguage) {
      throw new Error('Please choose a target language before translating.');
    }

    const targetNormalized = normalizeLanguageCode(targetLanguage);
    let sourceLanguage = normalizeLanguageCode(payload?.detectedLanguage);

    if (!sourceLanguage) {
      const detection = await detectLanguage(snippet);
      if (detection.ok && detection.normalized) {
        sourceLanguage = normalizeLanguageCode(detection.language || detection.normalized);
        if (payload) {
          payload.detectedLanguage = sourceLanguage;
        }
      }
    }

    if (!sourceLanguage) {
      throw new Error('Unable to detect the source language for translation.');
    }

    if (sourceLanguage === targetNormalized) {
      return `The text is already in ${formatLanguageLabel(sourceLanguage)}.`;
    }

    if (payload) {
      payload.detectedLanguage = sourceLanguage;
    }

    const translator = await ensureTranslator({
      sourceLanguage,
      targetLanguage: targetNormalized,
      onStatus,
    });

    onStatus?.(
      `Translating from ${formatLanguageLabel(sourceLanguage)} to ${formatLanguageLabel(targetNormalized)}…`,
      { isPending: true },
    );

    const translated = await translateWithStreaming({
      translator,
      text: snippet,
      onStatus,
    });

    if (!translated) {
      throw new Error('Translator returned an empty response. Please try again.');
    }

    console.log('[Priority AI] Translator response', {
      sourceLanguage,
      targetLanguage: targetNormalized,
      textPreview: translated.slice(0, 120),
    });

    return translated;
  }

  if (kind !== 'summarize') {
    throw new Error(`Unsupported action: ${kind}`);
  }

  const summarizer = await ensureSummarizer({ onStatus });
  console.log('[Priority AI] Summarizer available', {
    availability: summarizerAvailability,
    snippetLength: snippet.length,
    source: payload?.source,
  });

  const summarizeOptions = {
    context: `Content captured from ${payload?.source || location.href}`,
    outputLanguage: 'en',
  };

  const tryStreamingSummary = async () => {
    if (typeof summarizer?.summarizeStreaming !== 'function') {
      return null;
    }
    try {
      const stream = await summarizer.summarizeStreaming(snippet, summarizeOptions);
      if (!stream?.[Symbol.asyncIterator]) {
        return null;
      }

      let aggregated = '';
      for await (const chunk of stream) {
        const piece =
          typeof chunk === 'string'
            ? chunk
            : typeof chunk?.text === 'string'
              ? chunk.text
              : Array.isArray(chunk)
                ? chunk.join('')
                : '';
        if (!piece) {
          continue;
        }
        aggregated += piece;
        onStatus?.(aggregated.trim(), { isPending: true });
      }

      const finalText = aggregated.trim();
      if (finalText) {
        onStatus?.(finalText, { isPending: false });
        return finalText;
      }
      return null;
    } catch (error) {
      console.warn('[Priority AI] Streaming summarization failed, falling back to batch mode.', error);
      return null;
    }
  };

  let text = await tryStreamingSummary();
  if (!text) {
    const summary = await summarizer.summarize(snippet, summarizeOptions);

    if (typeof summary === 'string') {
      text = summary.trim();
    } else if (summary && typeof summary === 'object') {
      const maybeText = summary.summary || summary.text || summary.result;
      text = typeof maybeText === 'string' ? maybeText.trim() : JSON.stringify(summary);
    }
  }

  if (!text || !text.trim()) {
    throw new Error('Summarizer returned an empty response. Please try again.');
  }

  text = text.trim();

  console.log('[Priority AI] Summarizer response', { kind, textPreview: text.slice(0, 120) });
  return text;
};
