# ⚡ Happy Error? — Built-in AI Semantic Triage

A lightweight, zero-build JavaScript web app built for live presentations to demonstrate how on-device AI (**Chrome Built-in AI / Prompt API**) can solve hard UX problems where traditional error handling fails.

---

## 🎯 The Talk Story & UX Narrative

### The Problem: Deceptive Success (Semantic Failures)
Traditional frontend error handlers rely on HTTP status codes or status flags. But real-world APIs and services frequently return payload responses that look like successes at a glance (e.g. `Submission received!`) while secretly describing a catastrophic failure, quota exhaustion, or complex human recovery requirement.

### The Solution: Zero-Latency Local Semantic Triage
Using Chrome's native **Gemini Nano Prompt API**, the client can:
1. **Detect semantic deception**: Classify whether a message is genuinely successful, a deceptive failure, or a partial warning.
2. **Stream raw tokens in real-time**: Show developers how on-device LLMs reason directly on the client with zero cloud latency.
3. **Synthesize actionable UX journeys**: Extract structured action widgets (click-to-call phone numbers, 1-click copyable CLI commands, documentation links, and remediation steps) into a clear visual result card.

---

## 🚀 How to Run Locally (Quick Web Server Reminders)

Because this project uses native ES Modules (`import`/`export`), it must be served over `http://` or `localhost` (browsers block module imports over `file://` URLs). There are **zero build steps** and no dependencies to install.

Pick any of these one-liners from the `happy-error` directory:

```bash
cd happy-error

# Option 1: Python 3 (Most Common)
python3 -m http.server 8000

# Option 2: Node / npx (serve or http-server)
npx serve .
# or: npx http-server -p 8000

# Option 3: PHP built-in server
php -S localhost:8000

# Option 4: Ruby built-in server
ruby -run -ehttpd . -p8000
```

Then open **`http://localhost:8000`** in **Chrome Canary / Dev**.

---

## 🛠️ Enabling Chrome Built-in AI (Prompt API)

In recent builds of Chrome Canary and Dev, the flag structure was streamlined:

1. **Enable Prompt API in `chrome://flags`**:
   - Search for **`#prompt-api-for-gemini-nano`** and set it to **Enabled**.
2. **Optimization Guide Flag** (if present in your build):
   - Search for **`optimization guide`** in `chrome://flags`.
   - If `#optimization-guide-on-device-model` is present, set it to **Enabled BypassPerfRequirement**. *(If this flag is not in your Canary build, Chrome enables the runtime automatically when Prompt API is turned on).*
3. **Relaunch Chrome**.
4. **Trigger / Verify Model Download**:
   - Go to `chrome://components` and look for **Optimization Guide On Device Model**. Click **"Check for update"** if it shows version `0.0.0.0` or needs downloading.
   - Alternatively, open DevTools (`Option + ⌘ + J` on Mac) and run:
     ```javascript
     await (window.ai?.languageModel || ai.languageModel)?.availability();
     ```
     *(Returns `"readily"`, `"after-download"`, or `"downloadable"`)*.

---

## 🧪 Included Scenarios

- **🎭 Deceptive 200 (The Hero Example)**:
  > *"Submission received and accepted! Note: Background indexing could not start due to exceeded organization quota. Please call support at 1-800-555-0199 or run `npx sync-tool --force-renew` to increase limits."*
  - **Outcome**: Triggers 🔴 **DECEPTIVE SUCCESS DETECTED** banner, extracts 📞 `1-800-555-0199` click-to-call, and generates a 💻 `npx sync-tool --force-renew` copyable command card.

- **🟢 Clean Success**:
  > *"Your workspace migration is complete! All 12 project boards and 340 assets were transferred successfully to the new cluster."*
  - **Outcome**: Triggers 🟢 **SUCCESS** outcome card.

- **⚠️ Partial Warning**:
  > *"Batch sync complete: 1,420 contacts imported, but 3 records had invalid emails and were skipped. You can review the error log at https://workspace.internal/sync/batch-992."*
  - **Outcome**: Triggers ⚠️ **PARTIAL / WARNING** outcome card with 🔗 direct log link widget.

---

## 📂 File Architecture

```text
happy-error/
├── index.html       # Slide-friendly presentation layout & inspector UI
├── style.css        # Modern high-contrast dark theme with neon semantic badges
├── app.js           # Main controller, event wiring, and dynamic widget renderer
├── ai-service.js    # Chrome Prompt API wrapper, lifecycle management & streaming
├── scenarios.js     # Curated preset payloads for stage demos
└── README.md        # Documentation and presentation notes
```
