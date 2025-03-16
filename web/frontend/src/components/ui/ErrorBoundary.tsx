'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  /** Child components that this boundary will catch errors for */
  children: ReactNode;
  /** Optional fallback component to display when an error occurs */
  fallback?: ReactNode;
}

interface State {
  /** Whether an error has been caught */
  hasError: boolean;
}

/**
 * A simplified error boundary component that catches errors in its child tree
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg text-red-800 font-medium">Something went wrong</h2>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded-md text-sm"
          >
            Try again
          </button>
        </div>
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary; 