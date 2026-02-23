# OPTIMA - Architecture and Demo Guide (Current)

## 1. System Architecture

OPTIMA is a client-only edge AI app. The main thread handles UI while heavy optimization logic runs in a dedicated worker.

### Runtime Split

- Main Thread
  - React rendering and user interactions.
  - Status display, stage transitions, diff/explain tabs.
  - Simulated code reveal after parsed result is available.
- Worker Thread (`src/workers/optimizer.worker.ts`)
  - Static analysis (`analyzeCode`).
  - Minimal prompt generation (`buildPrompt` / `buildStructuredPrompt`).
  - LLM inference (`TextGeneration.generateStream`).
  - Timeout-aware cancellation with a single inference call.
  - Output normalization + fallback parsing.

## 2. Prompt and Output Contract

Prompt is intentionally minimal for a 350M CPU model:

`Fix ONE inefficiency in this code. Return only the changed lines.`

Generation settings are fixed:

- `max_new_tokens: 50`
- `temperature: 0.2`
- hard timeout: `10000ms`
- timeout path cancels generation cleanly
- response is trimmed to <= 50 token-like chunks

## 3. Robust Parsing Strategy

Normalization layer is defensive:

1. Strip markdown wrappers/preambles when present.
2. Extract code-like text.
3. Enrich with static-analysis metadata.
4. If extraction fails, return safe fallback using original code + warning metadata.

This prevents hard failures when model output is noisy.

## 4. Processing UX

`CodeOptimizerTab` keeps the user engaged during 10-30s runs:

- Stage timeline (`Understanding Code`, `Optimizing`, `Finalizing Output`).

## 5. Demo Walkthrough for CTO Panel

1. Load app and confirm local model init.
2. Paste non-trivial code with clear inefficiencies.
3. Run optimization and call out stage progression.
4. Show final optimized code, then Diff tab, then Explain tab.
5. If model output is malformed, show that app still returns stable fallback output.

## 6. Risk Controls

- 10s hard timeout per LLM call.
- Timeout actively cancels in-flight generation.
- No retry loop (single deterministic inference call).
- Safe fallback path when parsing fails.
- Worker isolation to avoid UI freeze.
