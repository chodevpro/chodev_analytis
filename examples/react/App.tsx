import { useEffect } from 'react';
import { init, pageview, track } from '@chodev/analytics';

export function App() {
  useEffect(() => {
    init({
      siteId: 'cda_prod_demo123',
      autoPageview: true,
    });
    pageview();
  }, []);

  return (
    <div>
      <h1>ChoDev Analytics in React SPA</h1>
      <button onClick={() => track('button_click', { buttonName: 'GetStarted' })}>
        Bắt đầu ngay
      </button>
    </div>
  );
}
