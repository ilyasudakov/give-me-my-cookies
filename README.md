# Cookie Transfer Tool

Chrome extension that automatically transfers cookies from production websites to localhost for easier frontend testing.

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the project directory

## Usage

1. Click the extension icon in Chrome toolbar
2. Add production URLs to your sources list
3. Visit any localhost page - cookies transfer automatically
4. Use "Manual Transfer Now" for on-demand transfers

## How It Works

The extension monitors localhost navigation and automatically transfers cookies from your configured production sources. It adjusts cookie security settings for localhost compatibility.

## Troubleshooting

- No cookies transferred: Check that source websites have cookies set
- Extension not working: Reload the extension in chrome://extensions/
- Localhost cookies not working: Verify your app accepts the transferred cookies 