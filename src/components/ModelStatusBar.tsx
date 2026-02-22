import type { LoaderState } from '../hooks/useModelLoader';

interface Props {
    state: LoaderState;
    progress: number;
    error: string | null;
    onRetry: () => void;
    executionMode: 'cpu' | 'webgpu';
}

export function ModelStatusBar({ state, progress, error, onRetry, executionMode }: Props) {
    const pct = Math.round(progress * 100);

    return (
        <div className="model-status-bar">
            {/* Model State */}
            <div className="model-status-left">
                <div className={`model-indicator ${state}`}>
                    {state === 'ready' && <span className="pulse-dot" />}
                    {(state === 'initializing' || state === 'loading_model') && (
                        <div className="progress-ring-wrap">
                            <svg className="progress-ring" width="22" height="22" viewBox="0 0 22 22">
                                <circle cx="11" cy="11" r="9" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                                <circle
                                    cx="11" cy="11" r="9" fill="none"
                                    stroke="var(--primary)" strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 9}`}
                                    strokeDashoffset={`${2 * Math.PI * 9 * (1 - (state === 'loading_model' ? 0.85 : progress))}`}
                                    style={{ transition: 'stroke-dashoffset 0.4s ease', transform: 'rotate(-90deg)', transformOrigin: '11px 11px' }}
                                />
                            </svg>
                            {state === 'loading_model' && <span className="ring-spin" />}
                        </div>
                    )}
                    {state === 'error' && <span className="error-dot">!</span>}
                    {state === 'idle' && <span className="idle-dot" />}
                </div>

                <div className="model-status-text">
                    {state === 'idle' && <span className="status-label">Preparing AI model...</span>}
                    {state === 'initializing' && (
                        <span className="status-label">
                            Downloading model <strong>{pct}%</strong>
                            <span className="status-sub"> — cached locally after first download</span>
                        </span>
                    )}
                    {state === 'loading_model' && <span className="status-label">Initializing on-device AI...</span>}
                    {state === 'ready' && (
                        <span className="status-label ready">
                            On-device AI ready
                        </span>
                    )}
                    {state === 'error' && (
                        <span className="status-label error">
                            Model error: {error}
                            <button className="retry-link" onClick={onRetry}>Retry</button>
                        </span>
                    )}
                </div>
            </div>

            {/* Execution Mode Toggle */}
            <div className="model-status-right">
                {state === 'initializing' && (
                    <div className="progress-bar-inline">
                        <div className="progress-fill-inline" style={{ width: `${pct}%` }} />
                    </div>
                )}
                {executionMode === 'webgpu' && (
                    <div
                        className="mode-toggle webgpu"
                        title="WebGPU acceleration active"
                        style={{ cursor: 'default' }}
                    >
                        <span className="mode-icon">⚡</span>
                        <span className="mode-label">Accelerated</span>
                    </div>
                )}
            </div>
        </div>
    );
}
