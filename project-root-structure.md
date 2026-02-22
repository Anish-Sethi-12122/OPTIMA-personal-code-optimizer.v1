# OPTIMA — Project Root Structure

```
OPTIMA-personal-code-optimizer.v2-main/
│
├── index.html                          # App entry point
├── package.json                        # Dependencies & scripts
├── package-lock.json                   # Lockfile
├── tsconfig.json                       # TypeScript config
├── tsconfig.tsbuildinfo                # TS build cache
├── vite.config.ts                      # Vite bundler config
├── vercel.json                         # Vercel deployment config
├── .gitignore                          # Git ignore rules
├── README.md                           # Project documentation
├── optima_architecture_and_demo.md     # Architecture & demo notes
├── optima_v2_architecture.md           # V2 architecture design
│
├── src/                                # Source code
│   ├── main.tsx                        # React entry point
│   ├── App.tsx                         # Root app component
│   ├── ErrorBoundary.tsx               # Global error boundary
│   ├── runanywhere.ts                  # RunAnywhere SDK setup
│   ├── vite-env.d.ts                   # Vite type declarations
│   │
│   ├── components/                     # UI components
│   │   ├── CodeOptimizerTab.tsx        # Main optimizer UI
│   │   ├── ExplainPanel.tsx            # Optimization explanation panel
│   │   ├── DiffViewer.tsx              # Before/after code diff
│   │   ├── ModelStatusBar.tsx          # Model loading status bar
│   │   ├── PipelineIndicator.tsx       # Pipeline stage indicator
│   │   ├── ChatTab.tsx                 # Chat tab (placeholder)
│   │   ├── VisionTab.tsx              # Vision tab (placeholder)
│   │   ├── VoiceTab.tsx               # Voice tab (placeholder)
│   │   ├── FloatingChatAgent.tsx       # Floating chat (placeholder)
│   │   └── ModelBanner.tsx             # Model banner (placeholder)
│   │
│   ├── lib/                            # Core logic
│   │   ├── staticAnalyzer.ts           # Deterministic code analysis
│   │   ├── promptBuilder.ts            # LLM prompt construction & normalization
│   │   └── codeDiff.ts                 # Code diff utilities
│   │
│   ├── hooks/                          # React hooks
│   │   └── useModelLoader.ts           # Model loading state hook
│   │
│   ├── styles/                         # Stylesheets
│   │   └── index.css                   # Global styles
│   │
│   └── workers/                        # Web Workers
│       ├── optimizer.worker.ts         # Optimization pipeline worker
│       └── vlm-worker.ts              # Vision model worker (placeholder)
│
├── tests/                              # Test documentation
│   ├── web-starter-app-bugs.md         # Known bugs
│   └── web-starter-app-test-suite.md   # Test suite documentation
│
└── dist/                               # Production build output
    ├── index.html
    └── assets/                         # Bundled JS, CSS, WASM
```
