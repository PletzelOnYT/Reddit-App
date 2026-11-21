import './index.css';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Answer = 'YES' | 'NO' | '?';

type ShopStatus = {
  inStock: boolean;
};

function App() {
  const [answer, setAnswer] = useState<Answer>('?');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Shop status unavailable');
      const data = await response.json() as ShopStatus;
      setAnswer(data.inStock ? 'YES' : 'NO');
    } catch {
      // Never show NO when the API is blocked or unavailable.
      setAnswer('?');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stateClass = answer === 'YES' ? 'yes' : answer === 'NO' ? 'no' : 'unknown';

  return (
    <main className="widget-stage">
      <section
        className="status-widget"
        aria-live="polite"
        aria-label={`Is Spice Skin in stock?: ${answer}`}
      >
        <span className="question">Is Spice Skin in stock?</span>
        <span className={`answer ${stateClass}`}>{answer}</span>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
