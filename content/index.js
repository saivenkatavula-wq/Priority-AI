// Entry point: dynamically import ES modules so we can keep this script non-module.
(async () => {
  const [aiBridge, annotator, ui] = await Promise.all([
    import(chrome.runtime.getURL('content/ai-bridge.js')),
    import(chrome.runtime.getURL('content/annotator.js')),
    import(chrome.runtime.getURL('content/ui.js')),
  ]);

  const handleStatusChange = (status) => {
    annotator.annotatePage();
    ui.updateBanner(status, () => aiBridge.requestEnableAI());
  };

  aiBridge.initAIBridge({ onStatusChange: handleStatusChange });
  ui.updateBanner(aiBridge.getAIStatus(), () => aiBridge.requestEnableAI());

  const main = document.querySelector('div[role="main"]') || document.body;
  const observer = new MutationObserver(annotator.handleMutations);
  observer.observe(main, { childList: true, subtree: true });

  annotator.annotatePage();
  aiBridge.probeAIAvailability();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.enableAI) {
      aiBridge.requestEnableAI();
    }
    if (msg?.getStatus) {
      sendResponse(aiBridge.getAIStatus());
    }
  });
})();
