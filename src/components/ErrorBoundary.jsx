export default function ErrorBoundary() {
  return (
    <div className="min-h-app flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mt-2">
          The app failed to load. Please reload the page and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-11 px-6 items-center justify-center rounded-full bg-primary text-white text-sm font-medium"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
