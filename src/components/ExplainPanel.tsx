import type { OptimizationResult } from '../lib/promptBuilder';

interface Props {
    result: OptimizationResult | null;
    isLoading: boolean;
    /** When false, improvement % and performance section are hidden (confidence <70% or no-change) */
    shouldShowImprovement?: boolean;
}

function ComplexityBadge({ label, color }: { label: string; color: 'red' | 'green' | 'blue' | 'gray' }) {
    return <span className={`complexity-badge complexity-${color}`}>{label}</span>;
}

function getComplexityColor(complexity: string | undefined): 'red' | 'green' | 'blue' | 'gray' {
    if (!complexity) return 'gray';
    if (/O\(1\)|O\(log n\)/i.test(complexity)) return 'green';
    if (/O\(n\)\b|O\(n log n\)/i.test(complexity)) return 'blue';
    if (/O\(n[²2]\)|O\(n\^2\)|O\(n[³3]\)|worse/i.test(complexity)) return 'red';
    return 'gray';
}

const SEVERITY_COLOR: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#6b7280',
};

const IMPACT_COLOR: Record<string, string> = {
    high: 'var(--success)',
    medium: '#f59e0b',
    low: 'var(--text-light)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Static Analysis Insights section
// ─────────────────────────────────────────────────────────────────────────────

function StaticInsightsPanel({ result }: { result: OptimizationResult }) {
    const patterns = result.detected_patterns ?? [];
    const suggestions = result.possible_optimizations ?? [];
    const score = result.static_confidence_score;

    if (patterns.length === 0 && suggestions.length === 0) return null;

    return (
        <div className="static-insights">
            <div className="insights-header">
                <span>🔬</span>
                <span>Static Analysis Report</span>
                {typeof score === 'number' && (
                    <span style={{
                        marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
                        padding: '2px 8px', borderRadius: '99px',
                        background: score >= 0.7 ? 'rgba(239,68,68,0.1)' : score >= 0.4 ? 'rgba(251,191,36,0.1)' : 'rgba(107,114,128,0.1)',
                        color: score >= 0.7 ? '#ef4444' : score >= 0.4 ? '#f59e0b' : 'var(--text-light)',
                        border: `1px solid ${score >= 0.7 ? 'rgba(239,68,68,0.3)' : score >= 0.4 ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
                    }}>
                        Optimizability: {Math.round(score * 100)}%
                    </span>
                )}
            </div>

            {patterns.length > 0 && (
                <div className="insights-section">
                    <div className="insights-section-title">Detected Patterns</div>
                    {patterns.map((p, i) => (
                        <div key={i} className="insight-item pattern-item">
                            <span className="insight-severity" style={{ color: SEVERITY_COLOR[p.severity] || 'var(--text-light)' }}>
                                {p.severity === 'high' ? '🔴' : p.severity === 'medium' ? '🟡' : '🟢'}
                            </span>
                            <span className="insight-desc">{p.description}</span>
                        </div>
                    ))}
                </div>
            )}

            {suggestions.length > 0 && (
                <div className="insights-section">
                    <div className="insights-section-title">Optimization Opportunities</div>
                    {suggestions.map((s, i) => (
                        <div key={i} className="insight-item suggestion-item">
                            <div className="suggestion-action">
                                <span style={{ color: IMPACT_COLOR[s.expectedImpact] || 'var(--text-light)', fontSize: '12px' }}>
                                    {s.expectedImpact === 'high' ? '⚡' : s.expectedImpact === 'medium' ? '→' : '·'}
                                </span>
                                <strong>{s.action}</strong>
                            </div>
                            <div className="suggestion-rationale">{s.rationale}</div>
                        </div>
                    ))}
                </div>
            )}


        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ExplainPanel
// ─────────────────────────────────────────────────────────────────────────────

export function ExplainPanel({ result, isLoading, shouldShowImprovement = true }: Props) {
    if (isLoading) {
        return (
            <div className="explain-panel">
                <div className="explain-grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="explain-card skeleton">
                            <div className="skeleton-line title" />
                            <div className="skeleton-line body" />
                            <div className="skeleton-line body short" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!result) return null;

    const isNoChange = result._no_change === true;
    const beforeColor = getComplexityColor(result.complexity_before);
    const afterColor = getComplexityColor(result.complexity_after);

    // ── NO-CHANGE STATE: clean message + static report, zero LLM metric cards ──
    if (isNoChange) {
        return (
            <div className="explain-panel">
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '32px 24px', textAlign: 'center',
                    gap: '10px',
                }}>
                    <div style={{ fontSize: '2.5rem' }}>✅</div>
                    <h3 style={{ margin: 0 }}>Already Well-Optimized</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: 0, fontSize: '13px' }}>
                        This code is already well-optimized. No meaningful improvements were found.
                    </p>
                    {result.explanation && result.explanation !== 'The code is already well-optimized.' && (
                        <p style={{ color: 'var(--text-light)', fontSize: '12px', maxWidth: '420px', margin: 0 }}>
                            {result.explanation}
                        </p>
                    )}
                    {result._c_language && (
                        <div className="explain-notice explain-notice--info" style={{ marginTop: '6px' }}>
                            <span>🛡️</span>
                            <span>C optimizations are conservative — no transformation applied to preserve safety.</span>
                        </div>
                    )}
                    {result._parse_warning && (
                        <div className="explain-notice explain-notice--warn" style={{ marginTop: '6px' }}>
                            <span>⚠️</span>
                            <span>{result._parse_warning}</span>
                        </div>
                    )}
                </div>

                {/* Still show static analysis patterns even in no-change state */}
                <StaticInsightsPanel result={result} />
            </div>
        );
    }

    return (
        <div className="explain-panel">

            {/* C language conservative safety banner */}
            {result._c_language && (
                <div className="explain-notice explain-notice--info">
                    <span>🛡️</span>
                    <span>C optimizations are conservative to ensure safety — pointer logic, memory layout, and struct fields are never modified unless provably safe.</span>
                </div>
            )}

            {/* Parse warning / fallback notice */}
            {result._parse_warning && (
                <div className="explain-notice explain-notice--warn">
                    <span>⚠️</span>
                    <span>{result._parse_warning}</span>
                </div>
            )}

            {/* ── LLM Result Cards ── */}
            <div className="explain-grid">

                <div className="explain-card algo-card">
                    <div className="card-icon">🧠</div>
                    <div className="card-content">
                        <div className="card-title">Detected Pattern</div>
                        <div className="card-value">{result.algorithm}</div>
                        <div className="card-sub">{result.optimization_strategy || result.strategy}</div>
                    </div>
                </div>

                <div className="explain-card complexity-card">
                    <div className="card-icon">⏱</div>
                    <div className="card-content">
                        <div className="card-title">Time Complexity</div>
                        <div className="complexity-compare">
                            <div className="complexity-item">
                                <span className="complexity-dir">Before</span>
                                <ComplexityBadge label={String(result.complexity_before || 'N/A')} color={beforeColor} />
                            </div>
                            <div className="complexity-arrow">→</div>
                            <div className="complexity-item">
                                <span className="complexity-dir">After</span>
                                <ComplexityBadge label={String(result.complexity_after || 'N/A')} color={afterColor} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="explain-card bottleneck-card">
                    <div className="card-icon">🚨</div>
                    <div className="card-content">
                        <div className="card-title">Bottleneck</div>
                        <div className="card-value small">{result.bottleneck}</div>
                    </div>
                </div>

                <div className="explain-card explanation-card">
                    <div className="card-icon">💡</div>
                    <div className="card-content">
                        <div className="card-title">Explanation</div>
                        <div className="card-value small">{result.explanation}</div>
                    </div>
                </div>

                {result.tradeoffs && result.tradeoffs !== 'None' && result.tradeoffs !== 'Unknown' && (
                    <div className="explain-card" style={{ gridColumn: '1 / -1' }}>
                        <div className="card-icon">⚖️</div>
                        <div className="card-content">
                            <div className="card-title">Trade-offs</div>
                            <div className="card-value small">{result.tradeoffs}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Static Analysis Insights (always shown) ── */}
            <StaticInsightsPanel result={result} />

            {/* ── Performance Confidence — only when high enough ── */}
            {shouldShowImprovement && (
                <div className="tradeoffs-section">
                    <div className="tradeoffs-header">
                        <span>⚡</span>
                        <span>Performance Assessment</span>
                    </div>
                    <div className="tradeoffs-body" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '2px' }}>Confidence</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: result._c_language ? '#f59e0b' : 'var(--success)' }}>
                                {typeof result.confidence === 'number' ? `${result.confidence}%` : '—'}
                                {result._c_language && <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.7 }}>(C cap)</span>}
                            </div>
                        </div>
                        <div style={{ width: '1px', height: '30px', background: 'var(--border)' }}></div>
                        <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '2px' }}>Estimated Improvement</div>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                                {result.estimated_improvement && result.estimated_improvement !== 'N/A'
                                    ? result.estimated_improvement
                                    : 'Minor optimization applied'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!shouldShowImprovement && (
                <div className="tradeoffs-section">
                    <div className="tradeoffs-body" style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '6px 0' }}>
                        ⚡ Optimization applied — model confidence below threshold to display improvement estimate.
                    </div>
                </div>
            )}
        </div>
    );
}
