import type { StaticAnalysis } from './staticAnalyzer';

export type { StaticAnalysis };

export type OptimizationFocus = 'performance' | 'readability' | 'security' | 'best-practices' | 'all';

export interface OptimizationResult {
    algorithm: string;
    complexity_before: string;
    complexity_after: string;
    bottleneck: string;
    bottleneck_summary?: string;
    strategy: string;
    optimization_strategy: string;
    tradeoffs: string;
    estimated_improvement: string;
    confidence: number;
    explanation: string;
    optimized_code: string;
    time_complexity?: string;
    time_complexity_after?: string;
    detected_patterns?: Array<{ type: string; description: string; severity: string }>;
    possible_optimizations?: Array<{ action: string; rationale: string; expectedImpact: string }>;
    static_confidence_score?: number;
    _parsed: boolean;
    _no_change: boolean;
    _c_language?: boolean;
    _parse_warning?: string;
}

const FULLY_SUPPORTED = new Set(['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust']);

export function isFullySupported(language: string): boolean {
    return FULLY_SUPPORTED.has(language);
}

function normalizeCode(code: string): string {
    return code
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();
}

export function buildStructuredPrompt(
    code: string,
    _analysis: StaticAnalysis,
    _focus: OptimizationFocus,
): { fullPrompt: string; systemPrompt: string; userPrompt: string } {
    const systemPrompt = 'Fix ONE inefficiency in this code. Return only the changed lines.';
    const userPrompt = code;
    const fullPrompt = `${systemPrompt}\n${userPrompt}`;
    return { fullPrompt, systemPrompt, userPrompt };
}

export function buildPrompt(
    code: string,
    _language: string,
    focus: OptimizationFocus,
    meta: StaticAnalysis,
): string {
    const { fullPrompt } = buildStructuredPrompt(code, meta, focus);
    return fullPrompt;
}

export function normalizeLLMOutput(
    rawText: string,
    originalCode: string,
    analysis: StaticAnalysis,
    language?: string,
): OptimizationResult {
    const lang = language || analysis.language;
    const isC = lang === 'C';
    const cleanCode = extractCode(rawText);

    const enrichment = {
        detected_patterns: analysis.detected_patterns,
        possible_optimizations: analysis.possible_optimizations,
        static_confidence_score: analysis.confidence_score,
        _c_language: isC || undefined,
    };

    if (!cleanCode) {
        return makeFallback(originalCode, isC, enrichment, analysis, 'Could not extract valid code from model output');
    }

    const noChange = normalizeCode(cleanCode) === normalizeCode(originalCode);
    const explanation = noChange
        ? 'Code is already well-optimized. No meaningful changes found.'
        : buildExplanation(analysis);

    let confidence = noChange ? 100 : Math.round(analysis.confidence_score * 100);
    if (isC && confidence > 70 && !noChange) confidence = 70;

    const strategy = noChange
        ? 'No change needed'
        : (analysis.possible_optimizations[0]?.action || 'Performance optimization applied');

    return {
        algorithm: analysis.detected_algorithm || 'Custom Logic',
        complexity_before: analysis.estimated_complexity || 'Unknown',
        complexity_after: noChange ? (analysis.estimated_complexity || 'Unknown') : estimateImprovedComplexity(analysis),
        bottleneck: analysis.detected_patterns[0]?.description || 'None detected',
        strategy,
        optimization_strategy: strategy,
        tradeoffs: 'None',
        estimated_improvement: noChange ? 'No measurable improvement' : estimateImprovement(analysis),
        confidence,
        explanation,
        optimized_code: cleanCode,
        detected_patterns: enrichment.detected_patterns,
        possible_optimizations: enrichment.possible_optimizations,
        static_confidence_score: enrichment.static_confidence_score,
        _parsed: true,
        _no_change: noChange,
        _c_language: enrichment._c_language,
    };
}

function extractCode(rawText: string): string | null {
    let text = rawText.trim();
    if (!text) return null;

    const fenced = text.match(/^```[\w]*\s*\n([\s\S]*?)```\s*$/);
    if (fenced) text = fenced[1].trim();

    const simpleFenced = text.match(/^```[\w]*\s*([\s\S]*?)```\s*$/);
    if (simpleFenced) text = simpleFenced[1].trim();

    text = text.replace(
        /^(?:here\s+is|below\s+is|the\s+optimized|optimized\s+(?:code|version)|output|result|answer)[\s\S]*?:\s*\n/i,
        '',
    ).trim();

    return text || null;
}

function buildExplanation(analysis: StaticAnalysis): string {
    const parts: string[] = [];

    if (analysis.detected_patterns.length > 0) {
        const highSev = analysis.detected_patterns.filter((p) => p.severity === 'high');
        if (highSev.length > 0) {
            parts.push(`Fixed ${highSev.length} high-severity issue(s): ${highSev.map((p) => p.description).join(', ')}.`);
        } else {
            parts.push(`Improved ${analysis.detected_patterns.length} detected pattern(s).`);
        }
    }

    if (analysis.possible_optimizations.length > 0) {
        parts.push(`Applied: ${analysis.possible_optimizations[0].action}.`);
    }

    return parts.join(' ') || 'Performance optimization applied.';
}

function estimateImprovedComplexity(analysis: StaticAnalysis): string {
    const current = analysis.estimated_complexity;
    if (current.includes('n²') || current.includes('n^2') || current.includes('nÂ²')) return 'O(n)';
    if (current.includes('n³') || current.includes('n^3') || current.includes('nÂ³')) return 'O(n²)';
    if (current.includes('n log n')) return 'O(n)';
    return current;
}

function estimateImprovement(analysis: StaticAnalysis): string {
    const hasHigh = analysis.detected_patterns.some((p) => p.severity === 'high');
    const hasMedium = analysis.detected_patterns.some((p) => p.severity === 'medium');
    if (hasHigh) return 'Significant - reduced time complexity';
    if (hasMedium) return 'Moderate - improved efficiency';
    return 'Minor optimization applied';
}

function makeFallback(
    originalCode: string,
    isC: boolean,
    enrichment: {
        detected_patterns?: OptimizationResult['detected_patterns'];
        possible_optimizations?: OptimizationResult['possible_optimizations'];
        static_confidence_score?: number;
        _c_language?: boolean;
    },
    analysis: StaticAnalysis,
    warn: string,
): OptimizationResult {
    return {
        algorithm: analysis.detected_algorithm || 'Custom Logic',
        complexity_before: analysis.estimated_complexity || 'Unknown',
        complexity_after: analysis.estimated_complexity || 'Unknown',
        bottleneck: analysis.detected_patterns[0]?.description || 'None detected',
        strategy: 'Fallback - original preserved',
        optimization_strategy: 'Fallback - original preserved',
        tradeoffs: 'None',
        estimated_improvement: 'No measurable improvement',
        confidence: 0,
        explanation: warn,
        optimized_code: originalCode,
        detected_patterns: enrichment.detected_patterns,
        possible_optimizations: enrichment.possible_optimizations,
        static_confidence_score: enrichment.static_confidence_score,
        _parsed: false,
        _no_change: true,
        _c_language: isC || undefined,
        _parse_warning: warn,
    };
}
