const ERROR_SCOPE = '[Productivity Tracker][dashboard]';

function showDashboardBootError(error) {
  const root = document.getElementById('root');
  const message = error instanceof Error ? error.message : String(error);

  if (!root) {
    return;
  }

  root.innerHTML = `
    <main style="
      min-height: 100vh;
      margin: 0;
      padding: 32px;
      background: #09090b;
      color: #f4f4f5;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <section style="
        max-width: 720px;
        border: 1px solid #27272a;
        border-radius: 8px;
        background: #18181b;
        padding: 20px;
      ">
        <p style="margin: 0 0 8px; color: #71717a; font-size: 12px; text-transform: uppercase;">
          Productivity Tracker
        </p>
        <h1 style="margin: 0 0 10px; font-size: 24px;">Dashboard failed to start</h1>
        <p style="margin: 0 0 16px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
          This dashboard is a Vite/Chrome Extension page, so it should not be opened directly with <strong>file://</strong>.
        </p>
        <pre style="
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          margin: 0;
          padding: 12px;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          background: #09090b;
          color: #fca5a5;
          font-size: 12px;
          line-height: 1.6;
        "></pre>
      </section>
    </main>
  `;

  const pre = root.querySelector('pre');

  if (pre) {
    pre.textContent = message;
  }
}

async function loadBuiltDashboardFromSourceFolder() {
  await import(/* @vite-ignore */ '/dist/assets/dashboard.js');
}

window.addEventListener('error', (event) => {
  console.error(`${ERROR_SCOPE} window error`, {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(`${ERROR_SCOPE} unhandled promise rejection`, event.reason);
});

const isFilePage = window.location.protocol === 'file:';
const isChromeExtensionPage = window.location.protocol === 'chrome-extension:';
const isSourceFolderDashboard = import.meta.url.includes('/src/dashboard/boot.js');

if (isFilePage) {
  showDashboardBootError(
    new Error(
      'Open the dashboard through Vite or Chrome Extension options instead.\n\nDevelopment preview:\npnpm dev\nhttp://localhost:5173/dashboard.html\n\nExtension test:\npnpm build:extension\nchrome://extensions -> Reload Productivity Tracker -> Details -> Extension options',
    ),
  );
} else if (isChromeExtensionPage && isSourceFolderDashboard) {
  loadBuiltDashboardFromSourceFolder().catch((error) => {
    console.error(`${ERROR_SCOPE} failed to load built dashboard`, error);
    showDashboardBootError(
      new Error(
        `The extension is loaded from the source folder, but the built dashboard assets could not be loaded.\n\nRun "pnpm build:extension", reload the extension, then open Extension options.\n\nOriginal error: ${error.message}`,
      ),
    );
  });
} else {
  import('./main.jsx').catch((error) => {
    console.error(`${ERROR_SCOPE} failed to load dashboard main module`, error);
    showDashboardBootError(error);
  });
}
