// Background service worker for cookie operations
let autoTransferEnabled = true;

// Initialize auto-transfer setting
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get({ autoTransferEnabled: true });
  autoTransferEnabled = result.autoTransferEnabled;
});

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get({ autoTransferEnabled: true });
  autoTransferEnabled = result.autoTransferEnabled;
});

// Listen for navigation to localhost
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && autoTransferEnabled) {
    if (isLocalhostUrl(tab.url)) {
      console.log('Localhost detected, initiating auto-transfer:', tab.url);
      await performAutoTransfer(tab.url);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateAutoTransfer') {
    autoTransferEnabled = request.enabled;
    sendResponse({ success: true });
    return;
  }
  
  if (request.action === 'manualTransfer') {
    performManualTransfer()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'clearCookies') {
    clearLocalhostCookies()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

function isLocalhostUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.endsWith('.localhost') ||
           hostname.startsWith('localhost.');
  } catch (error) {
    return false;
  }
}

async function performAutoTransfer(localhostUrl) {
  try {
    const result = await chrome.storage.local.get({ sourceUrls: [], autoTransferEnabled: true });
    
    if (!result.autoTransferEnabled) {
      return;
    }
    
    const enabledSources = result.sourceUrls.filter(source => source.enabled);
    
    if (enabledSources.length === 0) {
      return;
    }
    
    console.log(`Auto-transferring cookies from ${enabledSources.length} sources to ${localhostUrl}`);
    
    // Show transfer start notification
    const notificationResponse = await sendNotificationToTabs('showTransferStart', {
      sourceCount: enabledSources.length,
      type: 'auto'
    });
    
    const transferResult = await transferFromMultipleSources(enabledSources.map(s => s.url), localhostUrl);
    
    if (transferResult.success && transferResult.totalCookies > 0) {
      // Save to recent transfers
      await saveRecentTransfer({
        sourceCount: transferResult.sourceCount,
        totalCookies: transferResult.totalCookies,
        timestamp: Date.now(),
        type: 'auto'
      });
      
      // Show success notification
      await sendNotificationToTabs('showTransferComplete', {
        totalCookies: transferResult.totalCookies,
        sourceCount: transferResult.sourceCount,
        notificationId: notificationResponse?.notificationId
      });
      
      console.log(`Auto-transfer completed: ${transferResult.totalCookies} cookies from ${transferResult.sourceCount} sources`);
    } else {
      // Show error notification
      await sendNotificationToTabs('showTransferError', {
        error: transferResult.error || 'Transfer failed',
        notificationId: notificationResponse?.notificationId
      });
    }
  } catch (error) {
    console.error('Auto-transfer error:', error);
    
    // Show error notification
    await sendNotificationToTabs('showTransferError', {
      error: error.message || 'An unexpected error occurred'
    });
  }
}

async function performManualTransfer() {
  try {
    const result = await chrome.storage.local.get({ sourceUrls: [] });
    const enabledSources = result.sourceUrls.filter(source => source.enabled);
    
    if (enabledSources.length === 0) {
      return { success: false, error: 'No enabled source URLs found. Please add some production URLs first.' };
    }
    
    // Default localhost URL - could be made configurable
    const localhostUrl = 'http://localhost:3000';
    
    // Show transfer start notification
    const notificationResponse = await sendNotificationToTabs('showTransferStart', {
      sourceCount: enabledSources.length,
      type: 'manual'
    });
    
    const transferResult = await transferFromMultipleSources(enabledSources.map(s => s.url), localhostUrl);
    
    if (transferResult.success) {
      // Save to recent transfers
      await saveRecentTransfer({
        sourceCount: transferResult.sourceCount,
        totalCookies: transferResult.totalCookies,
        timestamp: Date.now(),
        type: 'manual'
      });
      
      // Show success notification
      await sendNotificationToTabs('showTransferComplete', {
        totalCookies: transferResult.totalCookies,
        sourceCount: transferResult.sourceCount,
        notificationId: notificationResponse?.notificationId
      });
    } else {
      // Show error notification
      await sendNotificationToTabs('showTransferError', {
        error: transferResult.error || 'Transfer failed',
        notificationId: notificationResponse?.notificationId
      });
    }
    
    return transferResult;
  } catch (error) {
    console.error('Manual transfer error:', error);
    
    // Show error notification
    await sendNotificationToTabs('showTransferError', {
      error: error.message || 'An unexpected error occurred'
    });
    
    return { success: false, error: error.message };
  }
}

async function transferFromMultipleSources(sourceUrls, targetUrl) {
  const results = [];
  let totalCookies = 0;
  let successfulSources = 0;
  
  // Transfer from all sources in parallel for better performance
  const transferPromises = sourceUrls.map(async (sourceUrl) => {
    try {
      const result = await transferCookiesFromSource(sourceUrl, targetUrl);
      results.push({ sourceUrl, result });
      if (result.success) {
        totalCookies += result.count;
        successfulSources++;
      }
      return result;
    } catch (error) {
      results.push({ sourceUrl, result: { success: false, error: error.message } });
      return { success: false, error: error.message };
    }
  });
  
  await Promise.all(transferPromises);
  
  const errors = results.filter(r => !r.result.success);
  
  if (successfulSources === 0) {
    return {
      success: false,
      error: `Failed to transfer cookies from any source. Errors: ${errors.map(e => `${e.sourceUrl}: ${e.result.error}`).join('; ')}`
    };
  }
  
  const result = {
    success: true,
    totalCookies,
    sourceCount: successfulSources,
    attempted: sourceUrls.length
  };
  
  if (errors.length > 0) {
    result.warnings = errors.map(e => `${e.sourceUrl}: ${e.result.error}`);
  }
  
  return result;
}

async function transferCookiesFromSource(sourceUrl, targetUrl) {
  try {
    const sourceHost = new URL(sourceUrl).hostname;
    const targetUrl_obj = new URL(targetUrl);
    const targetHost = targetUrl_obj.hostname;
    const targetProtocol = targetUrl_obj.protocol;
    
    // Get all cookies from source domain
    const sourceCookies = await chrome.cookies.getAll({ domain: sourceHost });
    
    if (sourceCookies.length === 0) {
      return { success: false, error: `No cookies found for ${sourceHost}` };
    }
    
    // Transfer cookies to target domain
    let transferredCount = 0;
    const errors = [];
    
    for (const cookie of sourceCookies) {
      try {
        // Prepare cookie for localhost
        const newCookie = {
          url: targetUrl,
          name: cookie.name,
          value: cookie.value,
          domain: targetHost,
          path: cookie.path || '/',
          secure: targetProtocol === 'https:' ? cookie.secure : false,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'lax'
        };
        
        // Remove expiration for session cookies or set appropriate expiration
        if (!cookie.session && cookie.expirationDate) {
          newCookie.expirationDate = cookie.expirationDate;
        }
        
        await chrome.cookies.set(newCookie);
        transferredCount++;
      } catch (error) {
        errors.push(`Failed to set cookie ${cookie.name}: ${error.message}`);
        console.error('Cookie transfer error:', error);
      }
    }
    
    const result = { 
      success: true, 
      count: transferredCount,
      total: sourceCookies.length
    };
    
    if (errors.length > 0) {
      result.warnings = errors;
    }
    
    return result;
    
  } catch (error) {
    console.error('Transfer cookies error:', error);
    return { success: false, error: error.message };
  }
}

async function clearLocalhostCookies() {
  try {
    // Clear cookies from common localhost domains
    const localhostDomains = ['localhost', '127.0.0.1'];
    let totalCleared = 0;
    const errors = [];
    
    for (const domain of localhostDomains) {
      try {
        const cookies = await chrome.cookies.getAll({ domain });
        
        for (const cookie of cookies) {
          try {
            const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
            await chrome.cookies.remove({
              url: cookieUrl,
              name: cookie.name
            });
            totalCleared++;
          } catch (error) {
            errors.push(`Failed to remove cookie ${cookie.name} from ${domain}: ${error.message}`);
            console.error('Cookie removal error:', error);
          }
        }
      } catch (error) {
        errors.push(`Failed to get cookies from ${domain}: ${error.message}`);
      }
    }
    
    const result = { 
      success: true, 
      count: totalCleared
    };
    
    if (errors.length > 0) {
      result.warnings = errors;
    }
    
    return result;
    
  } catch (error) {
    console.error('Clear localhost cookies error:', error);
    return { success: false, error: error.message };
  }
}

async function sendNotificationToTabs(action, data) {
  try {
    const tabs = await chrome.tabs.query({ 
      url: ['http://localhost/*', 'https://localhost/*', 'http://127.0.0.1/*', 'https://127.0.0.1/*'] 
    });
    
    let lastResponse = null;
    
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action,
          ...data
        });
        if (response) lastResponse = response;
      } catch (error) {
        // Tab might not have content script loaded, ignore
        console.log('Could not send notification to tab:', tab.id);
      }
    }
    
    return lastResponse;
  } catch (error) {
    console.error('Error sending notification to tabs:', error);
    return null;
  }
}

async function saveRecentTransfer(transferData) {
  try {
    const result = await chrome.storage.local.get({ recentTransfers: [] });
    const transfers = result.recentTransfers;
    
    transfers.unshift(transferData);
    
    // Keep only last 5 transfers
    transfers.splice(5);
    
    await chrome.storage.local.set({ recentTransfers: transfers });
  } catch (error) {
    console.error('Error saving recent transfer:', error);
  }
}

// Helper function to validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
} 