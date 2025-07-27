document.addEventListener('DOMContentLoaded', function() {
  const newSourceUrlInput = document.getElementById('newSourceUrl');
  const addSourceBtn = document.getElementById('addSource');
  const manualTransferBtn = document.getElementById('manualTransfer');
  const clearBtn = document.getElementById('clearLocalhost');
  const pauseExtensionToggle = document.getElementById('isExtensionPaused');
  const useIncognitoToggle = document.getElementById('useIncognito');
  const incognitoStatusDiv = document.getElementById('incognitoStatus');
  const sourcesListDiv = document.getElementById('sourcesList');
  const statusDiv = document.getElementById('status');

  // Function definitions first
  function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Auto-clear status after 5 seconds for success/info messages
    if (type !== 'error') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 5000);
    }
  }

  async function loadAutoTransferSetting() {
    try {
      const result = await chrome.storage.local.get({ isExtensionPaused: false });
      pauseExtensionToggle.checked = result.isExtensionPaused;
    } catch (error) {
      console.error('Error loading auto-transfer setting:', error);
    }
  }

  async function setCurrentTabPlaceholder() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        newSourceUrlInput.placeholder = url.protocol + '//' + url.hostname;
        
        // Update incognito status
        updateIncognitoStatus(tab.incognito);
        
        // Log initial state summary
        logInitialState(tab, url);
      }
    } catch (error) {
      console.error('Error getting current tab for placeholder:', error);
      // Keep default placeholder if there's an error
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

  function updateIncognitoStatus(isIncognito) {
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

  async function getCurrentTabIncognitoState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab ? tab.incognito : false;
    } catch (error) {
      console.error('Error getting current tab incognito state:', error);
      return false;
    }
  }

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

  async function logExtensionSettings() {
    try {
      console.log('\n⚙️ Extension Settings:');
      
      // Get storage settings
      const storage = await chrome.storage.local.get();
      console.log(`├─ Auto-transfer enabled: ${!storage.isExtensionPaused ? '✅ Yes' : '❌ No'}`);
      console.log(`├─ Source URLs count: ${storage.sourceUrls?.length || 0}`);
      
      if (storage.sourceUrls?.length > 0) {
        console.log('├─ Configured sources:');
        storage.sourceUrls.forEach((source, index) => {
          const status = source.enabled ? '✅' : '❌';
          console.log(`│  ${index + 1}. ${status} ${source.url}`);
        });
      }
      
      // Get cookie stores
      const cookieStores = await chrome.cookies.getAllCookieStores();
      console.log(`├─ Available cookie stores: ${cookieStores.length}`);
      cookieStores.forEach((store, index) => {
        const storeType = store.tabIds.length === 0 ? '🕵️ Incognito' : '👤 Normal';
        console.log(`│  Store ${index + 1}: ${storeType} (ID: ${store.id}, Tabs: ${store.tabIds.length})`);
      });
      
      console.log('└─ Extension ready!\n');
      
    } catch (error) {
      console.error('Error logging extension settings:', error);
    }
  }

  async function loadSourcesList() {
    try {
      const result = await chrome.storage.local.get({ sourceUrls: [] });
      const sourceUrls = result.sourceUrls;
      
      if (sourceUrls.length === 0) {
        sourcesListDiv.innerHTML = '<div class="empty-state">No production sources added yet</div>';
        return;
      }
      
      sourcesListDiv.innerHTML = sourceUrls.map((source, index) => `
        <div class="source-item ${source.enabled ? '' : 'disabled'}" draggable="true" data-index="${index}">
          <div class="source-url">${source.url}</div>
          <div class="source-actions">
            <button data-action="remove" data-index="${index}" class="danger" title="Remove">
              🗑️
            </button>
          </div>
        </div>
      `).join('');
      
      // Add event listeners to the newly created buttons
      attachSourceButtonListeners();
    } catch (error) {
      console.error('Error loading sources list:', error);
      sourcesListDiv.innerHTML = '<div style="color: #999;">Error loading sources</div>';
    }
  }

  function attachSourceButtonListeners() {
    const actionButtons = sourcesListDiv.querySelectorAll('[data-action]');
    actionButtons.forEach(button => {
      button.addEventListener('click', async function() {
        const action = button.getAttribute('data-action');
        const index = parseInt(button.getAttribute('data-index'));
        
        if (action === 'remove') {
          await removeSource(index);
        }
      });
    });
    
    // Add drag and drop listeners
    attachDragDropListeners();
  }

  function attachDragDropListeners() {
    const sourceItems = sourcesListDiv.querySelectorAll('.source-item');
    let draggedElement = null;
    let draggedIndex = null;

    sourceItems.forEach((item, index) => {
      item.addEventListener('dragstart', function(e) {
        draggedElement = this;
        draggedIndex = parseInt(this.getAttribute('data-index'));
        this.classList.add('dragging');
        
        // Set drag effect
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.outerHTML);
      });

      item.addEventListener('dragend', function(e) {
        this.classList.remove('dragging');
        // Remove all drag-over classes
        sourceItems.forEach(item => item.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', function(e) {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('dragenter', function(e) {
        e.preventDefault();
        if (this !== draggedElement) {
          this.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', function(e) {
        // Only remove drag-over if we're actually leaving the element
        if (!this.contains(e.relatedTarget)) {
          this.classList.remove('drag-over');
        }
      });

      item.addEventListener('drop', async function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        if (this !== draggedElement) {
          const dropIndex = parseInt(this.getAttribute('data-index'));
          await reorderSources(draggedIndex, dropIndex);
        }
      });
    });
  }

  async function reorderSources(fromIndex, toIndex) {
    try {
      const result = await chrome.storage.local.get({ sourceUrls: [] });
      const sourceUrls = result.sourceUrls;
      
      // Remove the item from its original position
      const [movedItem] = sourceUrls.splice(fromIndex, 1);
      
      // Insert it at the new position
      sourceUrls.splice(toIndex, 0, movedItem);
      
      // Save the reordered array
      await chrome.storage.local.set({ sourceUrls });
      
      // Reload the list to reflect new order
      loadSourcesList();
      
      showStatus('Sources reordered successfully', 'success');
    } catch (error) {
      showStatus('Error reordering sources: ' + error.message, 'error');
    }
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

  // Load initial data on popup open
  loadSourcesList();
  loadAutoTransferSetting();
  setCurrentTabPlaceholder();
  logExtensionSettings();

  // Auto-transfer toggle
  pauseExtensionToggle.addEventListener('change', async function() {
    await chrome.storage.local.set({ isExtensionPaused: pauseExtensionToggle.checked });
    await chrome.runtime.sendMessage({
      action: 'updateAutoTransfer',
      enabled: !pauseExtensionToggle.checked // Invert because checkbox is "Pause extension"
    });
    showStatus(pauseExtensionToggle.checked ? 'Auto-transfer disabled' : 'Auto-transfer enabled', 'info');
  });

  // Add source URL
  addSourceBtn.addEventListener('click', async function() {
    let sourceUrl = newSourceUrlInput.value.trim();
    
    // If input is empty, use current tab's URL
    if (!sourceUrl) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
          const url = new URL(tab.url);
          // Only use URLs with http or https protocol
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
      new URL(sourceUrl); // Validate URL
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
  manualTransferBtn.addEventListener('click', async function() {
    try {
      manualTransferBtn.disabled = true;
      manualTransferBtn.textContent = 'Transferring...';
      
      const isIncognito = useIncognitoToggle.checked;
      const modeText = isIncognito ? ' (incognito mode)' : ' (normal mode)';
      showStatus('Starting manual transfer' + modeText + '...', 'info');

      // Get current tab info for store ID
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
  clearBtn.addEventListener('click', async function() {
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
}); 