// Content script for showing transfer notifications on localhost pages
class CookieTransferNotifications {
  constructor() {
    // Only run on localhost pages
    if (!this.isLocalhostPage()) {
      return;
    }

    this.notificationContainer = null;
    this.notificationCounter = 0;
    this.iconContent = {
      'loading': '⚡',
      'success': '✓',
      'error': '✗'
    };

    this.init();
  }

  isLocalhostPage() {
    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.endsWith('.localhost') ||
           hostname.startsWith('localhost.');
  }

  init() {
    this.setupMessageListener();
    console.log('🍪 Cookie Transfer Tool is active on this localhost page:', window.location.href);
  }

  createNotificationContainer() {
    if (this.notificationContainer) return this.notificationContainer;

    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'cookie-transfer-notifications';
    document.body.appendChild(this.notificationContainer);
    return this.notificationContainer;
  }

  showNotification(type, title, message, details = '', autoHide = true) {
    this.createNotificationContainer();
    
    const notificationId = ++this.notificationCounter;
    const notification = this.createNotificationElement(notificationId, type, title, message, details);
    
    this.notificationContainer.appendChild(notification);
    
    // Trigger show animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Auto-hide after delay
    if (autoHide) {
      const hideDelay = type === 'loading' ? 0 : (type === 'error' ? 8000 : 5000);
      if (hideDelay > 0) {
        setTimeout(() => {
          this.hideNotification(notificationId);
        }, hideDelay);
      }
    }
    
    return notificationId;
  }

  createNotificationElement(notificationId, type, title, message, details) {
    const notification = document.createElement('div');
    notification.className = `cookie-notification ${type}`;
    notification.id = `notification-${notificationId}`;

    // Create header
    const header = document.createElement('div');
    header.className = 'notification-header';

    const icon = document.createElement('div');
    icon.className = `notification-icon ${type}`;
    icon.textContent = this.iconContent[type];

    const titleElement = document.createElement('div');
    titleElement.className = 'notification-title';
    titleElement.textContent = title;

    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => notification.remove());

    header.appendChild(icon);
    header.appendChild(titleElement);
    header.appendChild(closeButton);

    // Create message
    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.innerHTML = message;

    // Assemble notification
    notification.appendChild(header);
    notification.appendChild(messageElement);

    // Add details if provided
    if (details) {
      const detailsElement = document.createElement('div');
      detailsElement.className = 'notification-details';
      detailsElement.textContent = details;
      notification.appendChild(detailsElement);
    }

    // Add progress bar for loading state
    if (type === 'loading') {
      const progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      const progressFill = document.createElement('div');
      progressFill.className = 'progress-fill';
      progressBar.appendChild(progressFill);
      notification.appendChild(progressBar);
    }

    return notification;
  }

  hideNotification(notificationId) {
    const notification = document.getElementById(`notification-${notificationId}`);
    if (notification) {
      notification.classList.add('hide');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }

  updateNotification(notificationId, type, title, message, details = '') {
    const notification = document.getElementById(`notification-${notificationId}`);
    if (!notification) return;
    
    // Clear existing content
    notification.innerHTML = '';
    notification.className = `cookie-notification ${type} show`;
    
    // Recreate content with new data
    const newContent = this.createNotificationElement(notificationId, type, title, message, details);
    while (newContent.firstChild) {
      notification.appendChild(newContent.firstChild);
    }
    
    // Auto-hide success/error notifications
    if (type !== 'loading') {
      const hideDelay = type === 'error' ? 8000 : 5000;
      setTimeout(() => {
        this.hideNotification(notificationId);
      }, hideDelay);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Content script received message:', message.action);
      
      if (message.action === 'showTransferStart') {
        const notificationId = this.showNotification(
          'loading',
          'Cookie Transfer Started',
          `Copying cookies from ${message.sourceCount} source${message.sourceCount > 1 ? 's' : ''}...`,
          false // Don't auto-hide loading notifications
        );
        
        sendResponse({ notificationId });
      }
      
      if (message.action === 'showTransferComplete') {
        const { totalCookies, copiedCookies = 0, updatedCookies = 0, skippedCookies = 0, sourceCount } = message;
        
        // Create detailed stats message with colors (excluding skipped)
        const stats = [];
        if (copiedCookies > 0) stats.push(`<span class="stat-copied">${copiedCookies} added</span>`);
        if (updatedCookies > 0) stats.push(`<span class="stat-updated">${updatedCookies} updated</span>`);
        
        const statsText = stats.length > 0 ? `${stats.join(', ')}` : '';
        const successMessage = `${totalCookies} cookies (${statsText}) from ${sourceCount} source${sourceCount > 1 ? 's' : ''}`;
        
        if (message.notificationId) {
          this.updateNotification(
            message.notificationId,
            'success',
            'Cookies Transferred Successfully',
            successMessage
          );
        } else {
          this.showNotification(
            'success',
            'Cookies Transferred Successfully',
            successMessage
          );
        }
        
        sendResponse({ success: true });
      }
      
      if (message.action === 'showTransferError') {
        if (message.notificationId) {
          this.updateNotification(
            message.notificationId,
            'error',
            'Cookie Transfer Failed',
            message.error || 'An error occurred during transfer'
          );
        } else {
          this.showNotification(
            'error',
            'Cookie Transfer Failed',
            message.error || 'An error occurred during transfer'
          );
        }
        
        sendResponse({ success: true });
      }
      
      if (message.action === 'hideNotification') {
        if (message.notificationId) {
          this.hideNotification(message.notificationId);
        }
        
        sendResponse({ success: true });
      }
      
      // Clear cookies notifications
      if (message.action === 'showClearStart') {
        const notificationId = this.showNotification(
          'loading',
          'Clearing Local Cookies',
          'Removing cookies from localhost...',
          'Manual clear operation',
          false // Don't auto-hide loading notifications
        );
        
        sendResponse({ notificationId });
      }
      
      if (message.action === 'showClearComplete') {
        const { count } = message;
        const successMessage = `${count} cookie${count !== 1 ? 's' : ''} cleared from localhost`;
        
        if (message.notificationId) {
          this.updateNotification(
            message.notificationId,
            'success',
            'Local Cookies Cleared',
            successMessage
          );
        } else {
          this.showNotification(
            'success',
            'Local Cookies Cleared',
            successMessage
          );
        }
        
        sendResponse({ success: true });
      }
      
      if (message.action === 'showClearError') {
        if (message.notificationId) {
          this.updateNotification(
            message.notificationId,
            'error',
            'Clear Operation Failed',
            message.error || 'An error occurred while clearing cookies'
          );
        } else {
          this.showNotification(
            'error',
            'Clear Operation Failed',
            message.error || 'An error occurred while clearing cookies'
          );
        }
        
        sendResponse({ success: true });
      }
      
      return true; // Keep message channel open for async response
    });
  }
}

// Initialize the notification system
new CookieTransferNotifications(); 