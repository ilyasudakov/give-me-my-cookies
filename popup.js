document.addEventListener('DOMContentLoaded', function() {
  const sourceUrlInput = document.getElementById('sourceUrl');
  const targetUrlInput = document.getElementById('targetUrl');
  const cookieFilterInput = document.getElementById('cookieFilter');
  const detectSourceBtn = document.getElementById('detectSource');
  const transferBtn = document.getElementById('transferCookies');
  const clearBtn = document.getElementById('clearLocalhost');
  const statusDiv = document.getElementById('status');
  const recentTransfersDiv = document.getElementById('recentTransfers');

  // Load recent transfers on popup open
  loadRecentTransfers();

  // Detect current tab URL
  detectSourceBtn.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        sourceUrlInput.value = `${url.protocol}//${url.host}`;
        showStatus('Current tab URL detected', 'info');
      }
    } catch (error) {
      showStatus('Error detecting current tab: ' + error.message, 'error');
    }
  });

  // Transfer cookies
  transferBtn.addEventListener('click', async function() {
    const sourceUrl = sourceUrlInput.value.trim();
    const targetUrl = targetUrlInput.value.trim();
    const cookieFilter = cookieFilterInput.value.trim();

    if (!sourceUrl || !targetUrl) {
      showStatus('Please enter both source and target URLs', 'error');
      return;
    }

    try {
      transferBtn.disabled = true;
      transferBtn.textContent = 'Transferring...';
      showStatus('Starting cookie transfer...', 'info');

      const result = await chrome.runtime.sendMessage({
        action: 'transferCookies',
        sourceUrl: sourceUrl,
        targetUrl: targetUrl,
        cookieFilter: cookieFilter
      });

      if (result.success) {
        showStatus(`Successfully transferred ${result.count} cookies`, 'success');
        saveRecentTransfer(sourceUrl, targetUrl, result.count);
        loadRecentTransfers();
      } else {
        showStatus('Transfer failed: ' + result.error, 'error');
      }
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    } finally {
      transferBtn.disabled = false;
      transferBtn.textContent = 'Transfer Cookies';
    }
  });

  // Clear localhost cookies
  clearBtn.addEventListener('click', async function() {
    const targetUrl = targetUrlInput.value.trim();
    
    if (!targetUrl) {
      showStatus('Please enter target URL', 'error');
      return;
    }

    try {
      clearBtn.disabled = true;
      clearBtn.textContent = 'Clearing...';
      showStatus('Clearing localhost cookies...', 'info');

      const result = await chrome.runtime.sendMessage({
        action: 'clearCookies',
        targetUrl: targetUrl
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

  async function saveRecentTransfer(sourceUrl, targetUrl, count) {
    try {
      const result = await chrome.storage.local.get({ recentTransfers: [] });
      const transfers = result.recentTransfers;
      
      transfers.unshift({
        sourceUrl,
        targetUrl,
        count,
        timestamp: Date.now()
      });
      
      // Keep only last 5 transfers
      transfers.splice(5);
      
      await chrome.storage.local.set({ recentTransfers: transfers });
    } catch (error) {
      console.error('Error saving recent transfer:', error);
    }
  }

  async function loadRecentTransfers() {
    try {
      const result = await chrome.storage.local.get({ recentTransfers: [] });
      const transfers = result.recentTransfers;
      
      if (transfers.length === 0) {
        recentTransfersDiv.innerHTML = '<div style="color: #999; font-style: italic;">No recent transfers</div>';
        return;
      }
      
      recentTransfersDiv.innerHTML = transfers.map(transfer => {
        const date = new Date(transfer.timestamp);
        const sourceHost = new URL(transfer.sourceUrl).host;
        const targetHost = new URL(transfer.targetUrl).host;
        
        return `
          <div class="transfer-item">
            <div class="transfer-time">${date.toLocaleString()}</div>
            <div class="transfer-details">
              ${sourceHost} → ${targetHost} (${transfer.count} cookies)
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error loading recent transfers:', error);
      recentTransfersDiv.innerHTML = '<div style="color: #999;">Error loading history</div>';
    }
  }
}); 