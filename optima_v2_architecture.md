# OPTIMA v2 Architecture (As Implemented)

This document describes the current architecture implemented in the repository.

## 1. Worker-Centric Pipeline

`src/workers/optimizer.worker.ts` owns the optimization lifecycle:

- `INIT`: SDK/model initialization.
- `START_OPTIMIZATION`: run static analysis, build one minimal prompt, perform one inference call, normalize result.
- `CANCEL_OPTIMIZATION`: cancel active generation.

Pipeline stages emitted to UI:

- `Understanding Code`
- `Optimizing`
- `Finalizing Output`

## 2. LLM Call Configuration

Generation call is intentionally small for LFM2-350M CPU reliability:

- `max_new_tokens: 50`
- `temperature: 0.2`
- timeout guard: `10000ms`
- timeout triggers active cancellation of the in-flight generation
- response is trimmed to <= 50 token-like chunks before normalization

## 3. Minimal Prompt Contract

Prompt builder (`src/lib/promptBuilder.ts`) uses a single minimal instruction:

`Fix ONE inefficiency in this code. Return only the changed lines.`

No JSON output contract is used.

## 4. Output Normalization

Normalization extracts code-like text, strips wrapper artifacts if present, enriches with static-analysis metadata, and falls back safely if extraction fails.

## 5. UX Behavior

`src/components/CodeOptimizerTab.tsx` behavior:

- Shows processing stages.

## 6. Why This Architecture

This design keeps the app fast and reliable on a 350M CPU model:

- minimizes model cognitive load,
- bounds output size and runtime,
- cancels cleanly on timeout,
- keeps worker flow deterministic with one inference call.
