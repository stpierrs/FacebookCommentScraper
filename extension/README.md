# Facebook Comment Scraper - Browser Extension

A Brave/Chrome browser extension that downloads all Facebook comments and replies from a post into an Excel file.

## Features

✨ **Complete Comment Scraping**
- Extracts all top-level comments
- Captures all replies to each comment
- Gets author names, comment text, timestamps, and like counts
- Automatically scrolls and loads all comments

📊 **Excel Export**
- Generates `.xlsx` files with organized data
- Fallback to `.csv` format
- Includes columns: Type, Author, Comment, Timestamp, Likes, Reply Count

🚀 **Easy to Use**
- Simple one-click interface
- Real-time progress tracking
- Auto-download to your default Downloads folder

## Installation

### For Brave Browser:

1. **Open Brave** and navigate to `brave://extensions/`
2. **Enable "Developer mode"** (top-right toggle)
3. **Click "Load unpacked"**
4. **Select the `extension/` folder** from this repository
5. The extension will appear in your toolbar

### For Chrome:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `extension/` folder

## Usage

1. **Navigate to a Facebook post** on facebook.com
2. **Click the extension icon** in your toolbar
3. **Click "🚀 Start Scraping"** button
4. **Wait** for the scraper to load all comments (may take 1-5 minutes depending on post popularity)
5. **File downloads automatically** as `facebook_comments_[timestamp].xlsx`

## What Gets Scraped

The extension captures:
- ✅ Comment author name
- ✅ Full comment text
- ✅ Timestamp
- ✅ Like count
- ✅ All replies to each comment
- ✅ Reply author, text, timestamp, and likes

## File Format

The exported Excel file contains columns:

| Type | Author | Comment | Timestamp | Likes | Reply Count |
|------|--------|---------|-----------|-------|-------------|
| Comment | John Doe | Great post! | 2 hours ago | 5 | 2 |
| Reply | Jane Smith | Thanks! | 1 hour ago | 1 | 0 |
| Reply | Bob Jones | I agree | 30 min ago | 0 | 0 |

## Technical Details

- **Manifest Version**: 3 (latest Chrome/Brave standard)
- **Libraries**: XLSX.js for Excel generation (fallback to CSV)
- **Storage**: Uses Chrome storage API to cache data
- **Performance**: Optimized scrolling and element detection

## Limitations

- Facebook comment selectors may change - extension may need updates
- Very large posts (10,000+ comments) may take considerable time
- Requires Facebook to be accessible (respects login status)
- Some comment formatting may be lost (rich media, emojis may not display perfectly)

## Troubleshooting

**"Please navigate to a Facebook post first"**
- Make sure you're on a Facebook post page, not just the home feed
- The URL should contain `facebook.com` and the extension needs access

**No comments are being scraped**
- Facebook might have changed their HTML structure
- Try refreshing the page and re-running
- Check browser console (F12) for errors

**File didn't download**
- Check your browser's download settings
- Make sure downloads are allowed for this site
- Check the Downloads folder

## Legal & Ethical Use

⚠️ **Important**: Use responsibly and in compliance with:
- Facebook's Terms of Service
- Local privacy laws and regulations
- Respect users' privacy when collecting their comments

This tool is for personal research and backup purposes only.

## Support

If you encounter issues:
1. Check the popup status messages
2. Open Developer Tools (F12) and check the console for errors
3. Try clearing the extension data with the "Clear Data" button
4. Disable and re-enable the extension

## License

MIT License - feel free to modify and distribute
