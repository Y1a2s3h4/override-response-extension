class OverrideResponseExtension {
  constructor() {
    this.isEnabled = true;
    this.rules = [];
    this.logs = [];
    this.maxLogs = 1000;
    this.injectedTabs = new Set();
    this.pendingTimers = new Map();

    this.init();
  }

  async init() {
    console.log('[OVERRIDE_RESPONSE] Extension initializing...');
    await this.loadSettings();
    await this.loadRules();
    this.setupEventListeners();
    this.updateBadge();
    console.log(`[OVERRIDE_RESPONSE] Extension initialized - Enabled: ${this.isEnabled}, Rules: ${this.rules.length}`);
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['isEnabled']);
      this.isEnabled = result.isEnabled !== false;
    } catch (error) {
      console.error('[OVERRIDE_RESPONSE] Failed to load settings:', error);
      this.isEnabled = true; // Fallback to default
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ isEnabled: this.isEnabled });
      this.updateBadge();
    } catch (error) {
      console.error('[OVERRIDE_RESPONSE] Failed to save settings:', error);
    }
  }

  async loadRules() {
    try {
      const result = await chrome.storage.local.get(['rules']);
      this.rules = result.rules || [];
    } catch (error) {
      console.error('[OVERRIDE_RESPONSE] Failed to load rules:', error);
      this.rules = [];
    }
  }

  async saveRules() {
    try {
      await chrome.storage.local.set({ rules: this.rules });
    } catch (error) {
      console.error('[OVERRIDE_RESPONSE] Failed to save rules:', error);
      throw error; // Re-throw so callers know it failed
    }
  }

  updateBadge() {
    const text = this.isEnabled ? 'ON' : 'OFF';
    const color = this.isEnabled ? '#4CAF50' : '#F44336';

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'RULE_UPDATED') {
        console.log('Override Response: Rules updated, refreshing all tabs');
        this.refreshAllTabs();
      }
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      console.log(`[OVERRIDE_RESPONSE] Tab event: ${tabId}, status: ${changeInfo.status}, url: ${tab.url}`);

      if (changeInfo.status === 'complete' && tab.url) {
        console.log(`[OVERRIDE_RESPONSE] Tab completed loading: ${tab.url}`);

        if (this.isEnabled && this.rules.length > 0) {
          // Only inject into http/https pages
          if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
            console.log(`[OVERRIDE_RESPONSE] 🎯 Will inject into tab ${tabId}: ${tab.url}`);
            console.log(`[OVERRIDE_RESPONSE] Extension enabled: ${this.isEnabled}, Rules count: ${this.rules.length}`);

            // Schedule injection with cleanup
            this.scheduleInjection(tabId, 1000);
          } else {
            console.log(`[OVERRIDE_RESPONSE] ⏭️ Skipping non-http tab: ${tab.url}`);
          }
        } else {
          console.log(`[OVERRIDE_RESPONSE] ⏭️ Not injecting - enabled: ${this.isEnabled}, rules: ${this.rules.length}`);
        }
      }
    });

    // Also listen for navigation events (for SPAs that don't trigger page reloads)
    chrome.webNavigation.onCompleted.addListener((details) => {
      // Only for main frame (not iframes)
      if (details.frameId === 0 && this.isEnabled && this.rules.length > 0) {
        if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
          console.log(`[OVERRIDE_RESPONSE] SPA navigation detected for tab ${details.tabId}: ${details.url}`);
          // Schedule injection with cleanup
          this.scheduleInjection(details.tabId, 500);
        }
      }
    });

    // Clean up when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTab(tabId);
    });
  }

  scheduleInjection(tabId, delay) {
    // Clear any existing timer for this tab
    if (this.pendingTimers.has(tabId)) {
      clearTimeout(this.pendingTimers.get(tabId));
    }

    const timer = setTimeout(() => {
      console.log(`[OVERRIDE_RESPONSE] 🚀 Starting injection for tab ${tabId}`);
      this.injectInterceptionScript(tabId);
      this.pendingTimers.delete(tabId);
    }, delay);

    this.pendingTimers.set(tabId, timer);
  }

  cleanupTab(tabId) {
    // Clear pending timer
    if (this.pendingTimers.has(tabId)) {
      clearTimeout(this.pendingTimers.get(tabId));
      this.pendingTimers.delete(tabId);
    }
    // Remove from injected tabs
    this.injectedTabs.delete(tabId);
    console.log(`[OVERRIDE_RESPONSE] Cleaned up tab ${tabId}`);
  }

  validateRule(rule) {
    // Validate rule structure
    if (!rule || typeof rule !== 'object') {
      throw new Error('Rule must be an object');
    }

    if (!rule.name || typeof rule.name !== 'string' || rule.name.trim() === '') {
      throw new Error('Rule must have a valid name');
    }

    if (!rule.matcher || typeof rule.matcher !== 'object') {
      throw new Error('Rule must have a matcher object');
    }

    if (!rule.matcher.url || typeof rule.matcher.url !== 'object') {
      throw new Error('Rule must have a valid URL matcher');
    }

    if (!rule.matcher.url.type || !['exact', 'prefix', 'regex'].includes(rule.matcher.url.type)) {
      throw new Error('URL matcher type must be "exact", "prefix", or "regex"');
    }

    if (!rule.matcher.url.value || typeof rule.matcher.url.value !== 'string') {
      throw new Error('URL matcher must have a valid value');
    }

    if (!rule.action || typeof rule.action !== 'object') {
      throw new Error('Rule must have an action object');
    }

    if (!rule.action.type || !['replace', 'patch', 'delay', 'status'].includes(rule.action.type)) {
      throw new Error('Action type must be "replace", "patch", "delay", or "status"');
    }

    // Validate specific action requirements
    if (rule.action.type === 'patch' && (!rule.action.patches || !Array.isArray(rule.action.patches))) {
      throw new Error('Patch action must have a patches array');
    }

    if (rule.action.type === 'delay' && (typeof rule.action.delay !== 'number' || rule.action.delay < 0)) {
      throw new Error('Delay action must have a valid delay in milliseconds');
    }

    return true;
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async injectInterceptionScript(tabId) {
    if (!this.isEnabled || this.rules.length === 0) {
      return;
    }

    // Get tab info to check URL
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (error) {
      console.log(`[OVERRIDE_RESPONSE] Could not get tab info for ${tabId}:`, error.message);
      return;
    }

    // Skip extension pages and restricted URLs
    if (tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-search://') ||
      tab.url.startsWith('edge://') ||
      tab.url === 'chrome://newtab/' ||
      !tab.url.startsWith('http')) {
      return;
    }

    console.log(`[OVERRIDE_RESPONSE] 💉 Injecting script into ${tab.url}`);

    try {
      // CSP-compliant injection using world: 'MAIN'
      console.log(`[OVERRIDE_RESPONSE] Step 1: CSP-compliant rules injection...`);
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN', // This bypasses CSP restrictions
        func: (rules, isEnabled) => {
          window.overrideResponseRules = rules;
          window.overrideResponseEnabled = isEnabled;
          console.log(`[OVERRIDE_RESPONSE] Rules loaded: ${rules.length} rules, enabled: ${isEnabled}`);
        },
        args: [this.rules, this.isEnabled]
      });
      console.log(`[OVERRIDE_RESPONSE] ✅ Rules data injected successfully`);

      // Then inject the interception script with world: 'MAIN'
      console.log(`[OVERRIDE_RESPONSE] Step 2: CSP-compliant script injection...`);
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN', // This bypasses CSP restrictions
        func: () => {
          if (!window.overrideResponseEnabled || !window.overrideResponseRules || window.overrideResponseRules.length === 0) {
            return;
          }

          // Store original references only once
          if (!window.overrideResponseOriginalFetch) {
            window.overrideResponseOriginalFetch = window.fetch;
            window.overrideResponseOriginalXHROpen = XMLHttpRequest.prototype.open;
            window.overrideResponseOriginalXHRSend = XMLHttpRequest.prototype.send;
            console.log(`[OVERRIDE_RESPONSE] Setting up interception with ${window.overrideResponseRules.length} rules`);
          } else {
            console.log(`[OVERRIDE_RESPONSE] Updating rules - ${window.overrideResponseRules.length} rules active`);
          }

          window.overrideResponseInjected = true;
          const rules = window.overrideResponseRules;
          const originalFetch = window.overrideResponseOriginalFetch;
          const originalXHROpen = window.overrideResponseOriginalXHROpen;
          const originalXHRSend = window.overrideResponseOriginalXHRSend;

          function matchesUrl(url, pattern) {
            if (!pattern) return true;

            if (pattern.type === 'exact') {
              return url.trim() === pattern.value.trim();
            } else if (pattern.type === 'prefix') {
              return url.startsWith(pattern.value);
            } else if (pattern.type === 'regex') {
              try {
                const regex = new RegExp(pattern.value, pattern.flags || '');
                return regex.test(url);
              } catch (e) {
                console.error('[OVERRIDE_RESPONSE] Invalid regex:', pattern.value, e);
                return false;
              }
            }
            return false;
          }

          function matchesRule(url, method, rule) {
            if (!rule.enabled) return false;
            if (!matchesUrl(url, rule.matcher.url)) return false;
            if (rule.matcher.method && rule.matcher.method !== method) return false;
            return true;
          }

          function findMatchingRule(url, method) {
            console.log(`[OVERRIDE_RESPONSE] Checking ${method} ${url} against ${rules.length} rules`);

            for (const rule of rules) {
              console.log(`[OVERRIDE_RESPONSE] Testing rule: "${rule.name}"`);

              if (!rule.enabled) {
                console.log(`[OVERRIDE_RESPONSE] ❌ Rule "${rule.name}" is disabled`);
                continue;
              }

              if (!matchesUrl(url, rule.matcher.url)) {
                console.log(`[OVERRIDE_RESPONSE] ❌ URL doesn't match rule "${rule.name}": ${rule.matcher.url.value} (${rule.matcher.url.type})`);
                continue;
              }

              if (rule.matcher.method && rule.matcher.method !== method) {
                console.log(`[OVERRIDE_RESPONSE] ❌ Method doesn't match rule "${rule.name}": expected ${rule.matcher.method}, got ${method}`);
                continue;
              }

              console.log(`[OVERRIDE_RESPONSE] ✅ Rule matched: "${rule.name}"`);
              return rule;
            }

            console.log(`[OVERRIDE_RESPONSE] ❌ No matching rules found for ${method} ${url}`);
            return null;
          }

          // Function to find matching rule from a dynamic rules array (for live rule updates)
          function findMatchingRuleFromArray(url, method, rulesArray) {
            for (const rule of rulesArray) {
              if (!rule.enabled) continue;
              if (!matchesUrl(url, rule.matcher.url)) continue;
              if (rule.matcher.method && rule.matcher.method !== method) continue;
              return rule;
            }
            return null;
          }

          function logRequest(url, method, ruleId, ruleName) {
            try {
              // Only try to send message if chrome.runtime is available
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                  type: 'LOG_REQUEST',
                  data: { url, method, ruleId, ruleName, timestamp: Date.now() }
                });
              } else {
                console.log(`[OVERRIDE_RESPONSE] Log: ${method} ${url} matched rule "${ruleName}"`);
              }
            } catch (error) {
              console.log(`[OVERRIDE_RESPONSE] Log: ${method} ${url} matched rule "${ruleName}" (runtime not available)`);
            }
          }

          // Override fetch - this function will handle ALL future API calls
          const newFetch = async function (input, init) {
            const requestUrl = typeof input === 'string' ? input : input.url;
            const method = (init?.method || 'GET').toUpperCase();

            console.log(`[OVERRIDE_RESPONSE] Intercepted: ${method} ${requestUrl}`);

            // Always use the latest rules from window (in case they were updated)
            const currentRules = window.overrideResponseRules || [];
            const matchingRule = findMatchingRuleFromArray(requestUrl, method, currentRules);

            if (matchingRule) {
              console.log(`[OVERRIDE_RESPONSE] ✅ Executing rule: "${matchingRule.name}"`);
              logRequest(requestUrl, method, matchingRule.id, matchingRule.name);

              // Add delay if specified
              if (matchingRule.action.delay) {
                await new Promise(resolve => setTimeout(resolve, matchingRule.action.delay));
              }

              if (matchingRule.action.type === 'replace') {
                const contentType = matchingRule.action.contentType || 'application/json';
                let responseBody = matchingRule.action.response;

                if (matchingRule.action.responseType === 'json' && typeof responseBody === 'object') {
                  responseBody = JSON.stringify(responseBody);
                } else if (matchingRule.action.responseType === 'text' && typeof responseBody === 'string') {
                  // Use as-is
                }

                console.log(`[OVERRIDE_RESPONSE] ✅ Response overridden (${matchingRule.action.statusCode || 200})`);

                return new Response(responseBody, {
                  status: matchingRule.action.statusCode || 200,
                  statusText: 'OK',
                  headers: {
                    'Content-Type': contentType,
                    'X-Modified-By': 'Override Response',
                    ...matchingRule.action.headers
                  }
                });
              }

              if (matchingRule.action.type === 'status') {
                const contentType = matchingRule.action.contentType || 'application/json';
                let responseBody = matchingRule.action.response || {};

                if (matchingRule.action.responseType === 'json' && typeof responseBody === 'object') {
                  responseBody = JSON.stringify(responseBody);
                }

                return new Response(responseBody, {
                  status: matchingRule.action.statusCode,
                  statusText: matchingRule.action.statusCode >= 400 ? 'Error' : 'OK',
                  headers: {
                    'Content-Type': contentType,
                    ...matchingRule.action.headers
                  }
                });
              }

              if (matchingRule.action.type === 'patch') {
                try {
                  const originalResponse = await originalFetch.apply(this, arguments);
                  const originalData = await originalResponse.json();

                  // Deep clone to avoid mutating original data
                  let patchedData = JSON.parse(JSON.stringify(originalData));
                  matchingRule.action.patches.forEach(patch => {
                    const keys = patch.path.split('.');
                    let current = patchedData;
                    for (let i = 0; i < keys.length - 1; i++) {
                      if (!current[keys[i]]) current[keys[i]] = {};
                      current = current[keys[i]];
                    }
                    current[keys[keys.length - 1]] = patch.value;
                  });

                  return new Response(JSON.stringify(patchedData), {
                    status: matchingRule.action.statusCode || originalResponse.status,
                    statusText: originalResponse.statusText,
                    headers: {
                      'Content-Type': 'application/json',
                      ...matchingRule.action.headers
                    }
                  });
                } catch (error) {
                  console.error('Override Response: Error patching response:', error);
                }
              }
            }

            return originalFetch.apply(this, arguments);
          };

          // Apply multiple interception methods
          window.fetch = newFetch;
          console.log('[OVERRIDE_RESPONSE] ✅ Fetch override applied');

          // Also intercept common libraries that might override fetch
          setTimeout(() => {
            // Re-apply after a delay in case other scripts override fetch
            if (window.fetch !== newFetch) {
              console.log('[OVERRIDE_RESPONSE] 🔄 Re-applying fetch override (was overridden by another script)');
              window.fetch = newFetch;
            }

            // Intercept axios if it exists
            if (window.axios && window.axios.defaults) {
              console.log('[OVERRIDE_RESPONSE] 🎯 Axios detected - intercepting');

              // Intercept axios.request
              const originalAxiosRequest = window.axios.request;
              window.axios.request = async function (config) {
                const method = (config.method || 'GET').toUpperCase();
                const url = config.url;
                console.log(`[OVERRIDE_RESPONSE] Intercepted Axios request: ${method} ${url}`);

                const currentRules = window.overrideResponseRules || [];
                const matchingRule = findMatchingRuleFromArray(url, method, currentRules);

                if (matchingRule) {
                  console.log(`[OVERRIDE_RESPONSE] ✅ Executing Axios rule: "${matchingRule.name}"`);
                  logRequest(url, method, matchingRule.id, matchingRule.name);

                  if (matchingRule.action.delay) {
                    await new Promise(resolve => setTimeout(resolve, matchingRule.action.delay));
                  }

                  if (matchingRule.action.type === 'replace' || matchingRule.action.type === 'status') {
                    let responseBody = matchingRule.action.response || {};

                    if (matchingRule.action.responseType === 'json' && typeof responseBody === 'object') {
                      responseBody = JSON.stringify(responseBody);
                    }

                    // Return axios-compatible response format
                    return Promise.resolve({
                      data: matchingRule.action.responseType === 'json' ? JSON.parse(responseBody) : responseBody,
                      status: matchingRule.action.statusCode || 200,
                      statusText: matchingRule.action.statusCode >= 400 ? 'Error' : 'OK',
                      headers: {
                        'content-type': matchingRule.action.contentType || 'application/json',
                        'x-modified-by': 'Override Response',
                        ...matchingRule.action.headers
                      },
                      config: config,
                      request: {}
                    });
                  }
                }

                return originalAxiosRequest.call(this, config);
              };

              // Also intercept common axios shortcuts
              ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].forEach(method => {
                if (window.axios[method]) {
                  const originalMethod = window.axios[method];
                  window.axios[method] = function (url, ...args) {
                    console.log(`[OVERRIDE_RESPONSE] Intercepted axios.${method}: ${url}`);
                    return originalMethod.call(this, url, ...args);
                  };
                }
              });
            }

            // Intercept jQuery AJAX if it exists
            if (window.$ && window.$.ajax) {
              console.log('[OVERRIDE_RESPONSE] 🎯 jQuery detected - intercepting AJAX');

              const originalAjax = window.$.ajax;
              window.$.ajax = function (settings) {
                const url = settings.url;
                const method = (settings.type || settings.method || 'GET').toUpperCase();
                console.log(`[OVERRIDE_RESPONSE] Intercepted jQuery AJAX: ${method} ${url}`);

                const currentRules = window.overrideResponseRules || [];
                const matchingRule = findMatchingRuleFromArray(url, method, currentRules);

                if (matchingRule) {
                  console.log(`[OVERRIDE_RESPONSE] ✅ Executing jQuery rule: "${matchingRule.name}"`);
                  logRequest(url, method, matchingRule.id, matchingRule.name);

                  // Create a fake jqXHR object
                  const fakeJqXHR = {
                    readyState: 4,
                    status: matchingRule.action.statusCode || 200,
                    statusText: matchingRule.action.statusCode >= 400 ? 'Error' : 'OK',
                    responseText: '',
                    responseJSON: null,
                    done: function (callback) {
                      setTimeout(() => callback(this.responseJSON || this.responseText), matchingRule.action.delay || 0);
                      return this;
                    },
                    fail: function () { return this; },
                    always: function (callback) {
                      setTimeout(() => callback(this), matchingRule.action.delay || 0);
                      return this;
                    }
                  };

                  let responseBody = matchingRule.action.response || {};

                  if (matchingRule.action.responseType === 'json' && typeof responseBody === 'object') {
                    fakeJqXHR.responseText = JSON.stringify(responseBody);
                    fakeJqXHR.responseJSON = responseBody;
                  } else {
                    fakeJqXHR.responseText = responseBody;
                  }

                  // Trigger success callback
                  if (settings.success) {
                    setTimeout(() => {
                      settings.success(fakeJqXHR.responseJSON || fakeJqXHR.responseText, 'success', fakeJqXHR);
                    }, matchingRule.action.delay || 0);
                  }

                  return fakeJqXHR;
                }

                return originalAjax.call(this, settings);
              };

              // Also intercept jQuery shortcuts
              ['get', 'post', 'getJSON'].forEach(method => {
                if (window.$[method]) {
                  const originalMethod = window.$[method];
                  window.$[method] = function (url, ...args) {
                    console.log(`[OVERRIDE_RESPONSE] Intercepted $.${method}: ${url}`);
                    return originalMethod.call(this, url, ...args);
                  };
                }
              });
            }

            // Intercept other common libraries
            if (window.superagent) {
              console.log('[OVERRIDE_RESPONSE] 🎯 Superagent detected - intercepting');
              // Superagent uses a fluent interface, so we intercept at the .end() call
              const originalEnd = window.superagent.Request.prototype.end;
              window.superagent.Request.prototype.end = function (callback) {
                const method = this.method;
                const url = this.url;
                console.log(`[OVERRIDE_RESPONSE] Intercepted Superagent: ${method} ${url}`);

                const currentRules = window.overrideResponseRules || [];
                const matchingRule = findMatchingRuleFromArray(url, method, currentRules);

                if (matchingRule && callback) {
                  console.log(`[OVERRIDE_RESPONSE] ✅ Executing Superagent rule: "${matchingRule.name}"`);
                  logRequest(url, method, matchingRule.id, matchingRule.name);

                  let responseBody = matchingRule.action.response || {};

                  if (matchingRule.action.responseType === 'json' && typeof responseBody === 'object') {
                    responseBody = JSON.stringify(responseBody);
                  }

                  // Create fake superagent response
                  const fakeResponse = {
                    status: matchingRule.action.statusCode || 200,
                    text: responseBody,
                    body: matchingRule.action.responseType === 'json' ? JSON.parse(responseBody) : responseBody,
                    headers: {
                      'content-type': matchingRule.action.contentType || 'application/json',
                      ...matchingRule.action.headers
                    }
                  };

                  setTimeout(() => {
                    callback(null, fakeResponse);
                  }, matchingRule.action.delay || 0);

                  return this;
                }

                return originalEnd.call(this, callback);
              };
            }
          }, 100);

          // Add generic request monitoring for debugging (only once)
          if (typeof PerformanceObserver !== 'undefined' && !window.overrideResponseObserver) {
            try {
              window.overrideResponseObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (entry.entryType === 'navigation' || entry.entryType === 'resource') {
                    console.log(`[OVERRIDE_RESPONSE] 📊 Network activity: ${entry.name}`);
                  }
                }
              });
              window.overrideResponseObserver.observe({ entryTypes: ['navigation', 'resource'] });
              console.log('[OVERRIDE_RESPONSE] ✅ Performance monitoring active');
            } catch (e) {
              console.log('[OVERRIDE_RESPONSE] ⚠️ Performance monitoring not available');
            }
          }

          // Add navigation event listener as fallback
          if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
            console.log('[OVERRIDE_RESPONSE] 🔍 Service Worker monitoring enabled');
          }

          // Monkey patch common request-making patterns
          const originalSetTimeout = window.setTimeout;
          const originalSetInterval = window.setInterval;

          // Monitor for delayed network requests
          window.setTimeout = function (callback, delay, ...args) {
            const wrappedCallback = function () {
              // Check if this timeout might trigger a network request
              try {
                const result = callback.apply(this, arguments);
                if (result && typeof result.then === 'function') {
                  console.log('[OVERRIDE_RESPONSE] 📡 Async operation detected in setTimeout');
                }
                return result;
              } catch (e) {
                return callback.apply(this, arguments);
              }
            };
            return originalSetTimeout.call(this, wrappedCallback, delay, ...args);
          };

          // Override XMLHttpRequest
          XMLHttpRequest.prototype.open = function (method, url, ...args) {
            this._method = method;
            this._url = url;
            return originalXHROpen.apply(this, [method, url, ...args]);
          };

          XMLHttpRequest.prototype.send = function (body) {
            if (this._url && this._method) {
              console.log(`Override Response: Intercepted XHR: ${this._method} ${this._url}`);

              const matchingRule = findMatchingRule(this._url, this._method);

              if (matchingRule) {
                console.log(`Override Response: Executing XHR rule "${matchingRule.name}"`);
                logRequest(this._url, this._method, matchingRule.id, matchingRule.name);

                const self = this;
                const delay = matchingRule.action.delay || 0;

                const executeOverride = () => {
                  console.log(`[OVERRIDE_RESPONSE] XHR: Processing action type: ${matchingRule.action.type}`);

                  if (matchingRule.action.type === 'replace' || matchingRule.action.type === 'status') {
                    let responseBody = matchingRule.action.response || {};

                    console.log(`[OVERRIDE_RESPONSE] XHR: Original response body type:`, typeof responseBody);
                    console.log(`[OVERRIDE_RESPONSE] XHR: Response type setting:`, matchingRule.action.responseType);

                    if (matchingRule.action.responseType === 'json' && typeof responseBody === 'object') {
                      responseBody = JSON.stringify(responseBody);
                      console.log(`[OVERRIDE_RESPONSE] XHR: Converted to JSON string`);
                    }

                    console.log(`[OVERRIDE_RESPONSE] XHR: Final response body:`, responseBody.substring ? responseBody.substring(0, 200) + '...' : responseBody);

                    // Set XHR state to LOADING first
                    Object.defineProperty(self, 'readyState', {
                      value: 3,
                      configurable: true
                    });
                    if (self.onreadystatechange) {
                      console.log(`[OVERRIDE_RESPONSE] XHR: Triggering onreadystatechange (LOADING)`);
                      self.onreadystatechange();
                    }

                    // Now set final response properties
                    Object.defineProperty(self, 'status', {
                      value: matchingRule.action.statusCode || 200,
                      configurable: true
                    });
                    Object.defineProperty(self, 'statusText', {
                      value: matchingRule.action.statusCode >= 400 ? 'Error' : 'OK',
                      configurable: true
                    });
                    Object.defineProperty(self, 'responseText', {
                      value: responseBody,
                      configurable: true
                    });
                    Object.defineProperty(self, 'response', {
                      value: responseBody,
                      configurable: true
                    });
                    Object.defineProperty(self, 'readyState', {
                      value: 4,
                      configurable: true
                    });

                    console.log(`[OVERRIDE_RESPONSE] ✅ XHR Response overridden with status ${matchingRule.action.statusCode || 200}`);

                    // Trigger events immediately
                    if (self.onreadystatechange) {
                      console.log(`[OVERRIDE_RESPONSE] XHR: Triggering onreadystatechange (DONE)`);
                      self.onreadystatechange();
                    }
                    if (self.onload) {
                      console.log(`[OVERRIDE_RESPONSE] XHR: Triggering onload`);
                      const loadEvent = new ProgressEvent('load', {
                        lengthComputable: true,
                        loaded: responseBody.length,
                        total: responseBody.length
                      });
                      self.onload.call(self, loadEvent);
                    }
                    if (self.onloadend) {
                      console.log(`[OVERRIDE_RESPONSE] XHR: Triggering onloadend`);
                      const loadEndEvent = new ProgressEvent('loadend', {
                        lengthComputable: true,
                        loaded: responseBody.length,
                        total: responseBody.length
                      });
                      self.onloadend.call(self, loadEndEvent);
                    }
                    return;
                  }

                  console.log(`[OVERRIDE_RESPONSE] XHR: Action type "${matchingRule.action.type}" not handled, passing through`);
                  originalXHRSend.apply(self, [body]);
                };

                // Execute immediately if no delay, otherwise use setTimeout
                if (delay > 0) {
                  setTimeout(executeOverride, delay);
                } else {
                  // Use microtask to ensure it happens after current execution stack
                  Promise.resolve().then(executeOverride);
                }

                return;
              }
            }

            return originalXHRSend.apply(this, arguments);
          };

          console.log(`[OVERRIDE_RESPONSE] ✅ Ready! Monitoring ${rules.filter(r => r.enabled).length} enabled rules`);

          // Add comprehensive test functions
          window.overrideResponseTestOverride = () => {
            console.log('[OVERRIDE_RESPONSE] Testing override...');
            console.log('[OVERRIDE_RESPONSE] Original fetch preserved:', typeof originalFetch === 'function');
            console.log('[OVERRIDE_RESPONSE] Current fetch is overridden:', window.fetch !== originalFetch);
            console.log('[OVERRIDE_RESPONSE] Rules available:', rules.length);
          };

          // Add universal HTTP monitoring function
          window.overrideResponseMonitorAll = () => {
            console.log('[OVERRIDE_RESPONSE] 🔍 Setting up universal HTTP monitoring...');

            // Monitor fetch (additional layer)
            const currentFetch = window.fetch;
            window.fetch = function (...args) {
              console.log('🌐 UNIVERSAL FETCH:', args[0]);
              return currentFetch.apply(this, arguments);
            };

            // Monitor XHR (additional layer)
            const currentXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url) {
              console.log('🌐 UNIVERSAL XHR:', method, url);
              return currentXHROpen.apply(this, arguments);
            };

            console.log('[OVERRIDE_RESPONSE] ✅ Universal monitoring active');
          };
        }
      });

      console.log(`[OVERRIDE_RESPONSE] ✅ Script injected successfully into tab ${tabId}`);
    } catch (error) {
      // Only log actual errors, not permission issues we've already handled
      if (error.message.includes('Cannot access contents')) {
        console.log(`[OVERRIDE_RESPONSE] ⏭️ Skipping tab ${tabId} - no permission for ${tab.url}`);
      } else {
        console.error(`[OVERRIDE_RESPONSE] ❌ INJECTION FAILED for tab ${tabId}:`, error.message);
        console.error(`[OVERRIDE_RESPONSE] URL: ${tab.url}`);
      }
    }
  }


  logRequest(data) {
    const logEntry = {
      id: this.generateId(),
      url: data.url,
      method: data.method,
      ruleId: data.ruleId,
      ruleName: data.ruleName,
      timestamp: data.timestamp
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.broadcastLogUpdate();
  }

  broadcastLogUpdate() {
    chrome.runtime.sendMessage({
      type: 'LOG_UPDATED',
      logs: this.logs.slice(0, 100)
    }).catch(() => { });
  }

  async refreshAllTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      console.log(`[OVERRIDE_RESPONSE] Refreshing rules on ${tabs.length} tabs`);

      for (const tab of tabs) {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          this.injectInterceptionScript(tab.id);
        }
      }
    } catch (error) {
      console.log('Could not refresh tabs:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'GET_STATUS':
          sendResponse({
            isEnabled: this.isEnabled,
            rulesCount: this.rules.length,
            logs: this.logs.slice(0, 100)
          });
          break;

        case 'LOG_REQUEST':
          this.logRequest(message.data);
          sendResponse({ success: true });
          break;

        case 'TOGGLE_EXTENSION':
          this.isEnabled = !this.isEnabled;
          await this.saveSettings();
          sendResponse({ isEnabled: this.isEnabled });
          break;

        case 'GET_RULES':
          sendResponse({ rules: this.rules });
          break;

        case 'SAVE_RULES':
          this.rules = message.rules;
          await this.saveRules();
          this.refreshAllTabs();
          sendResponse({ success: true });
          break;

        case 'ADD_RULE':
          try {
            this.validateRule(message.rule);
          } catch (validationError) {
            sendResponse({ success: false, error: validationError.message });
            break;
          }

          const newRule = {
            id: this.generateId(),
            enabled: true,
            ...message.rule
          };
          this.rules.push(newRule);
          await this.saveRules();

          console.log(`[OVERRIDE_RESPONSE] ✅ New rule created: "${newRule.name}" for ${newRule.matcher.url.value}`);

          // ONE-SHOT: Immediately apply to current active tab
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
              console.log(`[OVERRIDE_RESPONSE] 🎯 Applying new rule immediately to active tab: ${tabs[0].url}`);

              // Force inject with the new rule immediately
              await this.injectInterceptionScript(tabs[0].id);

              console.log(`[OVERRIDE_RESPONSE] ✅ Rule "${newRule.name}" now active on current tab`);
            }
          } catch (error) {
            console.log('[OVERRIDE_RESPONSE] Failed to apply rule to active tab:', error);
          }

          // Also refresh all other tabs
          this.refreshAllTabs();
          sendResponse({ success: true, rule: newRule });
          break;

        case 'UPDATE_RULE':
          const ruleIndex = this.rules.findIndex(r => r.id === message.ruleId);
          if (ruleIndex !== -1) {
            const updatedRule = { ...this.rules[ruleIndex], ...message.updates };

            // Validate if this is a full rule update (not just toggling enabled)
            if (message.updates.name || message.updates.matcher || message.updates.action) {
              try {
                this.validateRule(updatedRule);
              } catch (validationError) {
                sendResponse({ success: false, error: validationError.message });
                break;
              }
            }

            this.rules[ruleIndex] = updatedRule;
            await this.saveRules();
            this.refreshAllTabs();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Rule not found' });
          }
          break;

        case 'DELETE_RULE':
          const deleteIndex = this.rules.findIndex(r => r.id === message.ruleId);
          if (deleteIndex !== -1) {
            this.rules.splice(deleteIndex, 1);
            await this.saveRules();
            this.refreshAllTabs();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Rule not found' });
          }
          break;

        case 'CLEAR_LOGS':
          this.logs = [];
          sendResponse({ success: true });
          break;

        case 'GET_LOGS':
          sendResponse({ logs: this.logs.slice(0, 100) });
          break;

        case 'EXPORT_RULES':
          sendResponse({
            rules: this.rules,
            exportDate: new Date().toISOString(),
            version: '1.0'
          });
          break;

        case 'IMPORT_RULES':
          try {
            // Validate all rules before importing
            message.rules.forEach(rule => this.validateRule(rule));

            const importedRules = message.rules.map(rule => ({
              ...rule,
              id: this.generateId()
            }));
            this.rules = [...this.rules, ...importedRules];
            await this.saveRules();
            sendResponse({ success: true, imported: importedRules.length });
          } catch (validationError) {
            sendResponse({ success: false, error: `Invalid rule in import: ${validationError.message}` });
          }
          break;

        case 'FORCE_INJECT':
          console.log('[OVERRIDE_RESPONSE] 🔧 FORCE_INJECT requested');
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
              const tab = tabs[0];
              console.log('[OVERRIDE_RESPONSE] Force injecting into tab:', tab.id, tab.url);

              // Check if we can inject into this tab
              if (tab.url.startsWith('chrome-extension://')) {
                console.log('[OVERRIDE_RESPONSE] Cannot inject into extension page');
                sendResponse({
                  success: false,
                  error: 'Cannot inject into extension pages. Please navigate to a regular website (http/https) to test.'
                });
                break;
              }

              if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-search://') || tab.url.startsWith('edge://')) {
                console.log('[OVERRIDE_RESPONSE] Cannot inject into browser page');
                sendResponse({
                  success: false,
                  error: 'Cannot inject into browser internal pages. Please navigate to a regular website (http/https) to test.'
                });
                break;
              }

              if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
                console.log('[OVERRIDE_RESPONSE] Cannot inject into non-http page');
                sendResponse({
                  success: false,
                  error: `Cannot inject into this URL scheme: ${tab.url}. Please navigate to a regular website (http/https) to test.`
                });
                break;
              }

              console.log('[OVERRIDE_RESPONSE] Proceeding with force injection...');
              await this.injectInterceptionScript(tabs[0].id);
              console.log('[OVERRIDE_RESPONSE] Force injection completed');
              sendResponse({ success: true, message: `Injected into tab ${tabs[0].id} (${tab.url})` });
            } else {
              console.log('[OVERRIDE_RESPONSE] No active tab found');
              sendResponse({ success: false, error: 'No active tab found' });
            }
          } catch (error) {
            console.error('[OVERRIDE_RESPONSE] Force injection error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Override Response Background: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

const extension = new OverrideResponseExtension();