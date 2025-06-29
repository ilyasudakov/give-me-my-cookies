# Cookie Transfer Tool

A Chrome extension that automatically transfers cookies from production sites to localhost for easier frontend development.

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder

## Usage

1. Add production URLs using the extension popup
2. Enable auto-transfer to automatically copy cookies when visiting localhost
3. Manual transfer option available for immediate cookie copying
4. View transfer history and manage source URLs

## Project Structure

```
where-my-cookies-at/
├── manifest.json          # Extension configuration
├── assets/               # Extension icons
├── src/
│   ├── popup/           # Extension popup interface
│   │   ├── popup.html   
│   │   ├── popup.js     
│   │   └── styles.css   
│   ├── content/         # In-page notifications
│   │   ├── notification.js
│   │   └── notification.css
│   └── background/      # Background service worker
│       └── background.js
└── README.md
```

## How It Works

The extension monitors localhost navigation and transfers cookies from configured production sources. It uses Chrome's cookies API with proper domain handling and shows elegant in-page notifications.

## Troubleshooting

Make sure the extension has permission to access cookies for both source and target domains. Check the extension popup for error messages if transfers fail 