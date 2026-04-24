document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');
  const commentCount = document.getElementById('commentCount');
  const replyCount = document.getElementById('replyCount');
  const progress = document.getElementById('progress');

  // Load saved data on popup open
  chrome.storage.local.get(['scrapedData', 'stats'], (result) => {
    if (result.stats) {
      commentCount.textContent = result.stats.comments || 0;
      replyCount.textContent = result.stats.replies || 0;
      progress.textContent = result.stats.progress + '%' || '0%';
    }
  });

  startBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url.includes('facebook.com')) {
      updateStatus('❌ Please navigate to a Facebook post first', 'error');
      return;
    }

    startBtn.disabled = true;
    updateStatus('🔄 Initializing scraper...', 'loading');

    // Send message to content script to start scraping
    chrome.tabs.sendMessage(currentTab.id, { action: 'startScraping' }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('❌ Error: ' + chrome.runtime.lastError.message, 'error');
        startBtn.disabled = false;
        return;
      }
      updateStatus('✅ Scraping started! This may take a few minutes...', 'loading');
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['scrapedData', 'stats'], () => {
      commentCount.textContent = '0';
      replyCount.textContent = '0';
      progress.textContent = '0%';
      updateStatus('✅ Data cleared', 'success');
      setTimeout(() => updateStatus('Ready to scrape...', 'idle'), 2000);
    });
  });

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStatus') {
      updateStatus(request.message, request.type);
      commentCount.textContent = request.stats?.comments || 0;
      replyCount.textContent = request.stats?.replies || 0;
      progress.textContent = request.stats?.progress + '%' || '0%';

      if (request.type === 'success') {
        startBtn.disabled = false;
      }
    }
  });

  function updateStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }
});
