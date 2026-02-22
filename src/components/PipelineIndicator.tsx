import { useEffect, useState } from 'react';

export type PipelineStage = 'idle' | 'parsing' | 'analyzing' | 'optimizing' | 'rendering' | 'done';

interface Props {
    stage: PipelineStage;
    isChunked?: boolean;
    chunkIndex?: number;
    totalChunks?: number;
}

const STAGES: Array<{ key: PipelineStage; label: string; icon: string }> = [
    { key: 'parsing', label: 'Parsing', icon: '📄' },
    { key: 'analyzing', label: 'Analyzing', icon: '🔍' },
    { key: 'optimizing', label: 'Optimizing', icon: '⚙️' },
    { key: 'rendering', label: 'Rendering', icon: '✨' },
];

const STAGE_ORDER: PipelineStage[] = ['idle', 'parsing', 'analyzing', 'optimizing', 'rendering', 'done'];

export function PipelineIndicator({ stage, isChunked, chunkIndex = 0, totalChunks = 1 }: Props) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (stage !== 'idle' && stage !== 'done') {
            setVisible(true);
        } else if (stage === 'done') {
            const t = setTimeout(() => setVisible(false), 800);
            return () => clearTimeout(t);
        }
    }, [stage]);

    if (!visible) return null;

    const currentIdx = STAGE_ORDER.indexOf(stage);

    return (
        <div className="pipeline-indicator">
            <div className="pipeline-steps">
                {STAGES.map((s, i) => {
                    const stageIdx = STAGE_ORDER.indexOf(s.key);
                    const isActive = s.key === stage;
                    const isDone = stageIdx < currentIdx;
                    const isPending = stageIdx > currentIdx;

                    return (
                        <div key={s.key} className={`pipeline-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isPending ? 'pending' : ''}`}>
                            <div className="step-icon">
                                {isDone ? '✓' : s.icon}
                            </div>
                            <span className="step-label">{s.label}</span>
                            {i < STAGES.length - 1 && (
                                <div className={`step-connector ${isDone ? 'done' : ''}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {isChunked && totalChunks > 1 && (
                <div className="pipeline-chunk-info">
                    Processing chunk {chunkIndex + 1} of {totalChunks}
                    <div className="chunk-bar">
                        <div className="chunk-fill" style={{ width: `${((chunkIndex + 1) / totalChunks) * 100}%` }} />
                    </div>
                </div>
            )}
        </div>
    );
}
