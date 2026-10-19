"use client";

// Last resort: the root layout itself failed, so there is no app chrome, no Tailwind
// theme and no fonts to lean on. Plain inline styles only.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#12151c", color: "#edebe6", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>NextStamp hit a problem</h1>
          <p style={{ maxWidth: 380, opacity: 0.75, lineHeight: 1.5 }}>
            Nothing you saved was lost. Try again, and if it keeps happening, come back in a few minutes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 12, padding: "12px 24px", borderRadius: 999, border: 0, background: "#edebe6", color: "#12151c", fontSize: 16, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
