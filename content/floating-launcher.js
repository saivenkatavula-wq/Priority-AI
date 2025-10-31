(async () => {
  try {
    const { initFloatingLauncher } = await import(
      chrome.runtime.getURL('content/floating/main.js')
    );
    await initFloatingLauncher();
  } catch (error) {
    console.error('[Gmail Priority AI] Failed to initialise floating launcher', error);
  }
})();
