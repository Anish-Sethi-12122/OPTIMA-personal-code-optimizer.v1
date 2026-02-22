import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 600,
            margin: '40px auto',
            fontFamily: 'system-ui, sans-serif',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            color: '#991b1b',
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Something went wrong</h2>
          <pre
            style={{
              margin: 0,
              fontSize: 13,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: '#b91c1c' }}>
            Check the browser console for details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
