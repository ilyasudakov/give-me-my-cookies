document.addEventListener('DOMContentLoaded', function() {
  const newSourceUrlInput = document.getElementById('newSourceUrl');
  const detectSourceBtn = document.getElementById('detectSource');
  const addSourceBtn = document.getElementById('addSource');
  const manualTransferBtn = document.getElementById('manualTransfer');
  const clearBtn = document.getElementById('clearLocalhost');
  const autoTransferToggle = document.getElementById('autoTransferEnabled');
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
      const result = await chrome.storage.local.get({ autoTransferEnabled: true });
      autoTransferToggle.checked = result.autoTransferEnabled;
    } catch (error) {
      console.error('Error loading auto-transfer setting:', error);
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
        <div class="source-item ${source.enabled ? '' : 'disabled'}">
          <div class="source-url">${source.url}</div>
          <div class="source-actions">
            <button data-action="toggle" data-index="${index}" title="${source.enabled ? 'Disable' : 'Enable'}">
              ${source.enabled ? '⏸️' : '▶️'}
            </button>
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
        
        if (action === 'toggle') {
          await toggleSource(index);
        } else if (action === 'remove') {
          await removeSource(index);
        }
      });
    });
  }

  async function toggleSource(index) {
    try {
      const result = await chrome.storage.local.get({ sourceUrls: [] });
      const sourceUrls = result.sourceUrls;
      
      if (sourceUrls[index]) {
        sourceUrls[index].enabled = !sourceUrls[index].enabled;
        await chrome.storage.local.set({ sourceUrls });
        loadSourcesList();
        showStatus(sourceUrls[index].enabled ? 'Source enabled' : 'Source disabled', 'info');
      }
    } catch (error) {
      showStatus('Error toggling source: ' + error.message, 'error');
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

  // Auto-transfer toggle
  autoTransferToggle.addEventListener('change', async function() {
    await chrome.storage.local.set({ autoTransferEnabled: autoTransferToggle.checked });
    await chrome.runtime.sendMessage({
      action: 'updateAutoTransfer',
      enabled: autoTransferToggle.checked
    });
    showStatus(autoTransferToggle.checked ? 'Auto-transfer enabled' : 'Auto-transfer disabled', 'info');
  });

  // Add source URL
  addSourceBtn.addEventListener('click', async function() {
    const sourceUrl = newSourceUrlInput.value.trim();
    
    if (!sourceUrl) {
      showStatus('Please enter a source URL', 'error');
      return;
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
      showStatus('Starting manual transfer...', 'info');

      const result = await chrome.runtime.sendMessage({
        action: 'manualTransfer'
      });

      if (result.success) {
        showStatus(`Successfully transferred ${result.totalCookies} cookies from ${result.sourceCount} sources`, 'success');
      } else {
        showStatus('Transfer failed: ' + result.error, 'error');
      }
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    } finally {
      manualTransferBtn.disabled = false;
      manualTransferBtn.textContent = 'Manual Transfer Now';
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
      clearBtn.textContent = 'Clear Localhost Cookies';
    }
  });
}); 