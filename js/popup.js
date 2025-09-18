class PopupPage {
  constructor() {
    this.status = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadStatus();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    document.getElementById('extensionToggle').addEventListener('change', this.toggleExtension.bind(this));
    document.getElementById('openOptionsBtn').addEventListener('click', this.openOptions.bind(this));
    document.getElementById('clearLogsBtn').addEventListener('click', this.clearLogs.bind(this));
    document.getElementById('helpLink').addEventListener('click', this.openHelp.bind(this));
    document.getElementById('feedbackLink').addEventListener('click', this.openFeedback.bind(this));

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'LOG_UPDATED') {
        this.updateLogs(message.logs);
      }
    });
  }

  async loadStatus() {
    try {
      this.status = await this.sendMessage({ type: 'GET_STATUS' });
      this.updateUI();
    } catch (error) {
      console.error('Failed to load status:', error);
      this.showError('Failed to load extension status');
    }
  }

  updateUI() {
    if (!this.status) return;

    const toggle = document.getElementById('extensionToggle');
    const statusElement = document.getElementById('extensionStatus');
    const rulesCount = document.getElementById('rulesCount');
    const recentHits = document.getElementById('recentHits');

    toggle.checked = this.status.isEnabled;
    
    statusElement.textContent = this.status.isEnabled ? 'Enabled' : 'Disabled';
    statusElement.className = `status-value ${this.status.isEnabled ? 'enabled' : 'disabled'}`;
    
    rulesCount.textContent = this.status.rulesCount || 0;
    
    const recentLogsCount = (this.status.logs || []).filter(
      log => Date.now() - log.timestamp < 24 * 60 * 60 * 1000
    ).length;
    recentHits.textContent = recentLogsCount;

    this.updateLogs(this.status.logs || []);
  }

  updateLogs(logs) {
    const logsList = document.getElementById('logsList');
    const noLogs = document.getElementById('noLogs');

    const recentLogs = logs.slice(0, 5);

    if (recentLogs.length === 0) {
      logsList.style.display = 'none';
      noLogs.style.display = 'block';
      return;
    }

    logsList.style.display = 'block';
    noLogs.style.display = 'none';

    logsList.innerHTML = recentLogs.map(log => {
      const isError = log.responseStatus >= 400;
      const timeAgo = this.timeAgo(log.timestamp);
      
      return `
        <div class="log-item ${isError ? 'error' : 'success'}">
          <div class="log-timestamp">${timeAgo}</div>
          <div class="log-url">
            <span class="log-method ${log.method}">${log.method}</span>
            ${this.truncateUrl(log.url)}
          </div>
          <div class="log-rule">Rule: ${this.escapeHtml(log.ruleName)}</div>
        </div>
      `;
    }).join('');
  }

  async toggleExtension() {
    try {
      const result = await this.sendMessage({ type: 'TOGGLE_EXTENSION' });
      this.status.isEnabled = result.isEnabled;
      this.updateUI();
      
      this.showNotification(
        result.isEnabled ? 'Extension enabled' : 'Extension disabled'
      );
    } catch (error) {
      console.error('Failed to toggle extension:', error);
      this.showError('Failed to toggle extension');
      document.getElementById('extensionToggle').checked = this.status.isEnabled;
    }
  }

  async clearLogs() {
    try {
      await this.sendMessage({ type: 'CLEAR_LOGS' });
      this.status.logs = [];
      this.updateUI();
      this.showNotification('Logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      this.showError('Failed to clear logs');
    }
  }

  openOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  openHelp(e) {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('help.html')
    });
    window.close();
  }

  openFeedback(e) {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/your-repo/requestly/issues'
    });
    window.close();
  }

  startAutoRefresh() {
    setInterval(() => {
      this.loadStatus();
    }, 5000);
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.5rem 1rem;
      border-radius: 4px;
      color: white;
      z-index: 10000;
      font-size: 0.8rem;
      font-weight: 500;
      background: ${type === 'error' ? '#f44336' : '#4caf50'};
      animation: slideDown 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  truncateUrl(url) {
    if (url.length <= 40) return this.escapeHtml(url);
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname + urlObj.search;
      
      if (domain.length + path.length <= 37) {
        return this.escapeHtml(`${domain}${path}`);
      }
      
      return this.escapeHtml(`${domain}${path.substring(0, 37 - domain.length)}...`);
    } catch (e) {
      return this.escapeHtml(url.substring(0, 37) + '...');
    }
  }

  timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const popupPage = new PopupPage();