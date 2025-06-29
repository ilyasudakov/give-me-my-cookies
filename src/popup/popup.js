document.addEventListener('DOMContentLoaded', function() {
  const newSourceUrlInput = document.getElementById('newSourceUrl');
  const addSourceBtn = document.getElementById('addSource');
  const manualTransferBtn = document.getElementById('manualTransfer');
  const clearBtn = document.getElementById('clearLocalhost');
  const pauseExtensionToggle = document.getElementById('isExtensionPaused');
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
      }
    } catch (error) {
      console.error('Error getting current tab for placeholder:', error);
      // Keep default placeholder if there's an error
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

  // Auto-transfer toggle
  pauseExtensionToggle.addEventListener('change', async function() {
    await chrome.storage.local.set({ isExtensionPaused: pauseExtensionToggle.checked });
    await chrome.runtime.sendMessage({
      action: 'updateAutoTransfer',
      enabled: pauseExtensionToggle.checked
    });
    showStatus(pauseExtensionToggle.checked ? 'Auto-transfer enabled' : 'Auto-transfer disabled', 'info');
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