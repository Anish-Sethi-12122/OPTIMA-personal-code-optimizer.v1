import { analyzeCode } from '../lib/staticAnalyzer';
import { buildPrompt, normalizeLLMOutput } from '../lib/promptBuilder';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import type { OptimizationFocus } from '../lib/promptBuilder';

const INFERENCE_TIMEOUT_MS = 10_000;
const MAX_NEW_TOKENS = 50;
const TEMPERATURE = 0.2;

let modelLoaded = false;
let cancelCurrent: (() => void) | null = null;

class InferenceTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`LLM timed out after ${Math.round(timeoutMs / 1000)}s`);
        this.name = 'InferenceTimeoutError';
    }
}

async function workerInitSDK() {
    const {
        RunAnywhere,
        SDKEnvironment,
        ModelManager,
        ModelCategory,
        LLMFramework,
        EventBus,
    } = await import('@runanywhere/web');

    const { LlamaCPP } = await import('@runanywhere/web-llamacpp');

    await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
    await LlamaCPP.register();

    EventBus.shared.on('llamacpp.wasmLoaded', (evt: any) => {
        self.postMessage({ type: 'accelerationMode', value: evt.accelerationMode ?? 'cpu' });
    });

    RunAnywhere.registerModels([
        {
            id: 'lfm2-350m-q4_k_m',
            name: 'LFM2 350M Q4_K_M',
            repo: 'LiquidAI/LFM2-350M-GGUF',
            files: ['LFM2-350M-Q4_K_M.gguf'],
            framework: LLMFramework.LlamaCpp,
            modality: ModelCategory.Language,
            memoryRequirement: 250_000_000,
        } as any,
    ]);

    const model = ModelManager.getModels().find((m: any) => m.modality === ModelCategory.Language);
    if (!model) {
        throw new Error('No language model registered in worker');
    }

    const status = String(model.status).toLowerCase();
    if (status !== 'downloaded' && status !== 'loaded') {
        self.postMessage({ type: 'status', value: 'initializing' });
        const unsub = EventBus.shared.on('model.downloadProgress', (evt: any) => {
            if (evt.modelId === model.id) {
                self.postMessage({ type: 'progress', value: evt.progress ?? 0 });
            }
        });

        try {
            await ModelManager.downloadModel(model.id);
            self.postMessage({ type: 'progress', value: 1 });
        } finally {
            unsub();
        }
    }

    self.postMessage({ type: 'status', value: 'loading_model' });

    const loadedModel = ModelManager.getLoadedModel(ModelCategory.Language);
    if (!loadedModel || loadedModel.id !== model.id) {
        if (loadedModel) {
            ModelManager.unloadModel(loadedModel.id);
            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        const ok = await ModelManager.loadModel(model.id, { coexist: false });
        if (!ok) {
            throw new Error('Model loading failed');
        }
    }
}

async function runLLMCall(prompt: string): Promise<string> {
    let output = '';
    let firstTokenSent = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let localCancel: (() => void) | null = null;

    try {
        const { stream, result, cancel } = await TextGeneration.generateStream(prompt, {
            max_new_tokens: MAX_NEW_TOKENS,
            temperature: TEMPERATURE,
        } as any);

        localCancel = cancel;
        cancelCurrent = cancel;

        const streamTask = (async () => {
            for await (const token of stream) {
                output += token;
                if (!firstTokenSent) {
                    firstTokenSent = true;
                    self.postMessage({ type: 'stream_active' });
                }
            }
        })();

        await Promise.race([
            Promise.all([streamTask, result]),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    try {
                        cancel();
                    } catch {
                        // no-op
                    }
                    reject(new InferenceTimeoutError(INFERENCE_TIMEOUT_MS));
                }, INFERENCE_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (localCancel) {
            try {
                localCancel();
            } catch {
                // no-op
            }
        }
        cancelCurrent = null;
    }

    if (!output.trim()) {
        throw new Error('Model returned empty output');
    }

    return limitOutputToTokens(output, MAX_NEW_TOKENS);
}

function limitOutputToTokens(text: string, maxTokens: number): string {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length <= maxTokens) return text.trim();
    return tokens.slice(0, maxTokens).join(' ');
}

self.onmessage = async (e: MessageEvent<any>) => {
    const msg = e.data;

    if (msg.type === 'INIT') {
        if (modelLoaded) {
            self.postMessage({ type: 'READY' });
            return;
        }

        try {
            self.postMessage({ type: 'status', value: 'initializing' });
            await workerInitSDK();
            modelLoaded = true;
            self.postMessage({ type: 'READY' });
        } catch (err: any) {
            self.postMessage({ type: 'init-error', value: err?.message || String(err) });
        }
        return;
    }

    if (msg.type === 'START_OPTIMIZATION') {
        if (!modelLoaded) {
            self.postMessage({ type: 'error', value: 'Model is still loading. Please wait for the AI to be ready.' });
            return;
        }

        const { code, language, focus } = msg.payload as {
            code: string;
            language: string;
            focus: OptimizationFocus;
        };

        try {
            self.postMessage({ type: 'stage', value: 'Understanding Code' });
            const analysis = analyzeCode(code, language);
            self.postMessage({ type: 'analysis', value: analysis });

            const fullPrompt = buildPrompt(code, language, focus, analysis);

            self.postMessage({ type: 'stage', value: 'Optimizing' });
            let modelOutput = '';
            modelOutput = await runLLMCall(fullPrompt);
            self.postMessage({ type: 'stream_idle' });

            self.postMessage({ type: 'stage', value: 'Finalizing Output' });
            const parsed = normalizeLLMOutput(modelOutput, code, analysis, language);
            if (!parsed._parsed) {
                throw new Error(parsed.explanation || 'Failed to parse model output');
            }

            self.postMessage({ type: 'done', value: parsed });
        } catch (err: any) {
            cancelCurrent = null;
            const errMsg = err?.message || String(err);
            const isTimeout = err instanceof InferenceTimeoutError || /timed out/i.test(errMsg);
            self.postMessage({
                type: 'error',
                value: isTimeout
                    ? `Optimization timed out after ${Math.round(INFERENCE_TIMEOUT_MS / 1000)}s. Try smaller input.`
                    : `Optimization failed: ${errMsg}`,
            });
        }

        return;
    }

    if (msg.type === 'CANCEL_OPTIMIZATION') {
        if (cancelCurrent) {
            cancelCurrent();
            cancelCurrent = null;
        }
    }
};
