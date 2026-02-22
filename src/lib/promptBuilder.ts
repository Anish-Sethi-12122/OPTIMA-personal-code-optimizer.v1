/**
 * promptBuilder.ts — OPTIMA Prompt Engineering for 350M Model
 *
 * DESIGN PRINCIPLES:
 *   1. Small models can't do complex JSON — return ONLY code
 *   2. Don't ask model to "figure out" optimization — TELL it what to change
 *   3. Use static analysis to generate EXPLICIT transformation instructions
 *   4. Few-shot example teaches the expected behavior
 *   5. Force change — model must attempt transformation
 *
 * OUTPUT FORMAT: Raw optimized code only. No JSON. No explanation.
 * ALL metadata (algorithm, complexity, etc.) comes from static analysis.
 */

import type { StaticAnalysis } from './staticAnalyzer';

export type { StaticAnalysis };

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type OptimizationFocus = 'performance' | 'readability' | 'security' | 'best-practices' | 'all';

export interface OptimizationResult {
    algorithm: string;
    complexity_before: string;
    complexity_after: string;
    bottleneck: string;
    strategy: string;
    optimization_strategy: string;
    tradeoffs: string;
    estimated_improvement: string;
    confidence: number;
    explanation: string;
    optimized_code: string;

    detected_patterns?: Array<{ type: string; description: string; severity: string }>;
    possible_optimizations?: Array<{ action: string; rationale: string; expectedImpact: string }>;
    static_confidence_score?: number;

    _parsed: boolean;
    _no_change: boolean;
    _c_language?: boolean;
    _parse_warning?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// isFullySupported
// ─────────────────────────────────────────────────────────────────────────────

const FULLY_SUPPORTED = new Set(['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust']);

export function isFullySupported(language: string): boolean {
    return FULLY_SUPPORTED.has(language);
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus → one-line instruction
// ─────────────────────────────────────────────────────────────────────────────

const FOCUS_LINE: Record<OptimizationFocus, string> = {
    performance: 'Focus on reducing time and space complexity.',
    readability: 'Focus on clarity, naming, and removing duplication.',
    security: 'Focus on input validation and removing injection risks.',
    'best-practices': 'Focus on idiomatic patterns and modern conventions.',
    all: 'Improve performance, readability, and maintainability.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Pattern → explicit transformation instruction
// Converts detected static analysis patterns into DIRECT orders for the LLM
// ─────────────────────────────────────────────────────────────────────────────

function patternToInstruction(type: string): string {
    switch (type) {
        case 'nested_loops':
            return 'Replace nested loops with a hash-based approach (Set or Map) to reduce O(n²) to O(n).';
        case 'repeated_computation':
            return 'Cache the result of repeated computations in a variable instead of recalculating.';
        case 'inefficient_data_structure':
            return 'Replace Array.includes/indexOf lookups with Set or Map for O(1) access.';
        case 'redundant_condition':
            return 'Remove redundant or duplicate conditional checks.';
        case 'string_concat_in_loop':
            return 'Use array join or StringBuilder instead of string concatenation inside loops.';
        case 'n_plus_one_query':
            return 'Batch queries or use bulk operations instead of querying inside a loop.';
        case 'unnecessary_recomputation':
            return 'Move invariant computations outside the loop.';
        case 'missing_early_exit':
            return 'Add early return/break when the result is already determined.';
        case 'excessive_nesting':
            return 'Flatten deeply nested code using guard clauses or early returns.';
        case 'large_function':
            return 'Extract logical sections into smaller, focused helper functions.';
        default:
            return 'Identify and fix the inefficiency.';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Few-shot examples — teach the model what "optimize" means
// ─────────────────────────────────────────────────────────────────────────────

const FEW_SHOT_PYTHON = `Example:

Input:
def find_duplicates(arr):
    result = []
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] == arr[j] and arr[i] not in result:
                result.append(arr[i])
    return result

Output:
def find_duplicates(arr):
    seen = set()
    duplicates = set()
    for item in arr:
        if item in seen:
            duplicates.add(item)
        seen.add(item)
    return list(duplicates)`;

const FEW_SHOT_JS = `Example:

Input:
function findCommon(arr1, arr2) {
  const result = [];
  for (let i = 0; i < arr1.length; i++) {
    for (let j = 0; j < arr2.length; j++) {
      if (arr1[i] === arr2[j]) {
        result.push(arr1[i]);
        break;
      }
    }
  }
  return result;
}

Output:
function findCommon(arr1, arr2) {
  const set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
}`;

const FEW_SHOT_GENERIC = `Example:

Input (nested loop finding pairs):
for each item1 in list:
    for each item2 in list:
        if item1 + item2 == target:
            return pair

Output (hash-based O(n)):
seen = {}
for each item in list:
    complement = target - item
    if complement in seen:
        return (complement, item)
    seen[item] = true`;

function getFewShot(language: string): string {
    const lang = language.toLowerCase();
    if (lang === 'python') return FEW_SHOT_PYTHON;
    if (lang === 'javascript' || lang === 'typescript') return FEW_SHOT_JS;
    return FEW_SHOT_GENERIC;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code normalization — for accurate comparison
// ─────────────────────────────────────────────────────────────────────────────

function normalizeCode(code: string): string {
    return code
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// buildStructuredPrompt — Simplified for 350M model
//
// STRUCTURE:
//   System: "You are a performance optimization engine."
//   User: Detected issues + explicit instructions + code + few-shot
//   Output: ONLY optimized code
// ─────────────────────────────────────────────────────────────────────────────

export function buildStructuredPrompt(
    code: string,
    analysis: StaticAnalysis,
    focus: OptimizationFocus,
    isRetry?: boolean,
): { systemPrompt: string; userPrompt: string } {
    const langLower = analysis.language.toLowerCase().replace(/[^a-z+#]/g, '');

    // Build explicit transformation instructions from detected patterns
    const instructions: string[] = [];
    const detectedTypes = new Set<string>();

    for (const pattern of analysis.detected_patterns) {
        if (!detectedTypes.has(pattern.type)) {
            detectedTypes.add(pattern.type);
            instructions.push(patternToInstruction(pattern.type));
        }
    }

    // Add suggestions from static analysis
    for (const opt of analysis.possible_optimizations) {
        instructions.push(opt.action);
    }

    // If no specific patterns found, add generic improvement instructions
    if (instructions.length === 0) {
        instructions.push('Look for any loops that can be simplified or removed.');
        instructions.push('Replace O(n²) patterns with hash-based O(n) approaches.');
        instructions.push('Remove redundant computations.');
    }

    const systemPrompt = `You are a performance optimization engine.
Your task is to MODIFY the code to improve performance.
Return ONLY the optimized code.
Do NOT include any explanation, comments about changes, or markdown.
Do NOT wrap the code in backticks or code fences.
Return the complete, runnable code.`;

    const retryClause = isRetry
        ? `\nIMPORTANT: The previous attempt returned the same code unchanged.
You MUST modify this code. It contains inefficiencies that need to be fixed.
Do NOT return the original code again.\n`
        : '';

    const instructionList = instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n');

    const fewShot = getFewShot(analysis.language);

    const userPrompt = `${FOCUS_LINE[focus]}
${retryClause}
Detected issues in this ${analysis.language} code:
${analysis.detected_patterns.length > 0
            ? analysis.detected_patterns.map(p => `- ${p.description} [${p.severity}]`).join('\n')
            : '- General performance patterns to optimize'}

Required changes:
${instructionList}

${fewShot}

You MUST return a modified version of the code.
Do NOT return the same code unless it is truly optimal.

${analysis.language} code to optimize:

${code}

Optimized ${analysis.language} code:`;

    return { systemPrompt, userPrompt };
}

/**
 * buildPrompt — legacy single-string builder.
 */
export function buildPrompt(
    code: string,
    language: string,
    focus: OptimizationFocus,
    meta: StaticAnalysis,
): string {
    const { systemPrompt, userPrompt } = buildStructuredPrompt(code, meta, focus);
    return `${systemPrompt}\n\n${userPrompt}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeLLMOutput — Extracts code from raw LLM text
//
// Since we no longer ask for JSON, the LLM returns raw code.
// We just need to clean it up:
//   1. Strip markdown code fences if present
//   2. Strip any preamble text before actual code
//   3. Validate it's actual code, not an explanation
//   4. All metadata comes from static analysis
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeLLMOutput(
    rawText: string,
    originalCode: string,
    analysis: StaticAnalysis,
    language?: string,
): OptimizationResult {
    const lang = language || analysis.language;
    const isC = lang === 'C';

    const enrichment: Enrichment = {
        detected_patterns: analysis.detected_patterns,
        possible_optimizations: analysis.possible_optimizations,
        static_confidence_score: analysis.confidence_score,
        _c_language: isC || undefined,
    };

    // Extract code from raw output
    let cleanCode = extractCode(rawText, lang);

    // If extraction failed, use original as fallback
    if (!cleanCode) {
        return makeFallback(originalCode, isC, enrichment, analysis, 'Could not extract valid code from model output');
    }

    // Strict no-change: code comparison only
    const noChange = normalizeCode(cleanCode) === normalizeCode(originalCode);

    // Build explanation from static analysis patterns
    const explanation = noChange
        ? 'Code is already well-optimized. No meaningful changes found.'
        : buildExplanation(analysis);

    // Confidence from static analysis
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
        estimated_improvement: noChange
            ? 'No measurable improvement'
            : estimateImprovement(analysis),
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

// ─────────────────────────────────────────────────────────────────────────────
// Code extraction — clean raw LLM output into usable code
// ─────────────────────────────────────────────────────────────────────────────

function extractCode(rawText: string, language: string): string | null {
    let text = rawText.trim();

    // Strategy 1: If LLM returned JSON despite instructions, extract optimized_code
    if (text.startsWith('{') && text.includes('"optimized_code"')) {
        try {
            const obj = JSON.parse(text);
            if (typeof obj.optimized_code === 'string') {
                let code = obj.optimized_code
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\t/g, '\t')
                    .replace(/\\\\/g, '\\');
                code = stripCodeFences(code);
                if (code.trim()) return code.trim();
            }
        } catch {
            // Try embedded JSON extraction
            const match = text.match(/"optimized_code"\s*:\s*"([\s\S]*?)(?<!\\)"/);
            if (match) {
                let code = match[1]
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\t/g, '\t')
                    .replace(/\\\\/g, '\\');
                if (code.trim()) return code.trim();
            }
        }
    }

    // Strategy 2: Strip markdown code fences
    text = stripCodeFences(text);

    // Strategy 3: Strip any "Here is the optimized code:" preamble
    const preamblePatterns = [
        /^(?:here\s+is|below\s+is|the\s+optimized|optimized\s+(?:code|version))[\s\S]*?:\s*\n/i,
        /^(?:output|result|answer)[\s\S]*?:\s*\n/i,
    ];
    for (const re of preamblePatterns) {
        text = text.replace(re, '');
    }
    text = text.trim();

    // Strategy 4: If it starts with JSON marker from old prompt, extract
    if (text.includes('<<OPTIMA_JSON_START>>')) {
        const startIdx = text.indexOf('<<OPTIMA_JSON_START>>');
        const endIdx = text.indexOf('<<OPTIMA_JSON_END>>');
        if (endIdx > startIdx) {
            const jsonStr = text.slice(startIdx + '<<OPTIMA_JSON_START>>'.length, endIdx).trim();
            try {
                const obj = JSON.parse(jsonStr);
                if (typeof obj.optimized_code === 'string') {
                    return obj.optimized_code
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\t/g, '\t')
                        .replace(/\\\\/g, '\\')
                        .trim() || null;
                }
            } catch { /* fall through */ }
        }
    }

    // Reject if it looks like pure JSON (not code)
    if (text.startsWith('{') && text.endsWith('}') && text.includes('"optimized_code"')) {
        return null;
    }

    // Return whatever we have if it's non-empty
    return text || null;
}

function stripCodeFences(code: string): string {
    // Match ```language\n...\n``` pattern
    const fenced = code.match(/^```[\w]*\s*\n([\s\S]*?)```\s*$/);
    if (fenced) return fenced[1].trim();

    // Match ``` at start and end without newline
    const simpleFenced = code.match(/^```[\w]*\s*([\s\S]*?)```\s*$/);
    if (simpleFenced) return simpleFenced[1].trim();

    return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static analysis-derived metadata helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildExplanation(analysis: StaticAnalysis): string {
    const parts: string[] = [];

    if (analysis.detected_patterns.length > 0) {
        const highSev = analysis.detected_patterns.filter(p => p.severity === 'high');
        if (highSev.length > 0) {
            parts.push(`Fixed ${highSev.length} high-severity issue(s): ${highSev.map(p => p.description).join(', ')}.`);
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
    if (current.includes('n²') || current.includes('n^2')) return 'O(n)';
    if (current.includes('n³') || current.includes('n^3')) return 'O(n²)';
    if (current.includes('n log n')) return 'O(n)';
    return current; // Can't estimate improvement
}

function estimateImprovement(analysis: StaticAnalysis): string {
    const hasHigh = analysis.detected_patterns.some(p => p.severity === 'high');
    const hasMedium = analysis.detected_patterns.some(p => p.severity === 'medium');

    if (hasHigh) return 'Significant — reduced time complexity';
    if (hasMedium) return 'Moderate — improved efficiency';
    return 'Minor optimization applied';
}

interface Enrichment {
    detected_patterns?: OptimizationResult['detected_patterns'];
    possible_optimizations?: OptimizationResult['possible_optimizations'];
    static_confidence_score?: number;
    _c_language?: boolean;
}

function makeFallback(
    originalCode: string,
    isC: boolean,
    enrichment: Enrichment,
    analysis: StaticAnalysis,
    warn: string,
): OptimizationResult {
    return {
        algorithm: analysis.detected_algorithm || 'Custom Logic',
        complexity_before: analysis.estimated_complexity || 'Unknown',
        complexity_after: analysis.estimated_complexity || 'Unknown',
        bottleneck: analysis.detected_patterns[0]?.description || 'None detected',
        strategy: 'Fallback — original preserved',
        optimization_strategy: 'Fallback — original preserved',
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
