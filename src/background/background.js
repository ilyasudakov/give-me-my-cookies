// Background service worker for cookie operations

// Helper function to get cookie store for a tab
async function getCookieStoreForTab(tabId) {
  try {
    const cookieStores = await chrome.cookies.getAllCookieStores();
    const store = cookieStores.find(store => store.tabIds.includes(tabId));
    return store ? store.id : null;
  } catch (error) {
    console.error('Error getting cookie store for tab:', error);
    return null;
  }
}

// Helper function to check if tab is incognito
async function isTabIncognito(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.incognito;
  } catch (error) {
    console.error('Error checking if tab is incognito:', error);
    return false;
  }
}


// Listen for navigation to localhost
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('🔍 Tab updated:', {
    tabId,
    status: changeInfo.status,
    url: tab.url,
    changeInfo
  });
  
  if (changeInfo.status === 'complete' && tab.url) {
    if (isLocalhostUrl(tab.url)) {
      console.log('🏠 Localhost detected, initiating auto-transfer:', tab.url);
      console.log('🔢 Tab details:', { tabId, incognito: tab.incognito });
      const storeId = await getCookieStoreForTab(tabId);
      const isIncognito = await isTabIncognito(tabId);
      console.log('💾 Store info:', { storeId, isIncognito });
      await performAutoTransfer(tab.url, storeId, isIncognito);
    }
  }
});

// Handle action button clicks to toggle panel
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🍪 Extension icon clicked, tab:', tab.id, tab.url);
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    console.log('🍪 Message sent successfully, response:', response);
  } catch (error) {
    console.error('🍪 Error toggling panel:', error);
    console.log('🍪 This might indicate the content script is not loaded on this page');
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manualTransfer') {
    performManualTransfer(request.storeId, request.isIncognito)
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
  
  if (request.action === 'getCookieStores') {
    chrome.cookies.getAllCookieStores()
      .then(stores => sendResponse({ stores }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getCookiesForDomain') {
    getCookiesForDomain(request.domain, request.useIncognito)
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

async function performAutoTransfer(localhostUrl, targetStoreId = null, isIncognitoTarget = false) {
  let notificationResponse = null;
  try {
    console.log(`🚀 Auto-transfer starting for ${localhostUrl} (incognito: ${isIncognitoTarget})`);
    
    const result = await chrome.storage.local.get({ sourceUrls: [] });
    
    const enabledSources = result.sourceUrls.filter(source => source.enabled);
    
    if (enabledSources.length === 0) {
      console.log('🚫 No enabled sources found, skipping auto-transfer');
      return;
    }
    
    console.log(`🍪 Auto-transferring cookies from ${enabledSources.length} sources to ${localhostUrl}`);
    
    // Show transfer start notification
    notificationResponse = await sendNotificationToTabs('showTransferStart', {
      sourceCount: enabledSources.length,
      type: 'auto',
      isIncognito: isIncognitoTarget
    });
    
    console.log(`📢 Start notification sent, ID: ${notificationResponse?.notificationId}`);
    
    const transferResult = await transferFromMultipleSources(enabledSources.map(s => s.url), localhostUrl, targetStoreId, isIncognitoTarget);
    
    console.log(`🔄 Transfer result:`, transferResult);
    
    if (transferResult.success && transferResult.totalCookies > 0) {
      // Save to recent transfers
      await saveRecentTransfer({
        sourceCount: transferResult.sourceCount,
        totalCookies: transferResult.totalCookies,
        skippedCookies: transferResult.totalSkipped || 0,
        timestamp: Date.now(),
        type: 'auto'
      });
      
      // Show success notification
      await sendNotificationToTabs('showTransferComplete', {
        totalCookies: transferResult.totalCookies,
        copiedCookies: transferResult.totalCopied || 0,
        updatedCookies: transferResult.totalUpdated || 0,
        skippedCookies: transferResult.totalSkipped || 0,
        sourceCount: transferResult.sourceCount,
        notificationId: notificationResponse?.notificationId
      });
      
      console.log(`Auto-transfer completed: ${transferResult.totalCookies} cookies transferred (${transferResult.totalCopied || 0} copied, ${transferResult.totalUpdated || 0} updated), ${transferResult.totalSkipped || 0} skipped from ${transferResult.sourceCount} sources`);
    } else if (transferResult.success && transferResult.totalCookies === 0) {
      // All cookies already existed - show a brief success message instead of just hiding
      console.log(`✅ Auto-transfer completed: All cookies up to date (${transferResult.totalSkipped || 0} already existed)`);
      
      if (notificationResponse?.notificationId) {
        await sendNotificationToTabs('showTransferComplete', {
          totalCookies: 0,
          copiedCookies: 0,
          updatedCookies: 0,
          skippedCookies: transferResult.totalSkipped || 0,
          sourceCount: transferResult.sourceCount,
          notificationId: notificationResponse.notificationId
        });
      }
    } else {
      // Show error notification
      console.log(`❌ Auto-transfer failed:`, transferResult);
      await sendNotificationToTabs('showTransferError', {
        error: transferResult.error || 'Transfer failed',
        notificationId: notificationResponse?.notificationId
      });
    }
  } catch (error) {
    console.error('❌ Auto-transfer error:', error);
    
    // Show error notification
    await sendNotificationToTabs('showTransferError', {
      error: error.message || 'An unexpected error occurred',
      notificationId: notificationResponse?.notificationId
    });
  }
}

async function performManualTransfer(targetStoreId = null, isIncognitoTarget = false) {
  try {
    console.log('🚀 Manual transfer started');
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
      type: 'manual',
      isIncognito: isIncognitoTarget
    });
    
    const transferResult = await transferFromMultipleSources(enabledSources.map(s => s.url), localhostUrl, targetStoreId, isIncognitoTarget);
    
    if (transferResult.success && transferResult.totalCookies > 0) {
      // Save to recent transfers
      await saveRecentTransfer({
        sourceCount: transferResult.sourceCount,
        totalCookies: transferResult.totalCookies,
        skippedCookies: transferResult.totalSkipped || 0,
        timestamp: Date.now(),
        type: 'manual'
      });
      
      // Show success notification
      await sendNotificationToTabs('showTransferComplete', {
        totalCookies: transferResult.totalCookies,
        copiedCookies: transferResult.totalCopied || 0,
        updatedCookies: transferResult.totalUpdated || 0,
        skippedCookies: transferResult.totalSkipped || 0,
        sourceCount: transferResult.sourceCount,
        notificationId: notificationResponse?.notificationId
      });
    } else if (transferResult.success && transferResult.totalCookies === 0) {
      // All cookies already existed - hide the loading notification but don't show success
      if (notificationResponse?.notificationId) {
        await sendNotificationToTabs('hideNotification', {
          notificationId: notificationResponse.notificationId
        });
      }
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

async function transferFromMultipleSources(sourceUrls, targetUrl, targetStoreId = null, isIncognitoTarget = false) {
  const results = [];
  let totalCookies = 0;
  let totalCopied = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let successfulSources = 0;
  
  // Get source cookie store ID based on incognito preference
  let sourceStoreId = null;
  if (isIncognitoTarget) {
    // Find incognito store for source cookies
    const cookieStores = await chrome.cookies.getAllCookieStores();
    
    // Check each store to find the incognito one
    for (const store of cookieStores) {
      if (store.tabIds.length === 0) {
        // Empty tabIds usually indicates incognito store
        sourceStoreId = store.id;
        break;
      } else {
        // Check if any tabs in this store are incognito
        for (const tabId of store.tabIds) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.incognito) {
              sourceStoreId = store.id;
              break;
            }
          } catch (error) {
            // Tab might not exist anymore, continue
            continue;
          }
        }
        if (sourceStoreId) break;
      }
    }
    
    console.log(`Using incognito source store ID: ${sourceStoreId}`);
  }
  
  // Transfer from all sources in parallel for better performance
  const transferPromises = sourceUrls.map(async (sourceUrl) => {
    try {
      const result = await transferCookiesFromSource(sourceUrl, targetUrl, sourceStoreId, targetStoreId);
      results.push({ sourceUrl, result });
      if (result.success) {
        totalCookies += result.count;
        totalCopied += result.copied || 0;
        totalUpdated += result.updated || 0;
        totalSkipped += result.skipped || 0;
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
    totalCopied,
    totalUpdated,
    totalSkipped,
    sourceCount: successfulSources,
    attempted: sourceUrls.length
  };
  
  if (errors.length > 0) {
    result.warnings = errors.map(e => `${e.sourceUrl}: ${e.result.error}`);
  }
  
  return result;
}

async function transferCookiesFromSource(sourceUrl, targetUrl, sourceStoreId = null, targetStoreId = null) {
  try {
    const sourceHost = new URL(sourceUrl).hostname;
    const targetUrl_obj = new URL(targetUrl);
    const targetHost = targetUrl_obj.hostname;
    const targetProtocol = targetUrl_obj.protocol;
    
    // Get all cookies from source domain with specific store
    const sourceCookiesOptions = { domain: sourceHost };
    if (sourceStoreId) {
      sourceCookiesOptions.storeId = sourceStoreId;
    }
    const sourceCookies = await chrome.cookies.getAll(sourceCookiesOptions);
    
    if (sourceCookies.length === 0) {
      return { success: false, error: `No cookies found for ${sourceHost}${sourceStoreId ? ' in incognito mode' : ''}` };
    }
    
    // Get existing cookies from target domain with specific store
    const targetCookiesOptions = { domain: targetHost };
    if (targetStoreId) {
      targetCookiesOptions.storeId = targetStoreId;
    }
    const existingCookies = await chrome.cookies.getAll(targetCookiesOptions);
    
    // Create a map of existing cookies for quick lookup
    const existingCookieMap = new Map();
    existingCookies.forEach(cookie => {
      const key = `${cookie.name}:${cookie.path}`;
      existingCookieMap.set(key, cookie);
    });
    
    // Transfer only missing or different cookies
    let copiedCount = 0;     // New cookies added
    let updatedCount = 0;    // Existing cookies with different values
    let skippedCount = 0;    // Cookies with same values
    const errors = [];
    
    for (const cookie of sourceCookies) {
      try {
        const cookieKey = `${cookie.name}:${cookie.path || '/'}`;
        const existingCookie = existingCookieMap.get(cookieKey);
        
        // Skip if cookie exists and has the same value
        if (existingCookie && existingCookie.value === cookie.value) {
          skippedCount++;
          continue;
        }
        
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
        
        // Add storeId if specified (for incognito)
        if (targetStoreId) {
          newCookie.storeId = targetStoreId;
        }
        
        // Remove expiration for session cookies or set appropriate expiration
        if (!cookie.session && cookie.expirationDate) {
          newCookie.expirationDate = cookie.expirationDate;
        }
        
        await chrome.cookies.set(newCookie);
        
        // Track whether this was copied (new) or updated (existing)
        if (existingCookie) {
          updatedCount++;
          console.log(`Updated cookie ${cookie.name} (value changed)`);
        } else {
          copiedCount++;
          console.log(`Added new cookie ${cookie.name}`);
        }
        
      } catch (error) {
        errors.push(`Failed to set cookie ${cookie.name}: ${error.message}`);
        console.error('Cookie transfer error:', error);
      }
    }
    
    const transferredCount = copiedCount + updatedCount;
    const result = { 
      success: true, 
      count: transferredCount,
      total: sourceCookies.length,
      skipped: skippedCount,
      copied: copiedCount,
      updated: updatedCount
    };
    
    if (errors.length > 0) {
      result.warnings = errors;
    }
    
    // Log summary
    console.log(`Cookie transfer summary: ${copiedCount} copied, ${updatedCount} updated, ${skippedCount} skipped, ${sourceCookies.length} total from ${sourceHost}`);
    
    return result;
    
  } catch (error) {
    console.error('Transfer cookies error:', error);
    return { success: false, error: error.message };
  }
}

async function clearLocalhostCookies() {
  try {
    console.log('🧹 Clear localhost cookies started');
    // Show clear start notification
    const notificationResponse = await sendNotificationToTabs('showClearStart', {});
    
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
    
    // Show success notification
    await sendNotificationToTabs('showClearComplete', {
      count: totalCleared,
      notificationId: notificationResponse?.notificationId
    });
    
    return result;
    
  } catch (error) {
    console.error('Clear localhost cookies error:', error);
    
    // Show error notification
    await sendNotificationToTabs('showClearError', {
      error: error.message || 'An unexpected error occurred',
      notificationId: notificationResponse?.notificationId
    });
    
    return { success: false, error: error.message };
  }
}

async function sendNotificationToTabs(action, data) {
  try {
    const tabs = await chrome.tabs.query({ 
      url: ['http://localhost/*', 'https://localhost/*', 'http://127.0.0.1/*', 'https://127.0.0.1/*'] 
    });
    
    console.log(`🔍 sendNotificationToTabs: Found ${tabs.length} localhost tabs for action: ${action}`);
    console.log('🗺 Tab details:', tabs.map(t => ({ id: t.id, url: t.url, incognito: t.incognito })));
    
    if (tabs.length === 0) {
      console.log('⚠️ No localhost tabs found. Open a localhost page to see notifications.');
      return null;
    }
    
    let lastResponse = null;
    let successCount = 0;
    
    for (const tab of tabs) {
      try {
        console.log(`📤 Sending ${action} notification to tab ${tab.id}: ${tab.url}`);
        const response = await chrome.tabs.sendMessage(tab.id, {
          action,
          ...data
        });
        if (response) {
          console.log(`✅ Notification sent successfully to tab ${tab.id}, response:`, response);
          lastResponse = response;
          successCount++;
        }
      } catch (error) {
        // Tab might not have content script loaded, ignore
        console.log(`❌ Could not send notification to tab ${tab.id}: ${error.message}`);
      }
    }
    
    console.log(`📊 Notification summary: ${successCount}/${tabs.length} tabs received notification`);
    
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

async function getCookiesForDomain(domain, useIncognito = false) {
  try {
    console.log(`🍪 Getting cookies for domain: ${domain}, incognito: ${useIncognito}`);
    
    let storeId = null;
    
    if (useIncognito) {
      // Find incognito store
      const cookieStores = await chrome.cookies.getAllCookieStores();
      
      for (const store of cookieStores) {
        if (store.tabIds.length === 0) {
          // Empty tabIds usually indicates incognito store
          storeId = store.id;
          break;
        } else {
          // Check if any tabs in this store are incognito
          for (const tabId of store.tabIds) {
            try {
              const tab = await chrome.tabs.get(tabId);
              if (tab.incognito) {
                storeId = store.id;
                break;
              }
            } catch (error) {
              // Tab might not exist anymore, continue
              continue;
            }
          }
          if (storeId) break;
        }
      }
      
      console.log(`🍪 Using incognito store ID: ${storeId}`);
    }
    
    // Get cookies for the domain
    const cookieOptions = { domain: domain };
    if (storeId) {
      cookieOptions.storeId = storeId;
    }
    
    const cookies = await chrome.cookies.getAll(cookieOptions);
    
    console.log(`🍪 Found ${cookies.length} cookies for ${domain}`);
    
    return {
      success: true,
      cookies: cookies,
      domain: domain,
      storeId: storeId
    };
    
  } catch (error) {
    console.error('🍪 Error getting cookies for domain:', error);
    return {
      success: false,
      error: error.message,
      domain: domain
    };
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