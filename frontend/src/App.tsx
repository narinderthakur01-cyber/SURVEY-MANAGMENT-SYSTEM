import { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertCircle, RefreshCw, Server, Globe } from 'lucide-react';

interface BackendHealth {
  status: string;
  environment: string;
  timestamp: string;
  version: string;
}

export default function App() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: BackendHealth = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to backend';
      setError(message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-600 rounded-lg text-white">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Survey & Live Field Workforce Tracking
              </h1>
              <p className="text-xs text-slate-500">System Architecture Foundation — Phase 0</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Phase 0 Initialized
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full">
        {/* Welcome Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            System Initialization & Environment Verification
          </h2>
          <p className="text-slate-600 text-sm mb-4">
            This screen verifies end-to-end integration between the React/TypeScript/Tailwind frontend and the FastAPI backend.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Frontend Card */}
            <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
              <div className="flex items-center space-x-3 mb-3">
                <Globe className="w-5 h-5 text-sky-600" />
                <h3 className="font-semibold text-slate-900">Frontend Client</h3>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li><strong className="text-slate-700">Framework:</strong> React 18 + Vite</li>
                <li><strong className="text-slate-700">Language:</strong> TypeScript (Strict)</li>
                <li><strong className="text-slate-700">Styling:</strong> Tailwind CSS</li>
                <li><strong className="text-slate-700">Status:</strong> Operational & Rendered</li>
              </ul>
            </div>

            {/* Backend Card */}
            <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Server className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-slate-900">FastAPI Backend</h3>
                </div>
                <button
                  onClick={checkHealth}
                  disabled={loading}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors disabled:opacity-50"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loading && (
                <div className="text-xs text-slate-500 py-3">Connecting to backend /api/v1/health...</div>
              )}

              {error && (
                <div className="rounded-md bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Backend Unreachable</p>
                    <p className="mt-0.5">{error}</p>
                    <p className="text-slate-500 mt-1">Start uvicorn: <code className="bg-amber-100 px-1 py-0.5 rounded">uvicorn app.main:app --port 8000</code></p>
                  </div>
                </div>
              )}

              {health && (
                <div className="rounded-md bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-900">
                  <div className="flex items-center space-x-1.5 font-semibold text-emerald-700 mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Health Check Status: {health.status.toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div><span className="font-medium text-slate-700">Environment:</span> {health.environment}</div>
                    <div><span className="font-medium text-slate-700">API Version:</span> v{health.version}</div>
                    <div className="col-span-2 text-slate-500 truncate">
                      <span className="font-medium text-slate-700">Timestamp:</span> {health.timestamp}
                    </div>
                  </div>
                  {lastChecked && (
                    <div className="text-[10px] text-slate-400 mt-2 border-t border-emerald-200/50 pt-1">
                      Last verified at {lastChecked.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-500">
          Survey Management & Live Field Workforce Tracking System &bull; Phase 0 Foundation Complete
        </div>
      </footer>
    </div>
  );
}
