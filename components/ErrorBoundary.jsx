'use client';

import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

/**
 * Generic React error boundary.
 *
 * Props:
 *   - fallbackTitle  (string)  — heading shown when a crash occurs
 *   - fallbackMessage (string) — explanatory text
 *   - section        (string)  — label used for analytics (e.g. 'results', 'search_input')
 *   - children       (node)
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.section || 'unknown'}]`, error, info);
    trackEvent('error_boundary_caught', {
      section: this.props.section || 'unknown',
      message: String(error?.message || '').slice(0, 200),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle || 'Something went wrong';
    const message =
      this.props.fallbackMessage ||
      'An unexpected error occurred in this section. You can try again or refresh the page.';

    return (
      <div className="surface p-5 md:p-6 text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-[var(--danger-50)] flex items-center justify-center">
            <AlertCircle size={20} className="text-[var(--danger-600)]" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-title)]">{title}</h3>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">{message}</p>
        <button
          onClick={this.handleRetry}
          className="btn btn-secondary px-4 py-2 text-sm mx-auto"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    );
  }
}
