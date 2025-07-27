// Content script for showing transfer notifications on localhost pages
class CookieTransferNotifications {
  constructor() {
    // Add detailed logging for debugging
    console.log('🔍 CookieTransferNotifications constructor called');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Document readyState:', document.readyState);
    console.log('🔍 Existing instance check:', !!window.cookieTransferNotifications);
    
    // Only run on localhost pages
    if (!this.isLocalhostPage()) {
      console.log('🚫 Not a localhost page, skipping notification system');
      return;
    }

    // Prevent multiple instances
    if (window.cookieTransferNotifications) {
      console.log('🚫 Cookie notification system already initialized, skipping');
      console.log('🚫 Existing instance:', window.cookieTransferNotifications);
      return;
    }
    
    console.log('✅ Creating new CookieTransferNotifications instance');
    window.cookieTransferNotifications = this;

    this.notificationContainer = null;
    this.notificationCounter = 0;
    this.instanceId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    this.iconContent = {
      'loading': '⚡',
      'success': '✓',
      'error': '✗'
    };

    console.log('🎯 Initializing Cookie Transfer Notifications on:', window.location.href);
    console.log('🆔 Instance ID:', this.instanceId);
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

  showNotification(type, message, details = '', autoHide = true) {
    console.log('🔔 showNotification called:', {
      type,
      message,
      instanceId: this.instanceId,
      notificationCounter: this.notificationCounter
    });
    
    this.createNotificationContainer();
    
    const notificationId = ++this.notificationCounter;
    console.log('🆔 Creating notification with ID:', notificationId, 'for instance:', this.instanceId);
    const notification = this.createNotificationElement(notificationId, type, message, details);
    
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

  createNotificationElement(notificationId, type, message, details) {
    const notification = document.createElement('div');
    notification.className = `cookie-notification ${type}`;
    notification.id = `notification-${notificationId}`;

    // Create content container with icon and message
    const content = document.createElement('div');
    content.className = 'notification-content';

    const icon = document.createElement('div');
    icon.className = `notification-icon ${type}`;
    icon.textContent = this.iconContent[type];

    // Create message
    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.innerHTML = message;

    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => notification.remove());

    content.appendChild(icon);
    content.appendChild(messageElement);
    content.appendChild(closeButton);

    // Assemble notification
    notification.appendChild(content);

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

  updateNotification(notificationId, type, message, details = '') {
    console.log(`🔄 Updating notification ${notificationId} to type: ${type}, message: ${message}`);
    
    const notification = document.getElementById(`notification-${notificationId}`);
    if (!notification) {
      console.error(`❌ Notification element not found: notification-${notificationId}`);
      return;
    }
    
    console.log(`✅ Found notification element, updating content`);
    
    // Clear existing content
    notification.innerHTML = '';
    notification.className = `cookie-notification ${type} show`;
    
    // Recreate content with new data
    const newContent = this.createNotificationElement(notificationId, type, message, details);
    while (newContent.firstChild) {
      notification.appendChild(newContent.firstChild);
    }
    
    console.log(`✅ Notification ${notificationId} updated successfully`);
    
    // Auto-hide success/error notifications
    if (type !== 'loading') {
      const hideDelay = type === 'error' ? 8000 : 5000;
      setTimeout(() => {
        this.hideNotification(notificationId);
      }, hideDelay);
    }
  }

  setupMessageListener() {
    console.log('🔧 Setting up message listener for instance:', this.instanceId);
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Content script received message:', message.action, 'Instance:', this.instanceId);
      
      if (message.action === 'showTransferStart') {
        const notificationId = this.showNotification(
          'loading',
          `Copying cookies from ${message.sourceCount} source${message.sourceCount > 1 ? 's' : ''}...`,
          '', // No details
          false // Don't auto-hide loading notifications
        );
        
        sendResponse({ notificationId });
      }
      
      if (message.action === 'showTransferComplete') {
        console.log(`📋 Processing showTransferComplete:`, message);
        
        const { totalCookies, copiedCookies = 0, updatedCookies = 0, skippedCookies = 0, sourceCount } = message;
        
        let successMessage;
        
        if (totalCookies === 0) {
          // No cookies transferred, all were up to date
          successMessage = `All cookies already up to date (${skippedCookies} existing) from ${sourceCount} source${sourceCount > 1 ? 's' : ''}`;
        } else {
          // Some cookies were transferred
          const stats = [];
          if (copiedCookies > 0) stats.push(`<span class="stat-copied">${copiedCookies} added</span>`);
          if (updatedCookies > 0) stats.push(`<span class="stat-updated">${updatedCookies} updated</span>`);
          
          const statsText = stats.length > 0 ? ` (${stats.join(', ')})` : '';
          successMessage = `${totalCookies} cookies${statsText} from ${sourceCount} source${sourceCount > 1 ? 's' : ''}`;
        }
        
        console.log(`📝 Generated success message: "${successMessage}"`);
        
        if (message.notificationId) {
          console.log(`🔄 Updating existing notification ${message.notificationId}`);
          this.updateNotification(
            message.notificationId,
            'success',
            successMessage
          );
        } else {
          console.log(`🆕 Creating new notification`);
          this.showNotification(
            'success',
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
            message.error || 'An error occurred during transfer'
          );
        } else {
          this.showNotification(
            'error',
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
          'Removing cookies from localhost...',
          '', // No details
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
            successMessage
          );
        } else {
          this.showNotification(
            'success',
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
            message.error || 'An error occurred while clearing cookies'
          );
        } else {
          this.showNotification(
            'error',
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