"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[SonarAudio] Application rendering failed.", error.digest); }, [error]);
  return (
    <main className="error-page">
      <p className="eyebrow">SONARAUDIO</p>
      <h1>Something interrupted the studio.</h1>
      <p>Your words matter. Try reloading the studio to continue.</p>
      <button className="primary-button" onClick={reset}>Try again</button>
    </main>
  );
}
