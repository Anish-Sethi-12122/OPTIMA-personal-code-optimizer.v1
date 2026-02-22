import { useState, useEffect } from 'react';
import { CodeOptimizerTab } from './components/CodeOptimizerTab';
import { initializeSDK } from './hooks/useModelLoader';

export function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('darkMode') ?? 'true'); }
    catch { return true; }
  });

  useEffect(() => {
    initializeSDK();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark-mode');
    else document.documentElement.classList.remove('dark-mode');
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark-mode');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <div className="logo-mark">⚡</div>
          <div className="title-text">
            <h1>OPTIMA</h1>
            <span className="app-subtitle">On-Device Code Intelligence Engine</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle theme"
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 3V1M10 19V17M17 10H19M1 10H3M15.5 4.5L16.5 3.5M3.5 16.5L4.5 15.5M15.5 15.5L16.5 16.5M3.5 3.5L4.5 4.5M14 10C14 12.2091 12.2091 14 10 14C7.79086 14 6 12.2091 6 10C6 7.79086 7.79086 6 10 6C12.2091 6 14 7.79086 14 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 10.5C16.8 14.7 13.3 18 9 18C4.6 18 1 14.4 1 10C1 5.9 4 2.5 8 2.1C7.4 2.7 7 3.6 7 4.5C7 6.4 8.6 8 10.5 8C11.4 8 12.3 7.6 12.9 7C13.3 11 13.3 10.1 17 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="main-content">
        <CodeOptimizerTab />
      </main>
    </div>
  );
}
