import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 border border-red-100">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Algo salió mal</h2>
            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-mono overflow-auto max-h-64">
              {this.state.error?.message}
            </div>
            <button
              className="mt-6 w-full bg-zinc-900 text-white py-2 px-4 rounded-xl font-medium hover:bg-zinc-800 transition-colors"
              onClick={() => window.location.reload()}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
