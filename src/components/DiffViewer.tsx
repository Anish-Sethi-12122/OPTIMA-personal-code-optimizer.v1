import { useState } from 'react';
import { computeDiff, computeDiffStats, type DiffLine } from '../lib/codeDiff';

interface Props {
    original: string;
    optimized: string;
}

export function DiffViewer({ original, optimized }: Props) {
    const [mode, setMode] = useState<'unified' | 'split'>('unified');

    const diff = computeDiff(original, optimized);
    const stats = computeDiffStats(diff);

    return (
        <div className="diff-viewer">
            {/* Stats Bar */}
            <div className="diff-stats">
                <span className="diff-stat added">+{stats.added} added</span>
                <span className="diff-stat removed">-{stats.removed} removed</span>
                <span className="diff-stat unchanged">{stats.unchanged} unchanged</span>
                <span className="diff-stat change-pct">{stats.changePercent}% changed</span>

                <div className="diff-mode-toggle">
                    <button
                        className={`mode-btn ${mode === 'unified' ? 'active' : ''}`}
                        onClick={() => setMode('unified')}
                    >Unified</button>
                    <button
                        className={`mode-btn ${mode === 'split' ? 'active' : ''}`}
                        onClick={() => setMode('split')}
                    >Split</button>
                </div>
            </div>

            {/* Diff Content */}
            {mode === 'unified' ? (
                <UnifiedView diff={diff} />
            ) : (
                <SplitView diff={diff} />
            )}
        </div>
    );
}

function UnifiedView({ diff }: { diff: DiffLine[] }) {
    return (
        <div className="diff-unified">
            {diff.map((line, i) => (
                <div key={i} className={`diff-line diff-${line.type}`}>
                    <span className="diff-gutter orig">{line.originalLineNo ?? ''}</span>
                    <span className="diff-gutter new">{line.newLineNo ?? ''}</span>
                    <span className="diff-sign">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span className="diff-content">{line.content}</span>
                </div>
            ))}
        </div>
    );
}

function SplitView({ diff }: { diff: DiffLine[] }) {
    const leftLines = diff.filter(d => d.type !== 'added');
    const rightLines = diff.filter(d => d.type !== 'removed');
    const maxLen = Math.max(leftLines.length, rightLines.length);

    return (
        <div className="diff-split">
            <div className="diff-split-pane">
                <div className="diff-split-header">Original</div>
                {leftLines.map((line, i) => (
                    <div key={i} className={`diff-line diff-${line.type}`}>
                        <span className="diff-gutter orig">{line.originalLineNo ?? ''}</span>
                        <span className="diff-content">{line.content}</span>
                    </div>
                ))}
            </div>
            <div className="diff-split-divider" />
            <div className="diff-split-pane">
                <div className="diff-split-header">Optimized</div>
                {rightLines.map((line, i) => (
                    <div key={i} className={`diff-line diff-${line.type}`}>
                        <span className="diff-gutter new">{line.newLineNo ?? ''}</span>
                        <span className="diff-content">{line.content}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
