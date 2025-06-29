// Content script for showing transfer notifications on localhost pages
(function() {
  'use strict';

  // Only run on localhost pages
  if (!isLocalhostPage()) {
    return;
  }

  let notificationContainer = null;
  let notificationCounter = 0;

  function isLocalhostPage() {
    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.endsWith('.localhost') ||
           hostname.startsWith('localhost.');
  }

  function createNotificationContainer() {
    if (notificationContainer) return notificationContainer;

    notificationContainer = document.createElement('div');
    notificationContainer.id = 'cookie-transfer-notifications';
    notificationContainer.innerHTML = `
      <style>
        #cookie-transfer-notifications {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: none;
        }
        
        .cookie-notification {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          padding: 12px 16px;
          margin-bottom: 12px;
          min-width: 280px;
          border-left: 4px solid #4285f4;
          transform: translateX(320px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0;
          pointer-events: auto;
          position: relative;
        }
        
        .cookie-notification.show {
          transform: translateX(0);
          opacity: 1;
        }
        
        .cookie-notification.hide {
          transform: translateX(320px);
          opacity: 0;
        }
        
        .cookie-notification.success {
          border-left-color: #34a853;
        }
        
        .cookie-notification.error {
          border-left-color: #ea4335;
        }
        
        .cookie-notification.loading {
          border-left-color: #fbbc04;
        }
        
        .notification-header {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }
        
        .notification-icon {
          width: 20px;
          height: 20px;
          margin-right: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: white;
        }
        
        .notification-icon.success {
          background-color: #34a853;
        }
        
        .notification-icon.error {
          background-color: #ea4335;
        }
        
        .notification-icon.loading {
          background-color: #fbbc04;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0.5; }
        }
        
        .notification-title {
          font-weight: 600;
          font-size: 14px;
          color: #333;
          flex: 1;
        }
        
        .notification-close {
          background: none;
          border: none;
          font-size: 16px;
          color: #666;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .notification-close:hover {
          background-color: #f1f3f4;
        }
        
        .notification-message {
          font-size: 13px;
          color: #666;
          line-height: 1.4;
        }
        
        .notification-details {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
        
        .progress-bar {
          height: 2px;
          background-color: #f0f0f0;
          margin-top: 8px;
          border-radius: 1px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background-color: #4285f4;
          width: 0%;
          transition: width 0.3s ease;
          animation: indeterminate 2s infinite linear;
        }
        
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      </style>
    `;

    document.body.appendChild(notificationContainer);
    return notificationContainer;
  }

  function showNotification(type, title, message, details = '', autoHide = true) {
    createNotificationContainer();
    
    const notificationId = ++notificationCounter;
    const notification = document.createElement('div');
    notification.className = `cookie-notification ${type}`;
    notification.id = `notification-${notificationId}`;
    
    const iconContent = {
      'loading': '⚡',
      'success': '✓',
      'error': '✗'
    };
    
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon ${type}">${iconContent[type]}</div>
        <div class="notification-title">${title}</div>
        <button class="notification-close" onclick="this.closest('.cookie-notification').remove()">×</button>
      </div>
      <div class="notification-message">${message}</div>
      ${details ? `<div class="notification-details">${details}</div>` : ''}
      ${type === 'loading' ? '<div class="progress-bar"><div class="progress-fill"></div></div>' : ''}
    `;
    
    notificationContainer.appendChild(notification);
    
    // Trigger show animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Auto-hide after delay
    if (autoHide) {
      const hideDelay = type === 'loading' ? 0 : (type === 'error' ? 8000 : 5000);
      if (hideDelay > 0) {
        setTimeout(() => {
          hideNotification(notificationId);
        }, hideDelay);
      }
    }
    
    return notificationId;
  }

  function hideNotification(notificationId) {
    const notification = document.getElementById(`notification-${notificationId}`);
    if (notification) {
      notification.classList.add('hide');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }

  function updateNotification(notificationId, type, title, message, details = '') {
    const notification = document.getElementById(`notification-${notificationId}`);
    if (!notification) return;
    
    notification.className = `cookie-notification ${type} show`;
    
    const iconContent = {
      'loading': '⚡',
      'success': '✓',
      'error': '✗'
    };
    
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon ${type}">${iconContent[type]}</div>
        <div class="notification-title">${title}</div>
        <button class="notification-close" onclick="this.closest('.cookie-notification').remove()">×</button>
      </div>
      <div class="notification-message">${message}</div>
      ${details ? `<div class="notification-details">${details}</div>` : ''}
    `;
    
    // Auto-hide success/error notifications
    if (type !== 'loading') {
      const hideDelay = type === 'error' ? 8000 : 5000;
      setTimeout(() => {
        hideNotification(notificationId);
      }, hideDelay);
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showTransferStart') {
      const notificationId = showNotification(
        'loading',
        'Cookie Transfer Started',
        `Copying cookies from ${message.sourceCount} source${message.sourceCount > 1 ? 's' : ''}...`,
        `${message.type === 'auto' ? 'Auto-transfer' : 'Manual transfer'} • ${window.location.host}`,
        false // Don't auto-hide loading notifications
      );
      
      sendResponse({ notificationId });
    }
    
    if (message.action === 'showTransferComplete') {
      if (message.notificationId) {
        updateNotification(
          message.notificationId,
          'success',
          'Cookies Transferred Successfully',
          `${message.totalCookies} cookies copied from ${message.sourceCount} source${message.sourceCount > 1 ? 's' : ''}`,
          `Ready to use • ${window.location.host}`
        );
      } else {
        showNotification(
          'success',
          'Cookies Transferred Successfully',
          `${message.totalCookies} cookies copied from ${message.sourceCount} source${message.sourceCount > 1 ? 's' : ''}`,
          `Ready to use • ${window.location.host}`
        );
      }
      
      sendResponse({ success: true });
    }
    
    if (message.action === 'showTransferError') {
      if (message.notificationId) {
        updateNotification(
          message.notificationId,
          'error',
          'Cookie Transfer Failed',
          message.error || 'An error occurred during transfer',
          `Check extension popup for details • ${window.location.host}`
        );
      } else {
        showNotification(
          'error',
          'Cookie Transfer Failed',
          message.error || 'An error occurred during transfer',
          `Check extension popup for details • ${window.location.host}`
        );
      }
      
      sendResponse({ success: true });
    }
    
    return true; // Keep message channel open for async response
  });

  // Show a subtle indicator that the extension is active on localhost
  console.log('🍪 Cookie Transfer Tool is active on this localhost page');
})(); 