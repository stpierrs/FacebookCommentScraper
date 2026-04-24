// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Facebook Comment Scraper extension installed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('facebook.com')) {
    // Enable the action button on Facebook pages
    chrome.action.enable(tabId);
  }
});
