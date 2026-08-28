/**
 * Chrome Built-in AI (Prompt API) Service
 * Manages capability detection, session lifecycle, streaming prompt execution,
 * and structured JSON sanitization.
 */

export class AIService {
  constructor() {}

  /**
   * Dynamically resolve the active Chrome Prompt API reference across different spec iterations.
   */
  getApi() {
    return (
      window.ai?.languageModel || 
      globalThis.ai?.languageModel || 
      window.LanguageModel || 
      globalThis.LanguageModel ||
      window.ai
    );
  }

  /**
   * Check if Chrome Prompt API is available and its current readiness state.
   * @returns {Promise<{status: 'ready' | 'downloadable' | 'unsupported', rawStatus: string, details?: any}>}
   */
  async checkCapabilities() {
    const api = this.getApi();
    if (!api) {
      return {
        status: 'unsupported',
        rawStatus: 'missing_api',
        message: 'Chrome Prompt API not detected. Enable flags in Chrome Canary/Dev.'
      };
    }

    try {
      if (typeof api.availability === 'function') {
        const availability = await api.availability();
        const raw = String(availability).toLowerCase();
        if (raw === 'readily' || raw === 'available' || raw === 'ready') {
          return { status: 'ready', rawStatus: raw, message: 'Model is downloaded and ready.' };
        } else if (raw === 'after-download' || raw === 'downloadable' || raw === 'downloading') {
          return { status: 'downloadable', rawStatus: raw, message: 'Model will download on first use.' };
        } else if (raw === 'no' || raw === 'unavailable') {
          return { status: 'unsupported', rawStatus: raw, message: 'Model unavailable on this device.' };
        }
      }

      if (typeof api.capabilities === 'function') {
        const capabilities = await api.capabilities();
        const available = capabilities.available;
        const raw = String(available).toLowerCase();
        if (raw === 'readily' || raw === 'available' || raw === 'ready' || raw === 'readily_available' || available === true) {
          return { status: 'ready', rawStatus: raw, message: 'Model is ready.', capabilities };
        } else if (raw === 'after-download' || raw === 'after_download' || raw === 'downloadable' || raw === 'downloading') {
          return { status: 'downloadable', rawStatus: raw, message: 'Model ready to download.', capabilities };
        } else if (raw === 'no' || raw === 'unavailable' || available === false) {
          return { status: 'unsupported', rawStatus: raw, message: 'Model unavailable.', capabilities };
        }
      }

      if (typeof api.create === 'function' || typeof api.createTextSession === 'function') {
        return { status: 'ready', rawStatus: 'create_available', message: 'Model is ready.' };
      }

      return { status: 'ready', rawStatus: 'assumed_ready', message: 'API present.' };
    } catch (err) {
      console.warn('Capability check exception, falling back to create check:', err);
      if (typeof api.create === 'function' || typeof api.createTextSession === 'function') {
        return { status: 'ready', rawStatus: 'create_available', message: 'Model is ready.' };
      }
      return { status: 'unsupported', rawStatus: 'error', message: err.message };
    }
  }

  /**
   * Run semantic analysis on a text snippet with streaming tokens.
   * Creates a fresh isolated session per call and destroys it on completion.
   * 
   * @param {string} text - Message snippet to analyze
   * @param {Object} options
   * @param {(chunk: string) => void} options.onToken - Called as tokens stream in
   * @param {(percent: number, loaded: number, total: number) => void} options.onDownloadProgress - Download progress callback
   * @returns {Promise<{raw: string, parsed: Object}>}
   */
  async analyzeMessage(text, { onToken, onDownloadProgress } = {}) {
    const api = this.getApi();
    if (!api) {
      throw new Error('Chrome Prompt API is not available in this browser environment.');
    }

    const systemPrompt = `You are a semantic error classifier. Analyze messages and return strictly valid JSON. Detect deceptive successes where an API says 'success' or 'accepted' but actually failed.`;

    const formattedPrompt = `You must analyze the input message and respond ONLY with a multi-line JSON object.

Example 1:
Input: "Workspace migration complete. 12 boards transferred successfully."
Output:
{
  "status": "success",
  "isDeceptive": false,
  "headline": "Migration Completed",
  "explanation": "All items transferred with zero errors.",
  "actions": []
}

Example 2:
Input: "Submission received! Note: Processing failed due to exceeded quota. Call 1-800-555-0199 or run npx renew."
Output:
{
  "status": "error",
  "isDeceptive": true,
  "headline": "Quota Exceeded (Deceptive Success)",
  "explanation": "The request was accepted but processing failed due to an exceeded organization quota.",
  "actions": [
    {
      "type": "phone",
      "label": "Call Support",
      "target": "1-800-555-0199"
    },
    {
      "type": "command",
      "label": "Run Renew CLI",
      "target": "npx renew"
    }
  ]
}

Example 3:
Input: "Batch import finished: 1,400 imported, 3 failed validation. See https://logs.internal/99."
Output:
{
  "status": "warning",
  "isDeceptive": false,
  "headline": "Batch Import Partial Success",
  "explanation": "Import finished with 3 validation failures.",
  "actions": [
    {
      "type": "url",
      "label": "View Error Log",
      "target": "https://logs.internal/99"
    }
  ]
}

Analyze this input and output the JSON object:
Input: "${text.replace(/"/g, '\\"')}"
Output:
`;

    let session = null;
    try {
      const createOptions = {
        systemPrompt,
        temperature: 0.1,
        topK: 1
      };

      if (onDownloadProgress) {
        createOptions.monitor = (m) => {
          m.addEventListener('downloadprogress', (e) => {
            const pct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
            onDownloadProgress(pct, e.loaded, e.total);
          });
        };
      }

      session = typeof api.create === 'function' 
        ? await api.create(createOptions) 
        : await api.createTextSession(createOptions);

      const startTime = performance.now();
      let fullOutput = '';
      const stream = session.promptStreaming(formattedPrompt);

      for await (const chunk of stream) {
        // In Chrome Prompt API, chunk is cumulative text emitted so far
        fullOutput = chunk;
        if (onToken) {
          onToken(fullOutput);
        }
      }

      const latencyMs = Math.round(performance.now() - startTime);
      const parsed = this.parseCleanJson(fullOutput, text);
      return { raw: fullOutput, parsed, prompt: formattedPrompt, latencyMs };
    } finally {
      if (session) {
        try {
          session.destroy();
        } catch (e) {
          console.warn('Error destroying session:', e);
        }
      }
    }
  }

  /**
   * Resiliently parses or extracts structured outcome data from LLM text.
   */
  parseCleanJson(rawText, originalInput = '') {
    let clean = (rawText || '').trim();

    // 1. Strip markdown fences if present
    if (clean.includes('```json')) {
      clean = clean.replace(/[\s\S]*?```json\s*/i, '').replace(/\s*```[\s\S]*/, '');
    } else if (clean.includes('```')) {
      clean = clean.replace(/[\s\S]*?```\s*/, '').replace(/\s*```[\s\S]*/, '');
    }

    clean = clean.trim();

    // 2. Direct JSON Parse attempt
    try {
      return JSON.parse(clean);
    } catch (e) {
      // Continue to next heuristic
    }

    // 3. Slice between outermost curly braces
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sliced = clean.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced);
      } catch (e) {
        // Continue
      }
    }

    // 4. Heuristic Fallback: Extract from markdown/plain-text formatting if Nano emitted text
    return this.extractFromText(rawText, originalInput);
  }

  /**
   * Fallback parser if the model emitted markdown bullet points or text instead of strict JSON.
   */
  extractFromText(text, originalInput) {
    const lower = (text + ' ' + originalInput).toLowerCase();
    
    // Status detection
    let status = 'success';
    let isDeceptive = false;

    const hasFail = lower.includes('fail') || lower.includes('error') || lower.includes('quota') || lower.includes('exceeded') || lower.includes('fatal');
    const hasSuccessWord = lower.includes('success') || lower.includes('received') || lower.includes('accepted') || lower.includes('complete');

    if (hasFail && hasSuccessWord) {
      status = 'error';
      isDeceptive = true;
    } else if (hasFail) {
      status = 'error';
    } else if (lower.includes('warn') || lower.includes('skip') || lower.includes('partial')) {
      status = 'warning';
    }

    // Extract potential actions: phone numbers, URLs, commands
    const actions = [];

    // Phone numbers (e.g. 1-800-555-0199 or 123-456-7890)
    const phoneMatch = originalInput.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      actions.push({
        type: 'phone',
        label: 'Call Support',
        target: phoneMatch[0]
      });
    }

    // URLs
    const urlMatch = originalInput.match(/https?:\/\/[^\s"'<>]+/);
    if (urlMatch) {
      actions.push({
        type: 'url',
        label: 'Open Remediation Link',
        target: urlMatch[0]
      });
    }

    // Commands (backticked text or npx/cli commands)
    const cmdMatch = originalInput.match(/`([^`]+)`/) || originalInput.match(/(?:run|execute)\s+(npx\s+[^\s]+|[\w-]+\s+--[^\s]+)/i);
    if (cmdMatch) {
      actions.push({
        type: 'command',
        label: 'Run Command',
        target: cmdMatch[1] || cmdMatch[0]
      });
    }

    const cleanSummary = text.replace(/[*#`]/g, '').trim();

    return {
      status,
      isDeceptive,
      headline: isDeceptive ? 'Deceptive Failure Detected' : (status === 'error' ? 'Operation Failed' : (status === 'warning' ? 'Partial Success' : 'Operation Successful')),
      explanation: cleanSummary.length > 10 ? cleanSummary : originalInput,
      actions
    };
  }
}
