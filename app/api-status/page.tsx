'use client';
import { useEffect, useState } from 'react';

interface EndpointStatus {
  [key: string]: {
    status: 'ok' | 'error';
    message?: string;
  };
}

interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  endpoints: EndpointStatus;
}

export default function ApiStatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className="space-y-5 p-6">
        <h1 className="text-2xl font-bold">Status API</h1>
        <p className="text-gray-500">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Status API</h1>
          <p className="text-sm text-gray-500">Monitoring dostępności wszystkich endpointów</p>
        </div>
        <button
          onClick={fetchHealth}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Odśwież
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {health && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Status systemu</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {health.status === 'healthy' ? '✓ Zdrowy' : '⚠ Degraded'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Ostatnia aktualizacja</p>
                <p className="text-sm font-mono text-gray-600 mt-1">
                  {new Date(health.timestamp).toLocaleString('pl-PL')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(health.endpoints).map(([name, ep]) => (
              <div
                key={name}
                className={`rounded-lg border p-4 ${
                  ep.status === 'ok'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </p>
                    <p
                      className={`text-sm font-semibold mt-1 ${
                        ep.status === 'ok'
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {ep.status === 'ok' ? '✓ OK' : '✗ Błąd'}
                    </p>
                  </div>
                </div>
                {ep.message && (
                  <p className="text-xs text-gray-600 mt-2 font-mono">
                    {ep.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
