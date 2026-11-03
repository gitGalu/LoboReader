import React, { useEffect, useState } from 'react';
import { ThemeProvider } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import readerTheme from './readerTheme';

// Opening an issue normally takes 1–3 s (up to ~5 s when archive.org is slow).
// Past this, offer a way out: the manifest request has no timeout and can hang,
// and an installed iOS app has no back gesture to escape the overlay.
export const SLOW_LAUNCH_MS = 8000;

function ReaderLaunchOverlay({ onCancel }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_LAUNCH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider theme={readerTheme}>
      <div className="readerLaunchOverlay" role="status" aria-live="polite">
        <span className="loadingSpinner" aria-hidden="true" />
        <span>Loading...</span>
        {slow && (
          <div className="readerLaunchSlow">
            <span>This is taking longer than usual.</span>
            <Button type="button" kind={KIND.secondary} size={SIZE.compact} onClick={onCancel}>
              Go back
            </Button>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default ReaderLaunchOverlay;
