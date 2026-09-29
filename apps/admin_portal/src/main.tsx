import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';
import './i18n/i18n';

// Error monitoring activates only when a DSN is provided at build time
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorBoundaryFallback />}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename="/">
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

// Sentry's boundary wraps ours so errors reach both: remote capture + branded UI.
function ErrorBoundaryFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-xs text-slate-400">The error has been reported. Please reload the page.</p>
      </div>
    </div>
  );
}
