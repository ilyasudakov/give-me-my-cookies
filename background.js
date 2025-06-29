// Background service worker for cookie operations
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'transferCookies') {
    transferCookies(request.sourceUrl, request.targetUrl, request.cookieFilter)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'clearCookies') {
    clearCookies(request.targetUrl)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function transferCookies(sourceUrl, targetUrl, cookieFilter) {
  try {
    const sourceHost = new URL(sourceUrl).hostname;
    const targetUrl_obj = new URL(targetUrl);
    const targetHost = targetUrl_obj.hostname;
    const targetPort = targetUrl_obj.port;
    const targetProtocol = targetUrl_obj.protocol;
    
    // Get all cookies from source domain
    const sourceCookies = await chrome.cookies.getAll({ domain: sourceHost });
    
    if (sourceCookies.length === 0) {
      return { success: false, error: `No cookies found for ${sourceHost}` };
    }
    
    // Filter cookies if specified
    let cookiesToTransfer = sourceCookies;
    if (cookieFilter) {
      const filters = cookieFilter.split(',').map(f => f.trim().toLowerCase());
      cookiesToTransfer = sourceCookies.filter(cookie => 
        filters.some(filter => cookie.name.toLowerCase().includes(filter))
      );
    }
    
    if (cookiesToTransfer.length === 0) {
      return { success: false, error: 'No cookies match the specified filter' };
    }
    
    // Transfer cookies to target domain
    let transferredCount = 0;
    const errors = [];
    
    for (const cookie of cookiesToTransfer) {
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
    
    if (transferredCount === 0) {
      return { 
        success: false, 
        error: `Failed to transfer any cookies. Errors: ${errors.join('; ')}` 
      };
    }
    
    const result = { 
      success: true, 
      count: transferredCount,
      total: cookiesToTransfer.length
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

async function clearCookies(targetUrl) {
  try {
    const targetHost = new URL(targetUrl).hostname;
    
    // Get all cookies from target domain
    const cookies = await chrome.cookies.getAll({ domain: targetHost });
    
    if (cookies.length === 0) {
      return { success: true, count: 0, message: 'No cookies found to clear' };
    }
    
    // Remove all cookies
    let clearedCount = 0;
    const errors = [];
    
    for (const cookie of cookies) {
      try {
        const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
        await chrome.cookies.remove({
          url: cookieUrl,
          name: cookie.name
        });
        clearedCount++;
      } catch (error) {
        errors.push(`Failed to remove cookie ${cookie.name}: ${error.message}`);
        console.error('Cookie removal error:', error);
      }
    }
    
    const result = { 
      success: true, 
      count: clearedCount,
      total: cookies.length
    };
    
    if (errors.length > 0) {
      result.warnings = errors;
    }
    
    return result;
    
  } catch (error) {
    console.error('Clear cookies error:', error);
    return { success: false, error: error.message };
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