chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScraping') { sendResponse({ status: 'started' }); scrapeAllComments(); }
  if (request.action === 'ping') { sendResponse({ status: 'alive' }); }
});

async function scrapeAllComments() {
  try {
    sendStatus('Auto-expanding all comments, replies, and nested replies...', 'loading');
    await autoExpandAll();
    
    sendStatus('Extracting all comment data...', 'loading');
    const data = extractAllCommentData();
    console.log('Total extracted:', data.length);
    
    if (data.length === 0) {
      sendStatus('No comments found. Scroll to comments section and try again.', 'error');
      return;
    }
    
    sendStatus('Exporting CSV with ' + data.length + ' items...', 'loading');
    exportCSV(data);
    saveStats(data);
    
    const comments = data.filter(d => d['Type'] === 'Comment').length;
    const replies = data.filter(d => d['Type'] === 'Reply').length;
    const nestedReplies = data.filter(d => d['Type'] === 'Nested Reply').length;
    
    sendStatus('COMPLETE - ' + comments + ' comments, ' + replies + ' replies, ' + nestedReplies + ' nested replies', 'success', { 
      comments: comments + replies + nestedReplies, 
      replies: 0, 
      progress: 100 
    });
  } catch (err) {
    console.error('Scraper error:', err);
    sendStatus('ERROR: ' + err.message, 'error');
  }
}

async function autoExpandAll() {
  let expandedCount = 0;
  let lastExpandedCount = 0;
  let stableRounds = 0;
  let pass = 0;
  
  while (stableRounds < 6 && pass < 100) {
    pass++;
    expandedCount = 0;
    
    // Click all "View replies", "View more replies", "Previous comments", etc.
    const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
    
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
      
      // Match reply/comment expansion buttons
      if (/view.*repl|repl.*comment|more.*repl|more.*comment|previous.*comment|see more|view more/i.test(text)) {
        try {
          btn.click();
          expandedCount++;
          await sleep(400);
        } catch (e) {}
      }
    }
    
    // Scroll to reveal more content
    window.scrollBy(0, 1200);
    await sleep(1500);
    
    // Count visible comments to track progress
    const commentCount = document.querySelectorAll('[data-testid="comment_box"]').length;
    const progress = Math.min(85, pass * 2);
    sendStatus('Pass ' + pass + ': Expanded ' + expandedCount + ' sections, ' + commentCount + ' comments visible', 'loading', { 
      comments: commentCount, 
      replies: 0, 
      progress: progress 
    });
    
    console.log('Pass ' + pass + ': Clicked ' + expandedCount + ' buttons');
    
    if (expandedCount === lastExpandedCount && expandedCount === 0) {
      stableRounds++;
    } else {
      stableRounds = 0;
    }
    lastExpandedCount = expandedCount;
    
    await sleep(800);
  }
  
  console.log('Auto-expand complete after ' + pass + ' passes');
}

function extractAllCommentData() {
  const results = [];
  const seenIds = new Set();
  
  // Get all comment boxes
  const commentBoxes = document.querySelectorAll('[data-testid="comment_box"]');
  console.log('Found ' + commentBoxes.length + ' comment boxes');
  
  let commentIndex = 0;
  
  for (const box of commentBoxes) {
    try {
      const data = extractCommentFromBox(box, null);
      if (data) {
        if (!seenIds.has(data['ID'])) {
          seenIds.add(data['ID']);
          data['Type'] = 'Comment';
          results.push(data);
          commentIndex++;
          
          // Extract all replies to this comment
          const replyBoxes = box.querySelectorAll('[data-testid="comment_box"]');
          let replyIndex = 0;
          
          for (const replyBox of replyBoxes) {
            if (replyBox === box) continue; // Skip the parent
            
            try {
              const replyData = extractCommentFromBox(replyBox, data['ID']);
              if (replyData && !seenIds.has(replyData['ID'])) {
                seenIds.add(replyData['ID']);
                
                // Check if this is a nested reply
                const nestedBoxes = replyBox.querySelectorAll('[data-testid="comment_box"]');
                if (nestedBoxes.length > 0) {
                  replyData['Type'] = 'Nested Reply';
                  
                  // Extract nested replies
                  for (const nestedBox of nestedBoxes) {
                    if (nestedBox === replyBox) continue;
                    
                    try {
                      const nestedData = extractCommentFromBox(nestedBox, replyData['ID']);
                      if (nestedData && !seenIds.has(nestedData['ID'])) {
                        seenIds.add(nestedData['ID']);
                        nestedData['Type'] = 'Nested Reply';
                        nestedData['Parent ID'] = replyData['ID'];
                        results.push(nestedData);
                      }
                    } catch (e) { console.error('Nested reply error:', e); }
                  }
                } else {
                  replyData['Type'] = 'Reply';
                }
                
                replyData['Parent ID'] = data['ID'];
                results.push(replyData);
                replyIndex++;
              }
            } catch (e) { console.error('Reply error:', e); }
          }
        }
      }
    } catch (e) { console.error('Comment error:', e); }
  }
  
  console.log('Extracted ' + results.length + ' total items');
  return results;
}

function extractCommentFromBox(box, parentId) {
  try {
    // Get unique ID from comment link
    const commentLink = box.querySelector('a[href*="comment_id="]');
    if (!commentLink) return null;
    
    const href = commentLink.href || '';
    const idMatch = href.match(/comment_id=(\d+)/);
    if (!idMatch) return null;
    
    const commentId = idMatch[1];
    
    // Get author name
    const authorLink = box.querySelector('a[role="button"]');
    const author = authorLink ? (authorLink.textContent || '').trim() : 'Unknown';
    
    // Get comment text - look for the largest text block
    let commentText = '';
    const textDivs = box.querySelectorAll('[dir="auto"]');
    for (const div of textDivs) {
      const text = (div.innerText || '').trim();
      // Skip short text (likely metadata)
      if (text.length > commentText.length && text.length > 5) {
        commentText = text;
      }
    }
    
    if (!commentText) {
      // Fallback: get any remaining text
      commentText = (box.innerText || '').substring(0, 500);
    }
    
    // Get timestamp
    const timeLink = box.querySelector('a[href*="comment_id="]');
    const timestamp = timeLink ? (timeLink.getAttribute('aria-label') || '') : '';
    const relativeTime = timeLink ? (timeLink.innerText || '') : '';
    
    // Get like count
    let likes = '0';
    const likeElements = box.querySelectorAll('[role="button"]');
    for (const el of likeElements) {
      const text = (el.textContent || '').trim();
      if (/^\d+$/.test(text) && parseInt(text) > 0) {
        likes = text;
        break;
      }
    }
    
    // Clean up comment text - remove author name if included
    if (commentText.startsWith(author)) {
      commentText = commentText.substring(author.length).trim();
    }
    
    return {
      'ID': commentId,
      'Author': author,
      'Comment': commentText.substring(0, 10000), // Limit text length
      'Timestamp': timestamp,
      'Relative Time': relativeTime,
      'Likes': likes,
      'Parent ID': parentId || ''
    };
  } catch (e) {
    console.error('Extract error:', e);
    return null;
  }
}

function exportCSV(data) {
  if (!data.length) {
    console.error('No data to export');
    return;
  }
  
  const headers = ['Type', 'Author', 'Comment', 'Timestamp', 'Relative Time', 'Likes', 'ID', 'Parent ID'];
  const rows = [headers.join(',')];
  
  for (const row of data) {
    const values = [
      row['Type'] || '',
      '"' + (row['Author'] || '').replace(/"/g, '""') + '"',
      '"' + (row['Comment'] || '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"',
      '"' + (row['Timestamp'] || '').replace(/"/g, '""') + '"',
      '"' + (row['Relative Time'] || '').replace(/"/g, '""') + '"',
      row['Likes'] || '0',
      row['ID'] || '',
      row['Parent ID'] || ''
    ];
    rows.push(values.join(','));
  }
  
  const csv = '\uFEFF' + rows.join('\r\n');
  console.log('CSV rows: ' + rows.length + ', size: ' + csv.length + ' bytes');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'facebook_comments_' + Date.now() + '.csv';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  console.log('Downloading: ' + link.download);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

function saveStats(data) {
  const comments = data.filter(d => d['Type'] === 'Comment').length;
  const replies = data.filter(d => d['Type'] === 'Reply').length;
  const nested = data.filter(d => d['Type'] === 'Nested Reply').length;
  chrome.storage.local.set({ 
    stats: { 
      comments: comments + replies + nested,
      replies: 0, 
      progress: 100, 
      timestamp: new Date().toISOString() 
    } 
  });
}

function sendStatus(message, type, stats) {
  console.log('Status:', message);
  chrome.runtime.sendMessage({ action: 'updateStatus', message, type, stats: stats || {} }).catch((e) => { console.error('Message error:', e); });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
