function init() {
  const startBtn = document.getElementById('startBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');
  const commentCount = document.getElementById('commentCount');
  const replyCount = document.getElementById('replyCount');
  const progress = document.getElementById('progress');

  chrome.storage.local.get(['stats'], (result) => {
    if (result.stats) {
      commentCount.textContent = result.stats.comments || 0;
      replyCount.textContent = result.stats.replies || 0;
      progress.textContent = (result.stats.progress || 0) + '%';
    }
  });

  startBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url.includes('facebook.com')) {
      updateStatus('ERROR: Navigate to a Facebook post first', 'error');
      return;
    }

    startBtn.disabled = true;
    updateStatus('INITIALIZING...', 'loading');

    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['content.js']
      });
    } catch (e) {}

    await new Promise(resolve => setTimeout(resolve, 300));

    chrome.tabs.sendMessage(currentTab.id, { action: 'startScraping' }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('ERROR: ' + chrome.runtime.lastError.message, 'error');
        startBtn.disabled = false;
        return;
      }
      updateStatus('SCANNING IN PROGRESS...', 'loading');
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['scrapedData', 'stats'], () => {
      commentCount.textContent = '0';
      replyCount.textContent = '0';
      progress.textContent = '0%';
      updateStatus('DATA CLEARED', 'success');
      setTimeout(() => updateStatus('SYSTEM READY — AWAITING INPUT', 'idle'), 2000);
    });
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'updateStatus') {
      updateStatus(request.message, request.type);
      if (request.stats) {
        commentCount.textContent = request.stats.comments || 0;
        replyCount.textContent = request.stats.replies || 0;
        progress.textContent = (request.stats.progress || 0) + '%';
      }
      if (request.type === 'success' || request.type === 'error') {
        startBtn.disabled = false;
      }
    }
  });

  function updateStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type || 'idle';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}