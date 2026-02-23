# OPTIMA - Project Root Structure

```text
OPTIMA-personal-code-optimizer.v1/
|-- index.html
|-- package.json
|-- package-lock.json
|-- tsconfig.json
|-- vite.config.ts
|-- vercel.json
|-- README.md
|-- optima_architecture_and_demo.md
|-- optima_v2_architecture.md
|-- project-root-structure.md
|-- src/
|   |-- main.tsx
|   |-- App.tsx
|   |-- ErrorBoundary.tsx
|   |-- runanywhere.ts
|   |-- vite-env.d.ts
|   |-- components/
|   |   |-- CodeOptimizerTab.tsx
|   |   |-- ExplainPanel.tsx
|   |   |-- DiffViewer.tsx
|   |   |-- ModelStatusBar.tsx
|   |   |-- PipelineIndicator.tsx
|   |   |-- ChatTab.tsx
|   |   |-- VisionTab.tsx
|   |   |-- VoiceTab.tsx
|   |   |-- FloatingChatAgent.tsx
|   |   `-- ModelBanner.tsx
|   |-- hooks/
|   |   `-- useModelLoader.ts
|   |-- lib/
|   |   |-- staticAnalyzer.ts
|   |   |-- promptBuilder.ts
|   |   `-- codeDiff.ts
|   |-- workers/
|   |   |-- optimizer.worker.ts
|   |   `-- vlm-worker.ts
|   `-- styles/
|       `-- index.css
|-- tests/
|   |-- web-starter-app-bugs.md
|   `-- web-starter-app-test-suite.md
`-- node_modules/
```

## File Responsibilities

- `src/workers/optimizer.worker.ts`: model lifecycle, LLM calls, dirty JSON extraction, retry, final result emission.
- `src/lib/promptBuilder.ts`: strict 4-key prompt contract + robust normalization and salvage logic.
- `src/components/CodeOptimizerTab.tsx`: optimization UX, stage rendering, rotating loading messages, code/diff/explain presentation.
- `src/lib/staticAnalyzer.ts`: deterministic analysis and chunk guidance.
