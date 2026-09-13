import React from 'react';
import { Logo } from '../shared/components/Logo';
import { logger } from '../shared/logging/logger';
import { captureException } from '../shared/logging/sentry';

interface State {
  hasError: boolean;
}

/**
 * Top-level error boundary: reports render crashes (Sentry when configured)
 * and shows a recovery UI.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error('Unhandled render error', error, info.componentStack);
    captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen surface-field">
          <div className="error-card panel">
            <Logo size={40} className="error-brand" />
            <h1>Something pulled the wrong way</h1>
            <p className="error-desc">
              A render error stopped the room. Your edits stay in this browser and will sync when you reload.
            </p>
            <button type="button" className="btn btn-primary error-reload" onClick={() => window.location.reload()}>
              Reload room
            </button>
            <a className="error-home" href="/">
              Back to home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
