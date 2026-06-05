import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Capture les erreurs de rendu React pour éviter l'écran blanc.
 * Affiche un écran de secours et permet de recharger l'application.
 * Si Sentry est configuré (window.__SENTRY__), l'erreur lui est transmise.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Remonte vers Sentry si présent, sinon console.
    const sentry = (window as unknown as { Sentry?: { captureException: (e: unknown, c?: unknown) => void } }).Sentry;
    if (sentry) {
      sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    } else {
      console.error('Erreur non gérée :', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-app text-text flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-2xl font-semibold">Une erreur est survenue</div>
          <p className="text-dim text-sm max-w-md">
            L'application a rencontré un problème inattendu. Tu peux recharger la page ; si le problème persiste,
            préviens l'équipe technique.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-cta text-text px-5 py-3 rounded-xl font-semibold"
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
