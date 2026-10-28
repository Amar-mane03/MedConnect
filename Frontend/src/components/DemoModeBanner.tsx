import { useEffect, useState } from 'react';
import API from '../api';

export default function DemoModeBanner() {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let active = true;
    API.get('/community/demo-status')
      .then((response) => {
        if (typeof response.data?.demoMode !== 'boolean') {
          throw new Error('The demo status endpoint returned an invalid response.');
        }
        if (active) setDemoMode(response.data.demoMode);
      })
      .catch((error: unknown) => {
        console.error('Unable to determine whether demo data is active:', error);
      });
    return () => { active = false; };
  }, []);

  if (!demoMode) return null;
  return (
    <div role="status" className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">
      Demo mode: sample organizations, camps, and activity are fictional test data—not real opportunities.
    </div>
  );
}
