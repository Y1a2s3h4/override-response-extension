(function() {
  'use strict';

  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  let pendingOverrides = new Map();

  window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data.type) return;
    
    if (event.data.type === 'OVERRIDE_RESPONSE') {
      const { url, response, statusCode, headers, delay } = event.data;
      pendingOverrides.set(url, { response, statusCode, headers, delay });
    }
  });

  window.fetch = async function(input, init) {
    const requestUrl = typeof input === 'string' ? input : input.url;
    const method = init?.method || 'GET';
    
    window.postMessage({
      type: 'REQUEST_INTERCEPTED',
      payload: {
        url: requestUrl,
        method: method,
        timestamp: Date.now()
      }
    }, '*');

    const override = pendingOverrides.get(requestUrl);
    if (override) {
      if (override.delay) {
        await new Promise(resolve => setTimeout(resolve, override.delay));
      }
      
      return new Response(JSON.stringify(override.response), {
        status: override.statusCode || 200,
        statusText: override.statusCode >= 400 ? 'Error' : 'OK',
        headers: {
          'Content-Type': 'application/json',
          ...override.headers
        }
      });
    }

    return originalFetch.apply(this, arguments);
  };

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._method = method;
    this._url = url;
    
    window.postMessage({
      type: 'REQUEST_INTERCEPTED',
      payload: {
        url: url,
        method: method,
        timestamp: Date.now()
      }
    }, '*');

    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const override = pendingOverrides.get(this._url);
    if (override) {
      const self = this;
      setTimeout(() => {
        Object.defineProperty(self, 'status', { value: override.statusCode || 200 });
        Object.defineProperty(self, 'statusText', { 
          value: override.statusCode >= 400 ? 'Error' : 'OK' 
        });
        Object.defineProperty(self, 'responseText', { 
          value: JSON.stringify(override.response) 
        });
        Object.defineProperty(self, 'response', { 
          value: JSON.stringify(override.response) 
        });
        Object.defineProperty(self, 'readyState', { value: 4 });

        if (self.onreadystatechange) {
          self.onreadystatechange();
        }
        
        if (self.onload) {
          self.onload();
        }
      }, override.delay || 0);
      return;
    }

    return originalXHRSend.apply(this, arguments);
  };
})();