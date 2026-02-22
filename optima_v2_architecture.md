# OPTIMA - Full Architecture Redesign & Polish Plan

This document outlines the systematic redesign of the OPTIMA AI Engine into a highly polished, entirely non-blocking, production-ready developer tool, answering all 9 core requirements.

---

## 1. Full Architecture Redesign

The major flaw in the initial iteration was executing AST regex processing (`staticAnalyzer.ts`) and LLM inference synchronously on the main thread, causing complete UI lockups.

### New Architecture: Dedicated Worker Pipeline
- **Main Thread (UI/DOM)**:
  - React, CSS animations, and `CodeOptimizerTab` state.
  - Displays LOC/Chars counters instantly on the `onChange` event (via a debounce).
  - Listens to incoming messages from the worker thread (`postMessage`) and orchestrates the stage animations inside the Output Panel (`Understanding Code` -> `Analyzing Inefficiencies` -> `Optimizing` -> `Finalizing Code`).
- **Worker Thread (`optimizer.worker.ts`)**:
  - Contains the *entire* computational load.
  - Runs `analyzeCode` (static analysis, chunking).
  - Runs `promptBuilder`.
  - Interfaces natively with the `RunAnywhere` SDK via `LlamaCPP` and loops through chunks.
  - Streams intermediate outputs and pipeline stage updates back to the UI.
  - Executes `parseResult` on the final output to ensure the heavy JSON extraction occurs off the main thread.

---

## 2. Worker Implementation Plan

Create `src/workers/optimizer.worker.ts`:
1. **Initialize RunAnywhere in Worker**: Register `LlamaCPP` backend. Wait for models to be loaded by the Main Thread (since `ModelManager` handles fetching/caching over IndexedDB).
2. **Message Protocol**:
   - `START_OPTIMIZATION`: Payload `{ code, language, focus }`.
   - `STAGE_UPDATE`: Payload `Understanding Code` | `Analyzing Inefficiencies` | `Optimizing`.
   - `STREAM_TOKEN`: Streams raw JSON strings to memory, but only emits code string diffs (once the JSON hits the `"optimized_code":"` boundary) if possible, or just buffers until done to simulate the UX.
   - `OPTIMIZATION_DONE`: Payload `{ parsedResult: OptimizationResult }`.

*Note on Streaming*: Because the LLM forces a JSON wrapper, raw streaming to the code preview is messy (users see `{"detected_...`). The optimal UX is to buffer the generation invisibly under the "Optimizing..." state, and *then* artificially stream out the clean, structured final code and explanations on the UI thread to provide the "typing" dopamine hit without breaking the JSON schema context.

---

## 3. Streaming UI Implementation

1. **Output Panel Overhaul**: 
   - Remove the `PipelineIndicator.tsx` from the top header entirely.
   - When the user clicks "Optimize", the right-side Output workspace takes over.
   - Add a subtle glowing spinner and sequential text:
     - `Understanding Code...` (triggered by static analysis start)
     - `Analyzing Inefficiencies...` (triggered by chunk processing start)
     - `Optimizing...` (LLM generation phase)
     - `Finalizing Code...` (JSON parsing phase)
2. **Simulated Generation**:
   - Once the worker returns `OPTIMIZATION_DONE`, we initiate a `useEffect` loop in `CodeOptimizerTab` that slices the `optimized_code` string and pushes it to the generic `<pre>` viewer character-by-character (e.g., 20 chars per 10ms frame).
   - A blinking cursor `▍` is appended to the end of the streaming string.
   - After the code finishes streaming, the Diff and Explain tabs fade in sequentially.

---

## 4. GPU Toggle Validation Logic

- **Current Flaw**: The toggle is manually changing a React state variable but not re-instantiating the Llama.cpp backend with different flags. It's essentially fake.
- **The Fix**: 
  - `runanywhere.ts` uses an event listener `llamacpp.wasmLoaded` to read `evt.accelerationMode`. We will expose this true capability via `getAccelerationMode()`.
  - The UI will *remove* the manual CPU/WebGPU toggle.
  - Instead, the header will display an elegant, read-only hardware pill: `"⚡ WebGPU Active"` (if detected) or `"💻 CPU Runtime"` (if fallback). Tooltips will explain *why* (e.g., "WebGPU acceleration is automatically utilized for up to 10x faster inference").
- **Model Name Removal**: 
  - Change "LFM2-350M" textual references throughout to: `"Powered by On-Device AI"`.

---

## 5. UI Redesign Suggestions & Polish

- **Input Panel**:
  - Add `[ LOC: {lines} | Chars: {charCount} ]` subtle counters to the bottom-right of the textarea.
- **Explanation Integration**:
  - The Explain Panel shouldn't feel like a static report dumped at the end. After the "Finalizing Code..." streaming finishes, the 4 semantic cards will `stagger flex` into view one-by-one (0.1s delay each).
  - The JSON schema forces the LLM to directly link the `detected_algorithm` to the `bottleneck` and explicitly state *why* it fails at scale.
- **Typography & Hierarchy**:
  - Deepen the `index.css` Glassmorphism implementation. 
  - Tone down borders, increase shadow sizing for depth.
  - Button state transitions will use `cubic-bezier(0.4, 0, 0.2, 1)` for a snappy, premium feel. 

---

## 6. Prompt Design Refinement (JSON Stricture)

The prompt enforces a completely deterministic output schema using metadata injected directly from the Static Analyzer (e.g., `O(n^2)` nesting heuristic) so the LLM doesn't have to guess runtime contexts.

```text
You are an expert {language} performance engineer.
CONTEXT: Lines: {N}, Functions: {N}, Loop Depth: {N}, Detected Algo: {algo}, Heuristic Complexity: {heuristic}

RULES:
- Return ONLY valid JSON data
- Explain WHY original fails at scale in 'explanation', and WHY new approach is asymptotically better
- 'estimated_improvement' must be a percentage bracket
- 'confidence_score' must be 0-100%

OUTPUT SCHEMA:
{
  "detected_algorithm": "...",
  "time_complexity_before": "...",
  "time_complexity_after": "...",
  "bottleneck": "...",
  "optimization_strategy": "...",
  "estimated_improvement": "...",
  "confidence_score": "...",
  "optimized_code": "...",
  "explanation": "...",
  "tradeoffs": "..."
}
```
