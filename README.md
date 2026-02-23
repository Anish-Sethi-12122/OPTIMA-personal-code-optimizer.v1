# OPTIMA - Personal Code Optimizer

OPTIMA is an on-device code optimizer built with React + TypeScript + RunAnywhere SDK (LiquidAI LFM2-350M GGUF via LlamaCPP). All inference runs locally in the browser.

## What Is Implemented

- Worker-first optimization pipeline (`src/workers/optimizer.worker.ts`) so the UI stays responsive.
- Static analysis + prompt construction + LLM inference + normalization.
- Minimal prompt contract for small-model reliability:
  - `Fix ONE inefficiency in this code. Return only the changed lines.`
- Single inference call per optimization request (no retry path).
- Fast generation config for CPU inference:
  - `max_new_tokens: 50`
  - `temperature: 0.2`
- Hard timeout with cancellation:
  - `INFERENCE_TIMEOUT_MS: 10000`
  - timeout actively calls generation cancel before returning error
- Output trimming to enforce short responses (<= 50 token-like chunks).
- Premium processing UX:
  - staged pipeline (`Understanding Code` -> `Optimizing` -> `Finalizing Output`)

## Core Flow

1. User submits code from `CodeOptimizerTab`.
2. `optimizer.worker.ts` runs static analysis and builds a minimal prompt.
3. LLM call runs once with `max_new_tokens: 50`, `temperature: 0.2`, and a 10s timeout.
4. Timeout path cancels generation cleanly and returns an error.
5. Worker normalizes the returned code-like text and sends final result.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run build
```

If your PowerShell execution policy blocks `npm.ps1`, run with:

```bash
cmd /c npm run build
```

## Notes

- First load downloads/caches model files in browser storage.
- If parsing fails, OPTIMA returns a safe fallback (original code) with parse warning metadata instead of crashing.
- Explain/Diff tabs are driven by normalized `OptimizationResult`, not raw LLM text.

## Key Files

- `src/components/CodeOptimizerTab.tsx`: input/output UX, loading stages, dynamic messaging, simulated reveal.
- `src/workers/optimizer.worker.ts`: end-to-end optimization pipeline, single-call inference, timeout cancellation.
- `src/lib/promptBuilder.ts`: minimal prompt builder and output normalization.
- `src/lib/staticAnalyzer.ts`: deterministic pattern analysis and chunk planning.
- `src/lib/codeDiff.ts`: diff utilities for result visualization.
