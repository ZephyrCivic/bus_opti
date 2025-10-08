/**
 * src/components/layout/ErrorBoundary.tsx
 * Wraps main application panes to isolate runtime errors and show a friendly fallback with toast notification.
 */
import { Component, type ReactNode } from 'react';
import { toast } from 'sonner';

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: unknown): void {
    // toast may throw if document is unavailable (e.g., SSR); guard the call.
    try {
      toast.error('画面の描画中にエラーが発生しました。再読み込みで復帰できます。', {
        description: error.message,
      });
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', error, errorInfo);
      }
    } catch (_) {
      // ignore toast failures
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
            <p>このビューの描画でエラーが発生しました。</p>
            <p>ページを再読み込みしてもう一度お試しください。</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
