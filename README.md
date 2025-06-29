# Cookie Transfer Tool - Chrome Extension

A simple Chrome extension for automatically transferring cookies from production websites to localhost for easier frontend testing.

## Features

- 🍪 Transfer cookies from any production site to localhost
- 🎯 Filter cookies by name (e.g., only transfer auth cookies)
- 🧹 Clear localhost cookies when needed
- 📊 Track recent transfers
- 🔍 Auto-detect current tab URL
- ⚡ No third-party dependencies

## Installation

1. **Download/Clone the Extension**
   - Clone this repository or download the files
   - Ensure all files are in the same directory

2. **Add Extension Icons (Optional)**
   - Add icon files: `icon16.png`, `icon48.png`, `icon128.png`
   - Or comment out the "icons" section in `manifest.json`

3. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the directory containing these files
   - The extension should now appear in your extensions list

## Usage

### Basic Cookie Transfer

1. **Open the extension** by clicking its icon in the Chrome toolbar
2. **Set source URL**: Enter the production website URL (e.g., `https://yourapp.com`)
   - Or click "Use Current Tab" to auto-detect
3. **Set target URL**: Enter your localhost URL (e.g., `http://localhost:3000`)
4. **Click "Transfer Cookies"** to copy all cookies from production to localhost

### Advanced Options

- **Cookie Filter**: Enter comma-separated keywords to only transfer specific cookies
  - Example: `auth, session, user` - only transfers cookies containing these terms
  - Leave empty to transfer all cookies

- **Clear Localhost Cookies**: Remove all cookies from your localhost domain

### Recent Transfers

The extension tracks your last 5 cookie transfers for quick reference.

## How It Works

1. **Reading Cookies**: Uses Chrome's `cookies` API to read cookies from the source domain
2. **Filtering**: Optionally filters cookies based on name patterns
3. **Transferring**: Sets filtered cookies on the target localhost domain
4. **Adapting**: Automatically adjusts cookie security settings for localhost (e.g., removes `secure` flag for HTTP)

## Permissions

The extension requires these permissions:
- `cookies` - To read and write cookies
- `activeTab` - To detect current tab URL
- `storage` - To save recent transfers
- `host_permissions` - To access cookies from all domains

## Common Use Cases

- **Authentication Testing**: Transfer auth cookies to test logged-in states
- **Session Management**: Copy session cookies for testing user flows  
- **API Testing**: Transfer API tokens stored in cookies
- **Feature Flags**: Copy feature flag cookies for testing different configurations

## Troubleshooting

**No cookies transferred?**
- Check that the source website actually has cookies set
- Verify the source URL format is correct (include `https://`)
- Some secure cookies may not transfer to HTTP localhost

**Extension not working?**
- Ensure all files are in the same directory
- Check Chrome Developer Tools console for errors
- Verify the extension is enabled in `chrome://extensions/`

**Localhost cookies not working?**
- Check that your localhost app accepts the transferred cookies
- Verify domain/path settings match your localhost setup
- Some apps may require specific cookie names or formats

## File Structure

```
cookie-transfer-extension/
├── manifest.json          # Extension configuration
├── popup.html            # User interface
├── popup.js             # UI logic
├── background.js        # Cookie operations
├── styles.css          # Styling
└── README.md          # This file
```

## Development

This extension uses vanilla JavaScript and Chrome Extension Manifest V3. No build process or third-party libraries required.

To modify:
1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension
4. Test your changes

## Security Notes

- The extension has broad permissions to access cookies from all domains
- Only install from trusted sources
- Review the code before installation if security is a concern
- Cookies are only transferred locally - nothing is sent to external servers 