// Content script that runs on Facebook pages

let allComments = [];
let isScrolling = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScraping') {
    sendResponse({ status: 'started' });
    scrapeCommentsAndReplies();
  }
});

async function scrapeCommentsAndReplies() {
  try {
    updateProgress('🔍 Finding comments section...', 'loading');
    
    // Scroll to load all comments
    await scrollAndLoadAllComments();
    
    updateProgress('📊 Extracting comment data...', 'loading');
    
    // Extract all comments and replies
    const commentsData = extractAllComments();
    
    updateProgress('💾 Generating Excel file...', 'loading');
    
    // Generate and download Excel file
    await generateAndDownloadExcel(commentsData);
    
    updateProgress('✅ Comments downloaded successfully!', 'success');
  } catch (error) {
    console.error('Scraping error:', error);
    updateProgress('❌ Error: ' + error.message, 'error');
  }
}

async function scrollAndLoadAllComments() {
  let lastHeight = document.body.scrollHeight;
  let noNewCommentsCount = 0;
  const maxNoNewCount = 5;
  let commentCount = 0;
  let replyCount = 0;

  while (noNewCommentsCount < maxNoNewCount) {
    // Scroll down
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait for new content to load
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check for "View more" buttons and click them
    const viewMoreButtons = document.querySelectorAll(
      '[aria-label*="View more"], [role="button"][aria-expanded="false"]'
    );
    
    for (let btn of viewMoreButtons) {
      if (btn.textContent.toLowerCase().includes('more')) {
        try {
          btn.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          // Button might not be clickable
        }
      }
    }
    
    // Count current comments
    const currentCommentCount = document.querySelectorAll(
      '[data-testid="post-comment"], .x1o934m2, .xu06os2'
    ).length;
    
    const newHeight = document.body.scrollHeight;
    
    if (newHeight === lastHeight) {
      noNewCommentsCount++;
    } else {
      noNewCommentsCount = 0;
    }
    
    lastHeight = newHeight;
    
    // Update progress
    const progressPercent = Math.min(100, noNewCommentsCount * 20);
    updateProgress(
      `📄 Loading comments... (${currentCommentCount} comments found)`,
      'loading',
      { comments: currentCommentCount, replies: 0, progress: progressPercent }
    );
  }
}

function extractAllComments() {
  const comments = [];
  const commentElements = document.querySelectorAll(
    '[data-testid="post-comment"], .x1o934m2'
  );

  commentElements.forEach((elem, index) => {
    try {
      // Get commenter name
      const nameElem = elem.querySelector(
        'a[role="button"] > div > div:first-child, [data-testid="comment.author"]'
      );
      const name = nameElem?.textContent?.trim() || 'Unknown';

      // Get comment text
      const textElem = elem.querySelector(
        '[data-testid="comment.text"], [role="article"] > div > div > div:last-child'
      );
      const text = textElem?.textContent?.trim() || '';

      // Get timestamp
      const timeElem = elem.querySelector('abbr, [data-utime]');
      const timestamp = timeElem?.textContent?.trim() || timeElem?.getAttribute('aria-label') || '';

      // Get like count
      const likeElem = elem.querySelector('[data-testid="UFI2ReactionsCount"]');
      const likes = likeElem?.textContent?.trim() || '0';

      // Get replies
      const replies = [];
      const replySection = elem.querySelector('[data-testid="comment_replies_container"]');
      
      if (replySection) {
        const replyElements = replySection.querySelectorAll('[data-testid="post-comment"]');
        replyElements.forEach(replyElem => {
          try {
            const replyName = replyElem.querySelector('a[role="button"] > div')?.textContent?.trim() || 'Unknown';
            const replyText = replyElem.querySelector('[data-testid="comment.text"]')?.textContent?.trim() || '';
            const replyTime = replyElem.querySelector('abbr')?.textContent?.trim() || '';
            const replyLikes = replyElem.querySelector('[data-testid="UFI2ReactionsCount"]')?.textContent?.trim() || '0';

            if (replyText) {
              replies.push({
                name: replyName,
                text: replyText,
                timestamp: replyTime,
                likes: replyLikes
              });
            }
          } catch (e) {
            // Skip malformed replies
          }
        });
      }

      if (text) {
        comments.push({
          type: 'Comment',
          name,
          text,
          timestamp,
          likes,
          replies: replies.length
        });

        // Add replies as individual rows
        replies.forEach(reply => {
          comments.push({
            type: 'Reply',
            name: reply.name,
            text: reply.text,
            timestamp: reply.timestamp,
            likes: reply.likes,
            replies: 0
          });
        });
      }
    } catch (e) {
      console.error('Error extracting comment:', e);
    }
  });

  return comments;
}

async function generateAndDownloadExcel(commentsData) {
  // Check if XLSX library is available, if not use CSV fallback
  const csvContent = generateCSV(commentsData);
  
  // Try to use XLSX if available
  if (typeof XLSX !== 'undefined') {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(commentsData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comments');
    
    const fileName = `facebook_comments_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  } else {
    // Fallback to CSV download
    downloadCSV(csvContent);
  }
  
  // Save to storage for reference
  chrome.storage.local.set({
    scrapedData: commentsData,
    stats: {
      comments: commentsData.filter(c => c.type === 'Comment').length,
      replies: commentsData.filter(c => c.type === 'Reply').length,
      progress: 100,
      timestamp: new Date().toISOString()
    }
  });
}

function generateCSV(data) {
  const headers = ['Type', 'Author', 'Comment', 'Timestamp', 'Likes', 'Reply Count'];
  const rows = [headers.map(h => `"${h}"`).join(',')];

  data.forEach(item => {
    const row = [
      item.type,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.text.replace(/"/g, '""')}"`,
      item.timestamp,
      item.likes,
      item.replies
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

function downloadCSV(csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `facebook_comments_${new Date().getTime()}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updateProgress(message, type, stats = {}) {
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    message,
    type,
    stats: stats || {}
  }).catch(() => {
    // Popup might be closed, ignore error
  });
}