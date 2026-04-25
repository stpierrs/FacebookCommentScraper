chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScraping') { sendResponse({ status: 'started' }); scrapeAllComments(); }
  if (request.action === 'ping') { sendResponse({ status: 'alive' }); }
});

async function scrapeAllComments() {
  try {
    sendStatus('Expanding all comments and replies...', 'loading');
    await expandAll();
    sendStatus('Extracting comment data...', 'loading');
    const data = extractComments();
    console.log('Extracted data:', data);
    if (data.length === 0) {
      sendStatus('No comments found. Scroll to the comments section first, then try again.', 'error');
      return;
    }
    sendStatus('Downloading CSV...', 'loading');
    exportCSV(data);
    saveStats(data);
    const comments = data.filter(d => d['Type'] === 'Comment').length;
    const replies  = data.filter(d => d['Type'] === 'Reply').length;
    sendStatus('COMPLETE - ' + comments + ' comments, ' + replies + ' replies exported', 'success', { comments, replies, progress: 100 });
  } catch (err) {
    console.error('Scraper error:', err);
    sendStatus('ERROR: ' + err.message, 'error');
  }
}

async function expandAll() {
  let lastCount = 0, stableRounds = 0, pass = 0;
  while (stableRounds < 4 && pass < 50) {
    pass++;
    let clicked = 0;
    const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
    console.log('Pass ' + pass + ': Found ' + buttons.length + ' buttons');
    for (const btn of buttons) {
      const t = (btn.innerText || '').toLowerCase().trim();
      if (/view \d+ repl/i.test(t) || /^\d+ repl/i.test(t) || t.includes('view more repl') || t.includes('more repl') || t.includes('view more comment') || t.includes('more comment') || t.includes('previous comment') || t.includes('see more')) {
        try { btn.click(); clicked++; await sleep(700); } catch(e) {}
      }
    }
    window.scrollBy(0, 900);
    await sleep(1300);
    const count = document.querySelectorAll('a[href*="comment_id="]').length;
    console.log('Pass ' + pass + ': ' + count + ' comments found, clicked ' + clicked + ' buttons');
    sendStatus('Loading... ' + count + ' items found', 'loading', { comments: count, replies: 0, progress: Math.min(80, pass * 2) });
    if (count === lastCount && clicked === 0) stableRounds++;
    else stableRounds = 0;
    lastCount = count;
  }
}

function extractComments() {
  const results = [], seen = new Set();
  const links = Array.from(document.querySelectorAll('a[href*="comment_id="]'));
  console.log('Found ' + links.length + ' comment_id links');
  for (const link of links) {
    try {
      const href = link.href || '';
      if (!href.includes('comment_id=')) continue;
      const isReply = href.includes('reply_comment_id=');
      const commentIdMatch = href.match(/[?&]comment_id=(\d+)/);
      const replyIdMatch   = href.match(/[?&]reply_comment_id=(\d+)/);
      const commentId = replyIdMatch ? replyIdMatch[1] : (commentIdMatch ? commentIdMatch[1] : '');
      const parentId  = isReply && commentIdMatch ? commentIdMatch[1] : '';
      if (!commentId || seen.has(commentId)) continue;
      seen.add(commentId);
      const fullTimestamp     = link.getAttribute('aria-label') || '';
      const relativeTimestamp = (link.innerText || '').trim();
      const bubble = findCommentBubble(link);
      if (!bubble) continue;
      const text = getCommentText(bubble);
      if (!text) continue;
      const author = getAuthorName(bubble, link);
      const likes  = getLikeCount(bubble);
      results.push({
        'Type': isReply ? 'Reply' : 'Comment',
        'Author': author,
        'Comment': text,
        'Full Timestamp': fullTimestamp,
        'Relative Time': relativeTimestamp,
        'Likes': likes,
        'Comment ID': commentId,
        'Parent Comment ID': parentId
      });
    } catch (e) { console.error('Extract error:', e); }
  }
  console.log('Extracted ' + results.length + ' items total');
  return results;
}

function findCommentBubble(timestampLink) {
  let el = timestampLink.parentElement;
  for (let i = 0; i < 12; i++) {
    if (!el) return null;
    const dirAuto = el.querySelector('[dir="auto"]');
    if (dirAuto && (dirAuto.innerText || '').trim().length > 2) {
      const authorLink = el.querySelector('a[href*="facebook.com"], a[href^="/"]');
      if (authorLink) return el;
    }
    el = el.parentElement;
  }
  return null;
}

function getCommentText(bubble) {
  const testId = bubble.querySelector('[data-testid="comment.text"]');
  if (testId) return (testId.innerText || '').trim();
  const candidates = Array.from(bubble.querySelectorAll('[dir="auto"]'));
  let best = '';
  for (const el of candidates) {
    if (el.querySelector('[role="button"]')) continue;
    const text = (el.innerText || '').trim();
    if (text.length > best.length) best = text;
  }
  return best;
}

function getAuthorName(bubble, timestampLink) {
  const testId = bubble.querySelector('[data-testid="comment.author"]');
  if (testId) return (testId.innerText || '').trim();
  const links = Array.from(bubble.querySelectorAll('a[href*="facebook.com"], a[href^="/"]'));
  for (const a of links) {
    if (a === timestampLink) continue;
    if ((a.href || '').includes('comment_id=')) continue;
    const text = (a.innerText || '').trim();
    if (text.length > 1 && !/^\d+[smhd]$/.test(text)) return text;
  }
  return 'Unknown';
}

function getLikeCount(bubble) {
  const sels = ['[aria-label*="reaction"]','[aria-label*="like"]','[data-testid*="reaction"]','[data-testid*="like"]'];
  for (const sel of sels) {
    const el = bubble.querySelector(sel);
    if (el) { const m = (el.innerText || el.getAttribute('aria-label') || '').match(/\d+/); if (m) return m[0]; }
  }
  return '0';
}

function exportCSV(data) {
  if (!data.length) {
    console.error('No data to export');
    return;
  }
  const headers = Object.keys(data[0]);
  const rows = [headers.join(',')];
  for (const row of data) {
    rows.push(headers.map(h => '"' + String(row[h] || '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"').join(','));
  }
  const csv = '\uFEFF' + rows.join('\r\n');
  console.log('CSV content length:', csv.length);
  console.log('CSV preview:', csv.substring(0, 200));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  console.log('Blob size:', blob.size);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fb_comments_' + Date.now() + '.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  console.log('Triggering download:', a.download);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function saveStats(data) {
  chrome.storage.local.set({ stats: { comments: data.filter(d=>d['Type']==='Comment').length, replies: data.filter(d=>d['Type']==='Reply').length, progress: 100, timestamp: new Date().toISOString() } });
}

function sendStatus(message, type, stats) {
  console.log('sendStatus:', message, type, stats);
  chrome.runtime.sendMessage({ action: 'updateStatus', message, type, stats: stats || {} }).catch((e) => { console.error('Message send failed:', e); });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
