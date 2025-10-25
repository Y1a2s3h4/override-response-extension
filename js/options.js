class OptionsPage {
  constructor() {
    this.rules = [];
    this.logs = [];
    this.currentRule = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadData();
    this.setupTabs();
  }

  setupEventListeners() {
    document.getElementById('extensionToggle').addEventListener('change', this.toggleExtension.bind(this));
    document.getElementById('addRuleBtn').addEventListener('click', this.showAddRuleModal.bind(this));
    document.getElementById('importRulesBtn').addEventListener('click', this.importRules.bind(this));
    document.getElementById('exportRulesBtn').addEventListener('click', this.exportRules.bind(this));
    document.getElementById('clearLogsBtn').addEventListener('click', this.clearLogs.bind(this));
    document.getElementById('refreshLogsBtn').addEventListener('click', this.loadLogs.bind(this));
    document.getElementById('saveSettingsBtn').addEventListener('click', this.saveSettings.bind(this));
    document.getElementById('resetSettingsBtn').addEventListener('click', this.resetSettings.bind(this));

    document.getElementById('ruleSearch').addEventListener('input', this.filterRules.bind(this));
    document.getElementById('ruleFilter').addEventListener('change', this.filterRules.bind(this));

    document.querySelector('.modal-close').addEventListener('click', this.hideModal.bind(this));
    document.getElementById('ruleModal').addEventListener('click', (e) => {
      if (e.target.id === 'ruleModal') this.hideModal();
    });

    document.getElementById('ruleForm').addEventListener('submit', this.saveRule.bind(this));
    document.getElementById('actionType').addEventListener('change', this.updateActionUI.bind(this));
    document.getElementById('formatJsonBtn').addEventListener('click', this.formatJSON.bind(this));
    document.getElementById('loadTemplateBtn').addEventListener('click', this.loadTemplate.bind(this));
    document.getElementById('validateBtn').addEventListener('click', this.validateResponse.bind(this));
    document.getElementById('responseType').addEventListener('change', this.updateResponseUI.bind(this));
    document.getElementById('addPatchBtn').addEventListener('click', this.addPatchField.bind(this));
    document.getElementById('testRuleBtn').addEventListener('click', this.testRule.bind(this));

    document.getElementById('importFileInput').addEventListener('change', this.handleFileImport.bind(this));
  }

  setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        if (tabId === 'logs') {
          this.loadLogs();
        }
      });
    });
  }

  async loadData() {
    try {
      const status = await this.sendMessage({ type: 'GET_STATUS' });
      document.getElementById('extensionToggle').checked = status?.isEnabled || false;

      const rulesData = await this.sendMessage({ type: 'GET_RULES' });
      this.rules = rulesData?.rules || [];
      this.renderRules();

      this.logs = status?.logs || [];
      this.renderLogs();
    } catch (error) {
      console.error('Override Response Options: Failed to load data:', error);
      this.showNotification('Failed to connect to extension. Please reload the page.', 'error');
    }
  }

  async toggleExtension() {
    try {
      const result = await this.sendMessage({ type: 'TOGGLE_EXTENSION' });
      this.showNotification(result?.isEnabled ? 'Extension enabled' : 'Extension disabled');
    } catch (error) {
      console.error('Override Response Options: Failed to toggle extension:', error);
      this.showNotification(`Failed to toggle extension: ${error.message}`, 'error');
    }
  }

  showAddRuleModal() {
    this.currentRule = null;
    document.getElementById('modalTitle').textContent = 'Add Rule';
    document.getElementById('ruleForm').reset();
    document.getElementById('statusCode').value = '200';
    document.getElementById('responseType').value = 'json';
    document.getElementById('customContentType').value = 'application/json';
    this.updateActionUI();
    document.getElementById('ruleModal').classList.add('active');
  }

  showEditRuleModal(rule) {
    this.currentRule = rule;
    document.getElementById('modalTitle').textContent = 'Edit Rule';

    document.getElementById('ruleName').value = rule.name;
    document.getElementById('urlType').value = rule.matcher.url.type;
    document.getElementById('urlPattern').value = rule.matcher.url.value;
    document.getElementById('httpMethod').value = rule.matcher.method || '';
    document.getElementById('actionType').value = rule.action.type;
    document.getElementById('statusCode').value = rule.action.statusCode || 200;

    // Set response type and content-type
    const responseType = rule.action.responseType || 'json';
    document.getElementById('responseType').value = responseType;
    document.getElementById('customContentType').value = rule.action.contentType || this.getDefaultContentType(responseType);

    if (rule.action.response) {
      if (responseType === 'json' && typeof rule.action.response === 'object') {
        document.getElementById('responseBody').value = JSON.stringify(rule.action.response, null, 2);
      } else {
        document.getElementById('responseBody').value = rule.action.response;
      }
    }

    if (rule.action.delay) {
      document.getElementById('delayMs').value = rule.action.delay;
    }

    this.updateActionUI();
    document.getElementById('ruleModal').classList.add('active');
  }

  hideModal() {
    document.getElementById('ruleModal').classList.remove('active');
  }

  updateActionUI() {
    const actionType = document.getElementById('actionType').value;

    document.getElementById('responseEditor').style.display =
      actionType === 'replace' || actionType === 'status' ? 'block' : 'none';

    document.getElementById('patchEditor').style.display =
      actionType === 'patch' ? 'block' : 'none';

    document.getElementById('delayEditor').style.display =
      actionType === 'delay' ? 'block' : 'none';

    if (actionType === 'replace' || actionType === 'status') {
      this.updateResponseUI();
    }
  }

  updateResponseUI() {
    const responseType = document.getElementById('responseType').value;
    const textarea = document.getElementById('responseBody');
    const customContentType = document.getElementById('customContentType');
    const formatBtn = document.getElementById('formatJsonBtn');
    const validateBtn = document.getElementById('validateBtn');

    // Update placeholder and format button visibility
    switch (responseType) {
      case 'json':
        textarea.placeholder = '{"message": "Hello World", "status": "success"}';
        customContentType.placeholder = 'application/json';
        formatBtn.style.display = 'inline-block';
        validateBtn.textContent = 'Validate JSON';
        break;
      case 'text':
        textarea.placeholder = 'Plain text response content';
        customContentType.placeholder = 'text/plain';
        formatBtn.style.display = 'none';
        validateBtn.textContent = 'Validate Text';
        break;
      case 'html':
        textarea.placeholder = '<html><body><h1>Custom Response</h1></body></html>';
        customContentType.placeholder = 'text/html';
        formatBtn.style.display = 'none';
        validateBtn.textContent = 'Validate HTML';
        break;
      case 'xml':
        textarea.placeholder = '<?xml version="1.0"?><root><message>Hello</message></root>';
        customContentType.placeholder = 'application/xml';
        formatBtn.style.display = 'none';
        validateBtn.textContent = 'Validate XML';
        break;
      case 'javascript':
        textarea.placeholder = 'console.log("Custom JavaScript response");';
        customContentType.placeholder = 'application/javascript';
        formatBtn.style.display = 'none';
        validateBtn.textContent = 'Validate JS';
        break;
      case 'css':
        textarea.placeholder = 'body { background-color: #f0f0f0; }';
        customContentType.placeholder = 'text/css';
        formatBtn.style.display = 'none';
        validateBtn.textContent = 'Validate CSS';
        break;
    }

    // Auto-set content-type if empty
    if (!customContentType.value) {
      customContentType.value = customContentType.placeholder;
    }
  }

  formatJSON() {
    const textarea = document.getElementById('responseBody');
    try {
      const parsed = JSON.parse(textarea.value);
      textarea.value = JSON.stringify(parsed, null, 2);
      this.showNotification('JSON formatted successfully');
    } catch (e) {
      this.showNotification('Invalid JSON format', 'error');
    }
  }

  loadTemplate() {
    const responseType = document.getElementById('responseType').value;
    const textarea = document.getElementById('responseBody');

    const templates = {
      json: {
        'Success Response': '{\n  "success": true,\n  "message": "Operation completed successfully",\n  "data": {\n    "id": 123,\n    "name": "Example"\n  }\n}',
        'Error Response': '{\n  "success": false,\n  "error": {\n    "code": "VALIDATION_ERROR",\n    "message": "Invalid input parameters"\n  }\n}',
        'List Response': '{\n  "data": [\n    {"id": 1, "name": "Item 1"},\n    {"id": 2, "name": "Item 2"}\n  ],\n  "pagination": {\n    "page": 1,\n    "total": 10\n  }\n}'
      },
      html: {
        'Basic HTML': '<!DOCTYPE html>\n<html>\n<head>\n    <title>Custom Response</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n    <p>This is a custom HTML response.</p>\n</body>\n</html>',
        'Error Page': '<!DOCTYPE html>\n<html>\n<head>\n    <title>Error</title>\n</head>\n<body>\n    <h1>404 - Not Found</h1>\n    <p>The requested resource was not found.</p>\n</body>\n</html>'
      },
      text: {
        'Plain Text': 'This is a plain text response.',
        'CSV Data': 'Name,Email,Age\nJohn Doe,john@example.com,30\nJane Smith,jane@example.com,25',
        'Log Entry': '[2024-01-16 12:00:00] INFO: Custom log message'
      },
      xml: {
        'Basic XML': '<?xml version="1.0" encoding="UTF-8"?>\n<response>\n    <status>success</status>\n    <message>Operation completed</message>\n</response>',
        'RSS Feed': '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n    <channel>\n        <title>Custom RSS</title>\n        <item>\n            <title>Custom Item</title>\n            <description>Custom description</description>\n        </item>\n    </channel>\n</rss>'
      },
      javascript: {
        'Console Log': 'console.log("Custom JavaScript response");',
        'Object Response': 'window.customResponse = {\n    message: "Hello from injected JS",\n    timestamp: Date.now()\n};'
      },
      css: {
        'Basic Styles': 'body {\n    background-color: #f0f0f0;\n    font-family: Arial, sans-serif;\n}\n\nh1 {\n    color: #333;\n    text-align: center;\n}',
        'Dark Theme': 'body {\n    background-color: #1a1a1a;\n    color: #ffffff;\n}\n\na {\n    color: #4CAF50;\n}'
      }
    };

    const typeTemplates = templates[responseType];
    if (!typeTemplates) {
      this.showNotification('No templates available for this type', 'error');
      return;
    }

    const templateNames = Object.keys(typeTemplates);
    const selectedTemplate = prompt(
      `Select a template:\n${templateNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\nEnter template number:`
    );

    const templateIndex = parseInt(selectedTemplate) - 1;
    if (templateIndex >= 0 && templateIndex < templateNames.length) {
      const templateName = templateNames[templateIndex];
      textarea.value = typeTemplates[templateName];
      this.showNotification(`Template "${templateName}" loaded`);
    }
  }

  validateResponse() {
    const responseType = document.getElementById('responseType').value;
    const content = document.getElementById('responseBody').value.trim();

    if (!content) {
      this.showNotification('Please enter response content', 'error');
      return;
    }

    try {
      switch (responseType) {
        case 'json':
          JSON.parse(content);
          this.showNotification('✅ Valid JSON format');
          break;
        case 'xml':
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'application/xml');
          const parseError = doc.querySelector('parsererror');
          if (parseError) {
            throw new Error('Invalid XML format');
          }
          this.showNotification('✅ Valid XML format');
          break;
        case 'html':
          const htmlParser = new DOMParser();
          const htmlDoc = htmlParser.parseFromString(content, 'text/html');
          this.showNotification('✅ HTML content validated');
          break;
        default:
          this.showNotification(`✅ ${responseType.toUpperCase()} content validated`);
      }
    } catch (error) {
      this.showNotification(`❌ Invalid ${responseType.toUpperCase()}: ${error.message}`, 'error');
    }
  }

  addPatchField() {
    const container = document.getElementById('patchesList');
    const patchDiv = document.createElement('div');
    patchDiv.className = 'patch-item';
    patchDiv.innerHTML = `
      <input type="text" placeholder="path (e.g., data.user.name)" class="patch-path">
      <input type="text" placeholder="value" class="patch-value">
      <button type="button" class="patch-remove">×</button>
    `;

    patchDiv.querySelector('.patch-remove').addEventListener('click', () => {
      patchDiv.remove();
    });

    container.appendChild(patchDiv);
  }

  async saveRule(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const rule = {
      name: document.getElementById('ruleName').value,
      matcher: {
        url: {
          type: document.getElementById('urlType').value,
          value: document.getElementById('urlPattern').value
        },
        method: document.getElementById('httpMethod').value || null
      },
      action: {
        type: document.getElementById('actionType').value,
        statusCode: parseInt(document.getElementById('statusCode').value) || 200
      }
    };

    if (rule.action.type === 'replace' || rule.action.type === 'status') {
      const responseText = document.getElementById('responseBody').value;
      const responseType = document.getElementById('responseType').value;
      const customContentType = document.getElementById('customContentType').value;

      if (responseText) {
        rule.action.responseType = responseType;
        rule.action.contentType = customContentType || this.getDefaultContentType(responseType);

        if (responseType === 'json') {
          try {
            rule.action.response = JSON.parse(responseText);
          } catch (e) {
            this.showNotification('Invalid JSON in response body', 'error');
            return;
          }
        } else {
          rule.action.response = responseText;
        }
      }
    }

    if (rule.action.type === 'patch') {
      const patches = [];
      document.querySelectorAll('.patch-item').forEach(item => {
        const path = item.querySelector('.patch-path').value;
        const value = item.querySelector('.patch-value').value;
        if (path && value) {
          patches.push({ path, value });
        }
      });
      rule.action.patches = patches;
    }

    if (rule.action.type === 'delay') {
      rule.action.delay = parseInt(document.getElementById('delayMs').value) || 1000;
    }

    try {
      let result;
      if (this.currentRule) {
        result = await this.sendMessage({
          type: 'UPDATE_RULE',
          ruleId: this.currentRule.id,
          updates: rule
        });
      } else {
        result = await this.sendMessage({
          type: 'ADD_RULE',
          rule
        });
      }

      if (result && result.success) {
        this.hideModal();
        this.loadData();
        this.showNotification('Rule saved successfully');
      } else {
        this.showNotification(result?.error || 'Failed to save rule', 'error');
      }
    } catch (error) {
      console.error('Override Response Options: Failed to save rule:', error);
      this.showNotification(`Failed to save rule: ${error.message}`, 'error');
    }
  }

  async deleteRule(ruleId) {
    if (confirm('Are you sure you want to delete this rule?')) {
      try {
        const result = await this.sendMessage({
          type: 'DELETE_RULE',
          ruleId
        });

        if (result && result.success) {
          this.loadData();
          this.showNotification('Rule deleted successfully');
        } else {
          this.showNotification(result?.error || 'Failed to delete rule', 'error');
        }
      } catch (error) {
        console.error('Override Response Options: Failed to delete rule:', error);
        this.showNotification(`Failed to delete rule: ${error.message}`, 'error');
      }
    }
  }

  async toggleRule(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      try {
        const result = await this.sendMessage({
          type: 'UPDATE_RULE',
          ruleId,
          updates: { enabled: !rule.enabled }
        });

        if (result && result.success) {
          this.loadData();
          this.showNotification(`Rule ${!rule.enabled ? 'enabled' : 'disabled'} successfully`);
        } else {
          this.showNotification(result?.error || 'Failed to update rule', 'error');
        }
      } catch (error) {
        console.error('Override Response Options: Failed to toggle rule:', error);
        this.showNotification(`Failed to toggle rule: ${error.message}`, 'error');
      }
    }
  }

  renderRules() {
    const container = document.getElementById('rulesList');
    const noRules = document.getElementById('noRules');

    if (this.rules.length === 0) {
      container.style.display = 'none';
      noRules.style.display = 'block';
      return;
    }

    container.style.display = 'block';
    noRules.style.display = 'none';

    container.innerHTML = '';

    this.rules.forEach(rule => {
      const ruleElement = document.createElement('div');
      ruleElement.className = `rule-item ${rule.enabled ? '' : 'disabled'}`;
      ruleElement.innerHTML = `
        <div class="rule-header">
          <div class="rule-name">${this.escapeHtml(rule.name)}</div>
          <div class="rule-status ${rule.enabled ? 'enabled' : 'disabled'}">
            ${rule.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div class="rule-details">
          <div class="rule-detail">
            <div class="rule-detail-label">URL Pattern</div>
            <div class="rule-detail-value">${this.escapeHtml(rule.matcher.url.value)} (${rule.matcher.url.type})</div>
          </div>
          <div class="rule-detail">
            <div class="rule-detail-label">Action</div>
            <div class="rule-detail-value">${rule.action.type.toUpperCase()}</div>
          </div>
          <div class="rule-detail">
            <div class="rule-detail-label">Method</div>
            <div class="rule-detail-value">${rule.matcher.method || 'Any'}</div>
          </div>
          <div class="rule-detail">
            <div class="rule-detail-label">Status Code</div>
            <div class="rule-detail-value">${rule.action.statusCode || 200}</div>
          </div>
        </div>
        <div class="rule-actions">
          <button class="btn btn-secondary btn-small toggle-btn">
            ${rule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn-secondary btn-small edit-btn">
            Edit
          </button>
          <button class="btn btn-danger btn-small delete-btn">
            Delete
          </button>
        </div>
      `;

      // Add event listeners
      const toggleBtn = ruleElement.querySelector('.toggle-btn');
      const editBtn = ruleElement.querySelector('.edit-btn');
      const deleteBtn = ruleElement.querySelector('.delete-btn');

      toggleBtn.addEventListener('click', () => this.toggleRule(rule.id));
      editBtn.addEventListener('click', () => this.showEditRuleModal(rule));
      deleteBtn.addEventListener('click', () => this.deleteRule(rule.id));

      container.appendChild(ruleElement);
    });
  }

  filterRules() {
    const search = document.getElementById('ruleSearch').value.toLowerCase();
    const filter = document.getElementById('ruleFilter').value;

    const filteredRules = this.rules.filter(rule => {
      const matchesSearch = rule.name.toLowerCase().includes(search) ||
        rule.matcher.url.value.toLowerCase().includes(search);
      const matchesFilter = filter === 'all' ||
        (filter === 'enabled' && rule.enabled) ||
        (filter === 'disabled' && !rule.enabled);

      return matchesSearch && matchesFilter;
    });

    this.renderFilteredRules(filteredRules);
  }

  renderFilteredRules(filteredRules) {
    const container = document.getElementById('rulesList');
    const noRules = document.getElementById('noRules');

    if (filteredRules.length === 0) {
      container.style.display = 'none';
      noRules.style.display = 'block';
      return;
    }

    container.style.display = 'block';
    noRules.style.display = 'none';

    container.innerHTML = '';

    filteredRules.forEach(rule => {
      const ruleElement = document.createElement('div');
      ruleElement.className = `rule-item ${rule.enabled ? '' : 'disabled'}`;
      ruleElement.innerHTML = `
        <div class="rule-header">
          <div class="rule-name">${this.escapeHtml(rule.name)}</div>
          <div class="rule-status ${rule.enabled ? 'enabled' : 'disabled'}">
            ${rule.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div class="rule-details">
          <div class="rule-detail">
            <div class="rule-detail-label">URL Pattern</div>
            <div class="rule-detail-value">${this.escapeHtml(rule.matcher.url.value)} (${rule.matcher.url.type})</div>
          </div>
          <div class="rule-detail">
            <div class="rule-detail-label">Action</div>
            <div class="rule-detail-value">${rule.action.type.toUpperCase()}</div>
          </div>
          <div class="rule-detail">
            <div class="rule-detail-label">Method</div>
            <div class="rule-detail-value">${rule.matcher.method || 'Any'}</div>
          </div>
          <div class="rule-detail">
            <div class="rule-detail-label">Status Code</div>
            <div class="rule-detail-value">${rule.action.statusCode || 200}</div>
          </div>
        </div>
        <div class="rule-actions">
          <button class="btn btn-secondary btn-small toggle-btn">
            ${rule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn-secondary btn-small edit-btn">
            Edit
          </button>
          <button class="btn btn-danger btn-small delete-btn">
            Delete
          </button>
        </div>
      `;

      // Add event listeners
      const toggleBtn = ruleElement.querySelector('.toggle-btn');
      const editBtn = ruleElement.querySelector('.edit-btn');
      const deleteBtn = ruleElement.querySelector('.delete-btn');

      toggleBtn.addEventListener('click', () => this.toggleRule(rule.id));
      editBtn.addEventListener('click', () => this.showEditRuleModal(rule));
      deleteBtn.addEventListener('click', () => this.deleteRule(rule.id));

      container.appendChild(ruleElement);
    });
  }

  async loadLogs() {
    const result = await this.sendMessage({ type: 'GET_LOGS' });
    this.logs = result.logs || [];
    this.renderLogs();
  }

  renderLogs() {
    const container = document.getElementById('logsList');
    const noLogs = document.getElementById('noLogs');

    if (this.logs.length === 0) {
      container.style.display = 'none';
      noLogs.style.display = 'block';
      return;
    }

    container.style.display = 'block';
    noLogs.style.display = 'none';

    container.innerHTML = this.logs.map(log => `
      <div class="log-item ${log.responseStatus >= 400 ? 'error' : 'success'}">
        <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
        <div class="log-url">
          <span class="log-method ${log.method}">${log.method}</span>
          ${this.escapeHtml(log.url)}
        </div>
        <div>Rule: <strong>${this.escapeHtml(log.ruleName)}</strong></div>
        <div>Action: <strong>${log.action.type.toUpperCase()}</strong></div>
        ${log.responseStatus ? `<div>Status: <strong>${log.responseStatus}</strong></div>` : ''}
      </div>
    `).join('');
  }

  async clearLogs() {
    if (confirm('Are you sure you want to clear all logs?')) {
      await this.sendMessage({ type: 'CLEAR_LOGS' });
      this.logs = [];
      this.renderLogs();
      this.showNotification('Logs cleared successfully');
    }
  }

  async exportRules() {
    const result = await this.sendMessage({ type: 'EXPORT_RULES' });
    const dataStr = JSON.stringify(result, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'override-response-rules.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    this.showNotification('Rules exported successfully');
  }

  importRules() {
    document.getElementById('importFileInput').click();
  }

  async handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.rules || !Array.isArray(data.rules)) {
        throw new Error('Invalid file format');
      }

      const result = await this.sendMessage({
        type: 'IMPORT_RULES',
        rules: data.rules
      });

      if (result.success) {
        this.loadData();
        this.showNotification(`Imported ${result.imported} rules successfully`);
      } else {
        this.showNotification(result.error || 'Import failed', 'error');
      }
    } catch (error) {
      this.showNotification('Invalid JSON file', 'error');
    }

    e.target.value = '';
  }

  async saveSettings() {
    this.showNotification('Settings saved successfully');
  }

  async resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      document.getElementById('maxLogs').value = '1000';
      document.getElementById('allowedDomains').value = '';
      document.getElementById('maskSensitiveData').checked = false;
      this.showNotification('Settings reset to defaults');
    }
  }

  testRule() {
    const url = prompt('Enter a URL to test this rule against:');
    if (!url) return;

    const urlType = document.getElementById('urlType').value;
    const pattern = document.getElementById('urlPattern').value;
    const method = document.getElementById('httpMethod').value || 'GET';

    let matches = false;
    if (urlType === 'exact') {
      matches = url === pattern;
    } else if (urlType === 'prefix') {
      matches = url.startsWith(pattern);
    } else if (urlType === 'regex') {
      try {
        const regex = new RegExp(pattern);
        matches = regex.test(url);
      } catch (e) {
        this.showNotification('Invalid regex pattern', 'error');
        return;
      }
    }

    const message = matches ?
      `✅ Rule matches the URL: ${url}` :
      `❌ Rule does not match the URL: ${url}`;

    this.showNotification(message);
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Override Response Options: Runtime error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response === undefined) {
          console.error('Override Response Options: No response from background script');
          reject(new Error('Background script not responding'));
        } else {
          resolve(response);
        }
      });
    });
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 4px;
      color: white;
      z-index: 10000;
      font-weight: 500;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      background: ${type === 'error' ? '#f44336' : '#4caf50'};
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  getDefaultContentType(responseType) {
    const contentTypes = {
      json: 'application/json',
      text: 'text/plain',
      html: 'text/html',
      xml: 'application/xml',
      javascript: 'application/javascript',
      css: 'text/css'
    };
    return contentTypes[responseType] || 'text/plain';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const optionsPage = new OptionsPage();