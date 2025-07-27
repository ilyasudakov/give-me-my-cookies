// Cookie Extension In-Page Panel
(function() {
  'use strict';
  
  // Add detailed logging for debugging duplicate scripts
  const scriptInstanceId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  console.log('🍪 Cookie Extension content script loaded on:', window.location.href);
  console.log('🆔 Script instance ID:', scriptInstanceId);
  console.log('🔍 Existing panel:', !!window.cookieExtensionPanel);
  
  // Prevent multiple script instances
  if (window.cookieExtensionPanel) {
    console.log('🚫 Panel script already loaded, skipping duplicate');
    return;
  }
  window.cookieExtensionPanel = { instanceId: scriptInstanceId };
  
  let panel = null;
  let isVisible = false;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  // Panel HTML structure (adapted from popup.html)
  const panelHTML = `
    <div id="cookie-extension-panel" class="cookie-panel">
      <div class="cookie-panel-hover-controls">
        <button id="cookie-panel-close" title="Close panel">×</button>
      </div>
      
      <div class="cookie-panel-content">
        <div class="section">
          <span>Transfer cookies from:</span>
          <div id="sourcesList" class="sources-list"></div>
          <div class="input-group">
            <input
              type="text"
              id="newSourceUrl"
              placeholder="https://example.com"
            />
            <button id="addSource">+</button>
          </div>
        </div>

        <div class="section">
          <button id="clearLocalhost">Clear local cookies</button>
          <button id="manualTransfer">Run manual transfer</button>
        </div>
        
        <div class="section">
          <div class="incognito-toggle">
            <label for="useIncognito">
              <span>🕵️ Use incognito mode cookies</span>
            </label>
            <input type="checkbox" id="useIncognito" />
          </div>
          <div id="incognitoStatus" class="incognito-status"></div>
        </div>
        
      </div>

      <div id="status" class="status"></div>
    </div>
  `;
  
  // Initialize panel
  function initPanel() {
    console.log('🍪 initPanel called, panel exists:', !!panel);
    if (panel) return; // Already initialized
    
    try {
      // Create panel container
      const container = document.createElement('div');
      container.innerHTML = panelHTML;
      panel = container.firstElementChild;
      
      console.log('🍪 Panel created:', !!panel);
      console.log('🍪 Document body exists:', !!document.body);
      
      // Add to page
      if (document.body) {
        document.body.appendChild(panel);
        console.log('🍪 Panel appended to body');
      } else {
        console.error('🍪 Document body not available, waiting for DOM ready');
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(panel);
          console.log('🍪 Panel appended to body after DOM ready');
        });
      }
      
      // Initialize panel functionality
      setupPanelControls();
      setupDragAndDrop();
      loadPanelData();
      
      console.log('🍪 Cookie Extension panel initialized');
    } catch (error) {
      console.error('🍪 Error initializing panel:', error);
    }
  }
  
  // Setup panel control buttons
  function setupPanelControls() {
    const closeBtn = panel.querySelector('#cookie-panel-close');
    
    closeBtn.addEventListener('click', () => {
      hidePanel();
    });
  }
  
  // Setup drag and drop for panel
  function setupDragAndDrop() {
    let dragStarted = false;
    
    panel.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on interactive elements
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || 
          e.target.closest('button') || e.target.closest('input') ||
          e.target.closest('.cookie-panel-hover-controls')) {
        return;
      }
      
      isDragging = true;
      dragStarted = false;
      const rect = panel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      
      panel.style.cursor = 'grabbing';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      // Start dragging only after moving a few pixels to prevent accidental drags
      if (!dragStarted) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - (panel.getBoundingClientRect().left + dragOffset.x), 2) +
          Math.pow(e.clientY - (panel.getBoundingClientRect().top + dragOffset.y), 2)
        );
        
        if (distance < 5) return; // Threshold for drag start
        dragStarted = true;
      }
      
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      
      // Keep panel within viewport
      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;
      
      panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
      panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dragStarted = false;
        panel.style.cursor = 'move';
      }
    });
  }
  
  // Load panel data (adapted from popup.js)
  async function loadPanelData() {
    await loadSourcesList();
    await setCurrentTabInfo();
    await logExtensionSettings();
    setupEventListeners();
  }
  
  // Show panel
  function showPanel() {
    console.log('🍪 showPanel called, panel exists:', !!panel);
    if (!panel) {
      console.log('🍪 Panel does not exist, initializing...');
      initPanel();
    }
    if (panel) {
      panel.style.setProperty('display', 'block', 'important');
      panel.classList.add('show');
      isVisible = true;
      console.log('🍪 Panel should now be visible');
    } else {
      console.error('🍪 Panel still null after initialization');
    }
  }
  
  // Hide panel
  function hidePanel() {
    console.log('🍪 hidePanel called');
    if (panel) {
      panel.style.setProperty('display', 'none', 'important');
      panel.classList.remove('show');
    }
    isVisible = false;
  }
  
  // Toggle panel visibility
  function togglePanel() {
    console.log('🍪 togglePanel called, current isVisible:', isVisible);
    if (isVisible) {
      hidePanel();
    } else {
      showPanel();
    }
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🍪 Content script received message:', request);
    if (request.action === 'togglePanel') {
      console.log('🍪 Toggling panel, current visibility:', isVisible);
      togglePanel();
      sendResponse({ success: true });
    }
  });
  
  // Keyboard shortcut to toggle panel (Ctrl+Shift+C)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      togglePanel();
    }
  });
  
  // Helper functions (adapted from popup.js)
  function showStatus(message, type = 'info') {
    const statusDiv = panel.querySelector('#status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type !== 'error') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 5000);
    }
  }
  
  
  async function setCurrentTabInfo() {
    try {
      // Content scripts don't have access to chrome.tabs.query, use window.location instead
      const url = new URL(window.location.href);
      const newSourceUrlInput = panel.querySelector('#newSourceUrl');
      if (newSourceUrlInput) {
        newSourceUrlInput.placeholder = url.protocol + '//' + url.hostname;
      }
      
      // We can't detect incognito from content script, so assume normal mode
      updateIncognitoStatus(false);
      
      // Create a mock tab object for logging
      const mockTab = {
        incognito: false, // We can't detect this from content script
        id: 'unknown',
        url: window.location.href
      };
      logInitialState(mockTab, url);
    } catch (error) {
      console.error('Error getting current tab info:', error);
    }
  }
  
  function updateIncognitoStatus(isIncognito) {
    const incognitoStatusDiv = panel.querySelector('#incognitoStatus');
    const useIncognitoToggle = panel.querySelector('#useIncognito');
    
    if (isIncognito) {
      incognitoStatusDiv.textContent = 'Current window: Incognito mode';
      incognitoStatusDiv.style.color = '#6366f1';
      useIncognitoToggle.checked = true;
    } else {
      incognitoStatusDiv.textContent = 'Current window: Normal mode';
      incognitoStatusDiv.style.color = '#6b7280';
      useIncognitoToggle.checked = false;
    }
  }
  
  function logInitialState(tab, url) {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(url.hostname) || 
                       url.hostname.endsWith('.localhost') || 
                       url.hostname.startsWith('localhost.');
    
    console.log('🍪 Cookie Extension - Initial State Summary:');
    console.log(`├─ Window Type: ${tab.incognito ? '🕵️ Incognito' : '👤 Normal'}`);
    console.log(`├─ Current URL: ${url.href}`);
    console.log(`├─ Domain: ${url.hostname}`);
    console.log(`├─ Is Localhost: ${isLocalhost ? '✅ Yes' : '❌ No'}`);
    console.log(`├─ Protocol: ${url.protocol}`);
    console.log(`└─ Tab ID: ${tab.id}`);
    
    if (isLocalhost) {
      console.log('🎯 Localhost detected - ready for cookie transfer!');
    } else {
      console.log('🌐 Production site - add to sources for cookie transfer');
    }
  }
  
  async function logExtensionSettings() {
    try {
      console.log('\n⚙️ Extension Settings:');
      
      // Get storage settings
      const storage = await chrome.storage.local.get();
      console.log(`├─ Source URLs count: ${storage.sourceUrls?.length || 0}`);
      
      if (storage.sourceUrls?.length > 0) {
        console.log('├─ Configured sources:');
        storage.sourceUrls.forEach((source, index) => {
          const status = source.enabled ? '✅' : '❌';
          console.log(`│  ${index + 1}. ${status} ${source.url}`);
        });
      }
      
      // Get cookie stores info from background script
      try {
        const cookieStoresInfo = await chrome.runtime.sendMessage({ action: 'getCookieStores' });
        if (cookieStoresInfo && cookieStoresInfo.stores) {
          console.log(`├─ Available cookie stores: ${cookieStoresInfo.stores.length}`);
          cookieStoresInfo.stores.forEach((store, index) => {
            const storeType = store.tabIds.length === 0 ? '🕵️ Incognito' : '👤 Normal';
            console.log(`│  Store ${index + 1}: ${storeType} (ID: ${store.id}, Tabs: ${store.tabIds.length})`);
          });
        }
      } catch (error) {
        console.log('├─ Cookie stores: Unable to fetch (content script limitation)');
      }
      
      console.log('└─ Extension ready!\n');
      
    } catch (error) {
      console.error('Error logging extension settings:', error);
    }
  }
  
  async function loadSourcesList() {
    try {
      const result = await chrome.storage.local.get({ sourceUrls: [] });
      const sourceUrls = result.sourceUrls;
      const sourcesListDiv = panel.querySelector('#sourcesList');
      
      if (sourceUrls.length === 0) {
        sourcesListDiv.innerHTML = '<div class="empty-state">No production sources added yet</div>';
        return;
      }
      
      sourcesListDiv.innerHTML = sourceUrls.map((source, index) => `
        <div class="source-item ${source.enabled ? '' : 'disabled'}" data-index="${index}">
          <div class="source-header">
            <div class="source-url">${source.url}</div>
            <div class="source-actions">
              <button data-action="show-cookies" data-index="${index}" class="show-cookies-btn" title="Show cookies">
                🍪
              </button>
              <button data-action="remove" data-index="${index}" class="danger" title="Remove">
                🗑️
              </button>
            </div>
          </div>
          <div class="cookies-list" id="cookies-list-${index}" style="display: none;">
            <div class="cookies-loading">Click 🍪 to view cookies...</div>
          </div>
        </div>
      `).join('');
      
      attachSourceButtonListeners();
    } catch (error) {
      console.error('Error loading sources list:', error);
      panel.querySelector('#sourcesList').innerHTML = '<div style="color: #999;">Error loading sources</div>';
    }
  }
  
  function attachSourceButtonListeners() {
    const sourcesListDiv = panel.querySelector('#sourcesList');
    sourcesListDiv.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      
      const action = button.getAttribute('data-action');
      const index = parseInt(button.getAttribute('data-index'));
      
      if (action === 'remove') {
        await removeSource(index);
      } else if (action === 'show-cookies') {
        await toggleCookiesList(index, button);
      }
    });
  }
  
  async function toggleCookiesList(index, button) {
    const cookiesList = panel.querySelector(`#cookies-list-${index}`);
    const isVisible = cookiesList.style.display !== 'none';
    
    if (isVisible) {
      // Hide cookies list
      cookiesList.style.setProperty('display', 'none', 'important');
      button.textContent = '🍪';
      button.title = 'Show cookies';
    } else {
      // Show cookies list
      cookiesList.style.setProperty('display', 'block', 'important');
      button.textContent = '📂';
      button.title = 'Hide cookies';
      
      // Load cookies if not already loaded
      if (cookiesList.querySelector('.cookies-loading')) {
        await loadCookiesForSource(index);
      }
    }
  }
  
  async function loadCookiesForSource(index) {
    const result = await chrome.storage.local.get({ sourceUrls: [] });
    const sourceUrls = result.sourceUrls;
    const source = sourceUrls[index];
    
    if (!source) return;
    
    const cookiesList = panel.querySelector(`#cookies-list-${index}`);
    cookiesList.innerHTML = '<div class="cookies-loading">Loading cookies...</div>';
    
    try {
      // Get cookies from background script
      const useIncognito = panel.querySelector('#useIncognito').checked;
      const cookiesData = await chrome.runtime.sendMessage({
        action: 'getCookiesForDomain',
        domain: new URL(source.url).hostname,
        useIncognito: useIncognito
      });
      
      if (cookiesData.success && cookiesData.cookies.length > 0) {
        displayCookies(cookiesData.cookies, cookiesList);
      } else {
        cookiesList.innerHTML = `<div class="no-cookies">No cookies found for ${source.url}</div>`;
      }
    } catch (error) {
      cookiesList.innerHTML = `<div class="cookies-error">Error loading cookies: ${error.message}</div>`;
    }
  }
  
  function displayCookies(cookies, container) {
    const cookiesHTML = cookies.map((cookie, index) => `
      <div class="cookie-item" data-cookie-index="${index}">
        <div class="cookie-header">
          <span class="cookie-name">${cookie.name}</span>
          <div class="cookie-actions">
            <button class="copy-cookie-btn" data-cookie-value="${escapeHtml(cookie.value)}" title="Copy value">
              📋
            </button>
            <button class="copy-cookie-full-btn" data-cookie-data="${escapeHtml(JSON.stringify(cookie))}" title="Copy full cookie">
              📄
            </button>
          </div>
        </div>
        <div class="cookie-details">
          <div class="cookie-value">
            <strong>Value:</strong> 
            <span class="cookie-value-text">${truncateValue(cookie.value)}</span>
          </div>
          <div class="cookie-meta">
            <span><strong>Domain:</strong> ${cookie.domain}</span>
            <span><strong>Path:</strong> ${cookie.path || '/'}</span>
            <span><strong>Secure:</strong> ${cookie.secure ? 'Yes' : 'No'}</span>
            <span><strong>HttpOnly:</strong> ${cookie.httpOnly ? 'Yes' : 'No'}</span>
            ${cookie.sameSite ? `<span><strong>SameSite:</strong> ${cookie.sameSite}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = `
      <div class="cookies-header">
        <span>Found ${cookies.length} cookie${cookies.length !== 1 ? 's' : ''}</span>
        <button class="copy-all-cookies-btn" data-cookies="${escapeHtml(JSON.stringify(cookies))}" title="Copy all cookies">
          📋 Copy All
        </button>
      </div>
      <div class="cookies-container">
        ${cookiesHTML}
      </div>
    `;
    
    // Add copy event listeners
    container.addEventListener('click', handleCookieCopyActions);
  }
  
  function handleCookieCopyActions(event) {
    const button = event.target.closest('button');
    if (!button) return;
    
    if (button.classList.contains('copy-cookie-btn')) {
      const value = button.getAttribute('data-cookie-value');
      copyToClipboard(value);
      showStatus('Cookie value copied to clipboard', 'success');
    } else if (button.classList.contains('copy-cookie-full-btn')) {
      const cookieData = button.getAttribute('data-cookie-data');
      copyToClipboard(cookieData);
      showStatus('Full cookie data copied to clipboard', 'success');
    } else if (button.classList.contains('copy-all-cookies-btn')) {
      const cookiesData = button.getAttribute('data-cookies');
      copyToClipboard(cookiesData);
      showStatus('All cookies copied to clipboard', 'success');
    }
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(err => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function truncateValue(value, maxLength = 50) {
    if (value.length <= maxLength) return escapeHtml(value);
    return escapeHtml(value.substring(0, maxLength)) + '...';
  }

  async function removeSource(index) {
    try {
      const result = await chrome.storage.local.get({ sourceUrls: [] });
      const sourceUrls = result.sourceUrls;
      
      if (sourceUrls[index]) {
        sourceUrls.splice(index, 1);
        await chrome.storage.local.set({ sourceUrls });
        loadSourcesList();
        showStatus('Source removed', 'info');
      }
    } catch (error) {
      showStatus('Error removing source: ' + error.message, 'error');
    }
  }
  
  function setupEventListeners() {
    const addSourceBtn = panel.querySelector('#addSource');
    const manualTransferBtn = panel.querySelector('#manualTransfer');
    const clearBtn = panel.querySelector('#clearLocalhost');
    const newSourceUrlInput = panel.querySelector('#newSourceUrl');
    const useIncognitoToggle = panel.querySelector('#useIncognito');
    
    // Add source URL
    addSourceBtn.addEventListener('click', async () => {
      let sourceUrl = newSourceUrlInput.value.trim();
      
      if (!sourceUrl) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.url) {
            const url = new URL(tab.url);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              sourceUrl = url.protocol + '//' + url.hostname;
            } else {
              showStatus('Current tab is not a valid web page (must be http or https)', 'error');
              return;
            }
          } else {
            showStatus('Could not get current tab URL', 'error');
            return;
          }
        } catch (error) {
          showStatus('Error getting current tab URL: ' + error.message, 'error');
          return;
        }
      }

      try {
        new URL(sourceUrl);
      } catch (error) {
        showStatus('Please enter a valid URL', 'error');
        return;
      }

      try {
        const result = await chrome.storage.local.get({ sourceUrls: [] });
        const sourceUrls = result.sourceUrls;
        
        if (sourceUrls.some(item => item.url === sourceUrl)) {
          showStatus('URL already exists in the list', 'error');
          return;
        }
        
        sourceUrls.push({ 
          url: sourceUrl, 
          enabled: true, 
          added: Date.now() 
        });
        
        await chrome.storage.local.set({ sourceUrls });
        newSourceUrlInput.value = '';
        loadSourcesList();
        showStatus('Source URL added successfully', 'success');
      } catch (error) {
        showStatus('Error adding source URL: ' + error.message, 'error');
      }
    });
    
    // Manual transfer
    manualTransferBtn.addEventListener('click', async () => {
      try {
        manualTransferBtn.disabled = true;
        manualTransferBtn.textContent = 'Transferring...';
        
        const isIncognito = useIncognitoToggle.checked;
        const modeText = isIncognito ? ' (incognito mode)' : ' (normal mode)';
        showStatus('Starting manual transfer' + modeText + '...', 'info');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const storeId = tab ? await getCookieStoreForTab(tab.id) : null;

        const result = await chrome.runtime.sendMessage({
          action: 'manualTransfer',
          storeId: isIncognito ? storeId : null,
          isIncognito: isIncognito
        });

        if (result.success && result.totalCookies > 0) {
          const transferMessage = `Successfully transferred ${result.totalCookies} cookies` + 
            (result.totalSkipped > 0 ? ` (${result.totalSkipped} already existed)` : '') +
            ` from ${result.sourceCount} sources`;
          showStatus(transferMessage, 'success');
        } else if (result.success && result.totalCookies === 0) {
          showStatus(`All cookies already up to date (${result.totalSkipped || 0} already existed)`, 'info');
        } else {
          showStatus('Transfer failed: ' + result.error, 'error');
        }
      } catch (error) {
        showStatus('Error: ' + error.message, 'error');
      } finally {
        manualTransferBtn.disabled = false;
        manualTransferBtn.textContent = 'Run manual transfer';
      }
    });
    
    // Clear localhost cookies
    clearBtn.addEventListener('click', async () => {
      try {
        clearBtn.disabled = true;
        clearBtn.textContent = 'Clearing...';
        showStatus('Clearing localhost cookies...', 'info');

        const result = await chrome.runtime.sendMessage({
          action: 'clearCookies'
        });

        if (result.success) {
          showStatus(`Cleared ${result.count} cookies from localhost`, 'success');
        } else {
          showStatus('Clear failed: ' + result.error, 'error');
        }
      } catch (error) {
        showStatus('Error: ' + error.message, 'error');
      } finally {
        clearBtn.disabled = false;
        clearBtn.textContent = 'Clear local cookies';
      }
    });
    
  }
  
  async function getCookieStoreForTab(tabId) {
    try {
      const cookieStoresInfo = await chrome.runtime.sendMessage({ action: 'getCookieStores' });
      if (cookieStoresInfo && cookieStoresInfo.stores) {
        const store = cookieStoresInfo.stores.find(store => store.tabIds.includes(tabId));
        return store ? store.id : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting cookie store for tab:', error);
      return null;
    }
  }
  
  // Initialize when DOM is ready
  console.log('🍪 Document ready state:', document.readyState, 'Instance:', scriptInstanceId);
  if (document.readyState === 'loading') {
    console.log('🍪 Waiting for DOMContentLoaded...', 'Instance:', scriptInstanceId);
    document.addEventListener('DOMContentLoaded', () => {
      console.log('🍪 DOMContentLoaded fired, initializing panel', 'Instance:', scriptInstanceId);
      initPanel();
    });
  } else {
    console.log('🍪 DOM already ready, initializing panel immediately', 'Instance:', scriptInstanceId);
    initPanel();
  }
  
})();