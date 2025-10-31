// page.js – updated for Prompt API
let session = null;
let downloading = false;
let apiMode = null; // 'prompt-api' | 'language-model'

function mapError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  if (message.includes('user activation') || message.includes('gesture')) return 'needs-gesture';
  if (message.includes('download') || message.includes('model loading') || message.includes('model unavailable')) return 'after-download';
  if (message.includes('not supported') || message.includes('no model')) return 'unavailable';
  if (message.includes('quota') || message.includes('token')) return 'quota-exceeded';
  return 'error';
}

async function ensureModel(opts = {}) {
  if (session) {
    return { ok: true, apiMode };
  }

  // Try Prompt API first
  if (globalThis.LanguageModel?.create) {
    apiMode = 'prompt-api';
    
    const options = {
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }]
    };

    // Check availability first
    const availability = await LanguageModel.availability(options);
    
    if (availability === "unavailable") {
      return { ok: false, why: 'unavailable' };
    }
    
    if (availability === "downloadable" || availability === "downloading") {
      if (!opts.userGesture) return { ok: false, why: 'after-download' };
      
      if (!downloading) {
        downloading = true;
        try {
          // Create with download monitoring
          session = await LanguageModel.create({
            ...options,
            monitor(monitor) {
              monitor.addEventListener("downloadprogress", e => {
                console.log(`Download progress: ${(e.loaded * 100).toFixed(1)}%`);
              });
            }
          });
          downloading = false;
          return { ok: true };
        } catch (err) {
          downloading = false;
          return { ok: false, why: mapError(err), error: String(err?.message || err) };
        }
      }
      return { ok: false, why: 'downloading' };
    }
    
    // Available case
    try {
      session = await LanguageModel.create(options);
      return { ok: true };
    } catch (err) {
      return { ok: false, why: mapError(err), error: String(err?.message || err) };
    }
  }

  // Fallback to older LanguageModel API if available
  if (globalThis.LanguageModel?.create) {
    apiMode = 'language-model';
    try {
      session = await globalThis.LanguageModel.create(['en']);
      return { ok: true };
    } catch (err) {
      return { ok: false, why: mapError(err), error: String(err?.message || err) };
    }
  }

  return { ok: false, why: 'no_api' };
}

function extractJson(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildPrompt(meta) {
  const safe = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  
  return [
    {
      role: "system",
      content: `You are a Gmail prioritization assistant. Decide how quickly the user should read an email.
Interpretations:
- "Urgent": time-sensitive, deadlines, escalations, money/security issues.
- "Action": needs follow up or decision soon but not critical.
- "FYI": informational yet useful.
- "Low": bulk, promotion, optional reading.`
    },
    {
      role: "user",
      content: `Subject: ${safe(meta.subject) || '(empty)'}
Snippet: ${safe(meta.snippet) || '(empty)'}
Sender: ${safe(meta.sender) || '(unknown)'}

Return ONLY JSON matching {"level":"Urgent|Action|FYI|Low","reason":"<max 90 chars>"}`
    }
  ];
}

async function classify(meta) {
  const ok = await ensureModel();
  if (!ok.ok) return { fallback: true, why: ok.why };
  
  const messages = buildPrompt(meta);
  
  try {
    // Use structured output constraint for better JSON response
    const schema = {
      type: "object",
      required: ["level", "reason"],
      additionalProperties: false,
      properties: {
        level: {
          type: "string",
          enum: ["Urgent", "Action", "FYI", "Low"]
        },
        reason: {
          type: "string",
          maxLength: 90
        }
      }
    };
    
    const response = await session.prompt(messages, {
      responseConstraint: schema,
      omitResponseConstraintInput: true
    });
    
    const out = extractJson(response);
    if (!out?.level) throw new Error('missing level');
    
    return { fallback: false, out };
  } catch (err) {
    // Fallback to simple prompt without constraints
    try {
      const simplePrompt = `Based on this email:
Subject: ${meta.subject || '(empty)'}
Snippet: ${meta.snippet || '(empty)'}
Sender: ${meta.sender || '(unknown)'}

Classify as Urgent, Action, FYI, or Low and provide a short reason. Return ONLY JSON: {"level":"...","reason":"..."}`;
      
      const response = await session.prompt(simplePrompt);
      const out = extractJson(response);
      if (!out?.level) throw new Error('missing level');
      
      return { fallback: false, out };
    } catch (fallbackErr) {
      return { fallback: true, why: mapError(fallbackErr) };
    }
  }
}

// Session management
function destroySession() {
  if (session) {
    session.destroy();
    session = null;
  }
}

// Listen for requests from the content script
window.addEventListener('message', async (ev) => {
  const msg = ev.data;
  if (!msg || msg.source !== 'GPA_CONTENT') return;
  
  if (msg.type === 'CLASSIFY') {
    const ans = await classify(msg.meta);
    window.postMessage({ source: 'GPA_PAGE', type: 'CLASSIFY_RESULT', id: msg.id, ...ans }, '*');
  } else if (msg.type === 'ENABLE_AI') {
    const userGesture = msg.reason !== 'auto-check';
    const ok = await ensureModel({ userGesture });
    window.postMessage({ source: 'GPA_PAGE', type: 'ENABLE_RESULT', ok }, '*');
  } else if (msg.type === 'CLEANUP') {
    destroySession();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', destroySession);