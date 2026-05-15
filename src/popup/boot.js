function showPopupBootError(error) {
  const root = document.getElementById('root');
  const message = error instanceof Error ? error.message : String(error);

  if (!root) {
    return;
  }

  root.innerHTML = `
    <main style="
      min-height: 540px;
      width: 360px;
      margin: 0;
      padding: 16px;
      background: #09090b;
      color: #f4f4f5;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <h1 style="margin: 0 0 8px; font-size: 16px;">Popup failed to start</h1>
      <p style="margin: 0 0 12px; color: #a1a1aa; font-size: 13px; line-height: 1.5;">
        Rebuild the extension and load the <strong>dist</strong> folder in Chrome.
      </p>
      <pre style="
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        margin: 0;
        padding: 10px;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        background: #18181b;
        color: #fca5a5;
        font-size: 11px;
        line-height: 1.5;
      "></pre>
    </main>
  `;

  const pre = root.querySelector('pre');

  if (pre) {
    pre.textContent = message;
  }
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const existingLink = document.querySelector(`link[href="${href}"]`);

    if (existingLink) {
      resolve();
      return;
    }

    const link = document.createElement('link');

    link.href = href;
    link.rel = 'stylesheet';
    link.onload = resolve;
    link.onerror = () => reject(new Error(`Unable to load ${href}`));

    document.head.appendChild(link);
  });
}

async function loadBuiltPopupFromSourceFolder() {
  await loadStylesheet('/dist/assets/popup.css');
  await import(/* @vite-ignore */ '/dist/assets/popup.js');
}

const isChromeExtensionPage = window.location.protocol === 'chrome-extension:';
const isSourceFolderPopup = import.meta.url.includes('/src/popup/boot.js');

if (isChromeExtensionPage && isSourceFolderPopup) {
  loadBuiltPopupFromSourceFolder().catch(() => {
    showPopupBootError(
      new Error(
        'The extension is loaded from the source folder and built popup assets were not found. Run "pnpm build:extension", then load the "dist" folder in chrome://extensions.',
      ),
    );
  });
} else {
  import('./main.jsx').catch(showPopupBootError);
}
