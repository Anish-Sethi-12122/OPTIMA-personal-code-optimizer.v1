import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

const LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 
  'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'HTML', 'CSS',
  'SQL', 'Shell', 'Dart', 'Scala'
] as const;

type OptimizationFocus = 'performance' | 'readability' | 'security' | 'best-practices' | 'all';

interface OptimizationResult {
  original: string;
  optimized: string;
  suggestions?: string;
  timestamp: number;
  language: string;
  focus: OptimizationFocus;
}

interface CodeHistoryItem extends OptimizationResult {
  id: string;
}

const MAX_CODE_LENGTH = 4000;
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 60000;

// Language detection based on file extension
const detectLanguageFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'js': 'JavaScript',
    'jsx': 'JavaScript',
    'ts': 'TypeScript',
    'tsx': 'TypeScript',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'cc': 'C++',
    'cxx': 'C++',
    'c': 'C++',
    'cs': 'C#',
    'go': 'Go',
    'rs': 'Rust',
    'php': 'PHP',
    'rb': 'Ruby',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'html': 'HTML',
    'htm': 'HTML',
    'css': 'CSS',
    'sql': 'SQL',
    'sh': 'Shell',
    'bash': 'Shell',
    'dart': 'Dart',
    'scala': 'Scala',
  };
  return langMap[ext] || 'TypeScript';
};

export function CodeOptimizerTab() {
  const loader = useModelLoader(ModelCategory.Language);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [codeInput, setCodeInput] = useState('');
  const [language, setLanguage] = useState<string>('TypeScript');
  const [focus, setFocus] = useState<OptimizationFocus>('all');
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [streamingOutput, setStreamingOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<CodeHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('code-optimizer-history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('code-optimizer-history', JSON.stringify(history));
  }, [history]);

  const focusText = useMemo(() => ({
    performance: 'Prioritize time complexity, memory efficiency, and algorithmic improvements.',
    readability: 'Improve naming, structure, modularity, and clarity.',
    security: 'Fix vulnerabilities, validate inputs, and remove unsafe patterns.',
    'best-practices': 'Follow idiomatic patterns and modern language conventions.',
    all: 'Optimize performance, readability, and maintainability.'
  }), []);

  const buildPrompt = useCallback((code: string) => {
    return `You are a senior ${language} engineer.

TASK: Refactor and optimize this code.

RULES:
- Keep functionality identical
- Reduce complexity where possible
- Remove redundant code
- Improve structure and naming
- Follow ${focus} best practices

FOCUS: ${focusText[focus]}

CODE:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

OUTPUT: Return ONLY the optimized code in a single code block.`;
  }, [language, focus, focusText]);

  const clearAll = useCallback(() => {
    setCodeInput('');
    setResult(null);
    setStreamingOutput('');
    setError(null);
  }, []);

  const optimize = useCallback(async () => {
    const code = codeInput.trim();

    if (!code) return setError('Please paste code to optimize');
    if (code.length > MAX_CODE_LENGTH)
      return setError(`Code exceeds ${MAX_CODE_LENGTH} characters (current: ${code.length})`);

    if (optimizing) return;

    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return setError('Failed to load model. Please try again.');
    }

    setOptimizing(true);
    setThinking(true);
    setStreamingOutput('');
    setError(null);
    setResult(null);

    try {
      // Simulate thinking phase (like Claude) - reduced for faster response
      await new Promise(resolve => setTimeout(resolve, 300));
      setThinking(false);

      timeoutRef.current = setTimeout(() => {
        cancelRef.current?.();
        setError('Optimization timed out. Try shorter code.');
        setOptimizing(false);
      }, TIMEOUT_MS);

      const { stream, result: resultPromise, cancel } =
        await TextGeneration.generateStream(buildPrompt(code), {
          maxTokens: MAX_TOKENS,
          temperature: 0.3,
          topP: 0.95,
          repeatPenalty: 1.15,
        });

      cancelRef.current = cancel;

      let acc = '';
      for await (const token of stream) {
        acc += token;
        setStreamingOutput(acc);
      }

      const final = await resultPromise;
      cleanupTimers();

      const newResult: OptimizationResult = {
        original: code,
        optimized: final.text || acc,
        timestamp: Date.now(),
        language,
        focus,
      };

      setResult(newResult);

      // Save to history
      const historyItem: CodeHistoryItem = {
        ...newResult,
        id: Date.now().toString(),
      };
      setHistory(prev => [historyItem, ...prev.slice(0, 49)]); // Keep last 50 items

      setStreamingOutput('');
      setToastMessage('Optimization completed!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      cleanupTimers();
      const msg = err instanceof Error ? err.message : String(err);
      
      if (msg.includes('out of bounds') || msg.includes('RuntimeError')) {
        setError('Model crashed. Try shorter code (under 2000 characters).');
      } else if (msg.includes('abort') || msg.includes('cancel')) {
        setError('Optimization cancelled.');
      } else {
        setError(msg);
      }
    } finally {
      cancelRef.current = null;
      setOptimizing(false);
      setThinking(false);
    }
  }, [codeInput, optimizing, loader, buildPrompt, language, focus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === 'Enter') {
        e.preventDefault();
        const codeLength = codeInput.length;
        const isOverLimit = codeLength > MAX_CODE_LENGTH;
        if (!optimizing && codeInput.trim() && loader.state === 'ready' && !isOverLimit) {
          optimize();
        }
      }

      if (modifier && e.key === 'k') {
        e.preventDefault();
        if (!optimizing) {
          clearAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [codeInput, optimizing, loader.state, optimize, clearAll]);

  const cleanupTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleCancel = () => {
    cancelRef.current?.();
    cleanupTimers();
    setOptimizing(false);
    setThinking(false);
  };

  const extractCode = (text: string) => {
    const match = text.match(/```[\w]*\n([\s\S]*?)```/);
    return match ? match[1].trim() : text;
  };

  const formatCode = (code: string): string => {
    // Basic formatting - preserve indentation
    return code.split('\n').map(line => {
      // Remove excessive blank lines
      if (line.trim() === '') return '';
      return line;
    }).filter((line, idx, arr) => {
      // Remove consecutive blank lines
      if (line === '' && arr[idx + 1] === '') return false;
      return true;
    }).join('\n');
  };

  const copyToClipboard = (text: string, formatted: boolean = false) => {
    const codeToCopy = formatted ? formatCode(text) : text;
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setToastMessage('Copied to clipboard!');
      setTimeout(() => setToastMessage(null), 3000);
    }).catch(() => {
      setToastMessage('Failed to copy');
      setTimeout(() => setToastMessage(null), 3000);
    });
  };

  const exportToFile = (code: string, filename: string) => {
    const formattedCode = formatCode(code);
    const blob = new Blob([formattedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `optimized-code.${language.toLowerCase() === 'typescript' ? 'ts' : language.toLowerCase() === 'javascript' ? 'js' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMessage('File downloaded!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content.length > MAX_CODE_LENGTH) {
        setError(`File too large (${content.length} chars). Max ${MAX_CODE_LENGTH} characters.`);
        return;
      }
      
      const detectedLang = detectLanguageFromFilename(file.name);
      setCodeInput(content);
      setLanguage(detectedLang);
      setToastMessage(`Imported ${file.name} (${detectedLang})`);
      setTimeout(() => setToastMessage(null), 3000);
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const revertToHistory = (item: CodeHistoryItem) => {
    setCodeInput(item.original);
    setLanguage(item.language);
    setFocus(item.focus);
    setResult(item);
    setShowHistory(false);
    setToastMessage('Reverted to previous version');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const codeLength = codeInput.length;
  const isOverLimit = codeLength > MAX_CODE_LENGTH;

  return (
    <div className="tab-panel optimizer-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="LLM"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}

      {error && (
        <div className="optimizer-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button className="btn btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="optimizer-controls">
        <div className="control-group">
          <label className="control-label">SELECT CODING LANGUAGE</label>
          <select 
            className="optimizer-select"
            value={language} 
            onChange={e => setLanguage(e.target.value)} 
            disabled={optimizing}
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">SELECT OPTIMIZATION</label>
          <select 
            className="optimizer-select"
            value={focus} 
            onChange={e => setFocus(e.target.value as OptimizationFocus)} 
            disabled={optimizing}
          >
            <option value="all">All Optimizations</option>
            <option value="performance">Performance</option>
            <option value="readability">Readability</option>
            <option value="security">Security</option>
            <option value="best-practices">Best Practices</option>
          </select>
        </div>

        <div className="code-length-indicator">
          <span className={isOverLimit ? 'warning' : ''}>
            {codeLength} / {MAX_CODE_LENGTH} characters
          </span>
          {isOverLimit && <span className="error-text">⚠️ Too long!</span>}
        </div>
      </div>

      <div className="optimizer-workspace">
        <div className="code-section">
          <div className="code-section-header">
            <h3>Input Code</h3>
            <div className="code-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.cc,.cxx,.c,.cs,.go,.rs,.php,.rb,.swift,.kt,.html,.htm,.css,.sql,.sh,.bash,.dart,.scala,.txt"
                onChange={handleFileImport}
                style={{ display: 'none' }}
              />
              <button 
                className="btn btn-sm btn-import" 
                onClick={() => fileInputRef.current?.click()}
                disabled={optimizing}
                title="Import code file"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Import
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => setShowHistory(!showHistory)}
                disabled={history.length === 0}
                title="View history"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18M7 16l4-4 4 4 6-6" />
                </svg>
                History ({history.length})
              </button>
              <button className="btn btn-sm" onClick={clearAll} disabled={optimizing} title="Clear (Ctrl/Cmd + K)">
                Clear
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => copyToClipboard(codeInput)} 
                disabled={!codeInput}
                title="Copy input code"
              >
                Copy
              </button>
            </div>
          </div>
          <textarea
            className="code-textarea"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.slice(0, MAX_CODE_LENGTH))}
            placeholder={`Paste your ${language} code here (max ${MAX_CODE_LENGTH} characters)...`}
            disabled={optimizing}
          />
        </div>

        <div className="code-section">
          <div className="code-section-header">
            <h3>{optimizing ? 'Optimizing...' : result ? 'Optimized Output' : 'Output'}</h3>
            {result && !optimizing && (
              <div className="code-actions">
                <button 
                  className="btn btn-sm btn-primary" 
                  onClick={() => setCodeInput(extractCode(result.optimized))}
                >
                  Use Optimized
                </button>
                <button 
                  className="btn btn-sm" 
                  onClick={() => copyToClipboard(extractCode(result.optimized), true)}
                  title="Copy formatted code"
                >
                  Copy Formatted
                </button>
                <button 
                  className="btn btn-sm btn-export" 
                  onClick={() => exportToFile(extractCode(result.optimized), `optimized-${Date.now()}.${language.toLowerCase() === 'typescript' ? 'ts' : language.toLowerCase() === 'javascript' ? 'js' : 'txt'}`)}
                  title="Export as file"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Export
                </button>
              </div>
            )}
          </div>
          <div className="code-output">
            {thinking && (
              <div className="thinking-animation">
                <div className="thinking-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p>Analyzing code structure...</p>
              </div>
            )}

            {optimizing && !thinking && (
              <pre className="code-preview streaming">{streamingOutput || 'Generating optimization...'}</pre>
            )}

            {result && !optimizing && (
              <pre className="code-preview">{extractCode(result.optimized)}</pre>
            )}

            {!optimizing && !result && !thinking && (
              <div className="empty-state">
                <div className="empty-icon">✨</div>
                <h3>Ready to Optimize</h3>
                <p>Paste your code and click "Optimize Code"</p>
                <p className="hint">Max {MAX_CODE_LENGTH} characters • Uses on-device AI</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="history-panel">
          <div className="history-header">
            <h3>Optimization History</h3>
            <button className="btn btn-sm" onClick={() => setShowHistory(false)}>Close</button>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">No history yet</div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-item-header">
                    <span className="history-language">{item.language}</span>
                    <span className="history-focus">{item.focus}</span>
                    <span className="history-time">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="history-item-actions">
                    <button 
                      className="btn btn-sm btn-primary" 
                      onClick={() => revertToHistory(item)}
                    >
                      Revert
                    </button>
                    <button 
                      className="btn btn-sm" 
                      onClick={() => copyToClipboard(extractCode(item.optimized), true)}
                    >
                      Copy
                    </button>
                    <button 
                      className="btn btn-sm" 
                      onClick={() => exportToFile(extractCode(item.optimized), `optimized-${item.id}.${item.language.toLowerCase() === 'typescript' ? 'ts' : item.language.toLowerCase() === 'javascript' ? 'js' : 'txt'}`)}
                    >
                      Export
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="optimizer-actions">
        {optimizing ? (
          <button className="btn btn-lg btn-cancel" onClick={handleCancel}>
            Cancel Optimization
          </button>
        ) : (
          <button 
            className="btn btn-primary btn-lg" 
            onClick={optimize} 
            disabled={!codeInput.trim() || loader.state !== 'ready' || isOverLimit}
            title="Optimize (Ctrl/Cmd + Enter)"
          >
            ✨ Optimize Code
          </button>
        )}
      </div>
    </div>
  );
}
