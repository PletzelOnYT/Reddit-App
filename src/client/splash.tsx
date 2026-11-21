import './index.css';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type ShopStatus = {
  inStock: boolean;
  name: string;
  price: number | null;
  shopDate: string | null;
  lastCheckedAt: string;
};

function prettyDate(value: string | null): string {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function App() {
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check the Fortnite shop.');
      setStatus(data as ShopStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shop check failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const inStock = status?.inStock === true;
  const heading = busy && !status ? 'Checking…' : error && !status ? 'Unavailable' : inStock ? 'SPICE IS IN THE SHOP!' : 'Not in shop';

  return (
    <main className="app">
      <header className="header">
        <div className="brand">
          <div className="icon" aria-hidden="true">🎃</div>
          <div>
            <h1>Spice Shop Watch</h1>
            <p className="sub">Live Fortnite Item Shop tracker</p>
          </div>
        </div>
        <span className="pill">LIVE TRACKER</span>
      </header>

      <section className="card" aria-live="polite">
        <div className="kicker">Spice · Meow-o'-Lantern set</div>
        <div className="status">{heading}</div>
        <p className="copy">
          {error && !status
            ? 'The tracker could not reach the live shop service. Try again in a moment.'
            : inStock
              ? 'Spice is listed in the current Fortnite Item Shop. Open Fortnite and confirm the offer in-game.'
              : 'Spice is not listed in the latest shop data. The tracker checks automatically.'}
        </p>
        <div className="grid">
          <div className="meta">
            <span className="label">Current price</span>
            <span className="value">{inStock && status?.price !== null ? status?.price?.toLocaleString() + ' V-Bucks' : '—'}</span>
          </div>
          <div className="meta">
            <span className="label">Last shop rotation</span>
            <span className="value">{prettyDate(status?.shopDate ?? null)}</span>
          </div>
        </div>
        <div className="actions">
          <button onClick={() => void refresh()} disabled={busy}>{busy ? 'Checking…' : 'Check the shop now'}</button>
          <span className={error ? 'note error' : 'note'}>{error || (status ? 'Last checked ' + prettyDate(status.lastCheckedAt) : 'Waiting for first check')}</span>
        </div>
      </section>
      <p className="footer">The Reddit server checks the Fortnite-API shop feed every five minutes. This post refreshes its display every minute while open. Shop offers can change; confirm in-game before purchasing.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
