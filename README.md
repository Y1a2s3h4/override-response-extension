# Override Response - API Response Interceptor

**Override Response** is a Chrome extension that allows developers and QA engineers to intercept and modify API responses in real-time. Perfect for testing, debugging, and simulating backend scenarios without server changes.

## 🚀 Features

### Core Functionality
- **Response Replacement**: Replace entire API responses with custom content
- **Multiple Response Types**: Support for JSON, Plain Text, HTML, XML, JavaScript, CSS
- **Custom Content-Type**: Override MIME types for any response format
- **Response Templates**: Pre-built templates for common response types
- **Content Validation**: Built-in validation for JSON, XML, HTML formats
- **Response Patching**: Modify specific fields in JSON API responses
- **Response Delays**: Add artificial latency to simulate slow networks
- **Status Code Override**: Force specific HTTP status codes for error testing
- **URL Matching**: Support for exact, prefix, and regex URL patterns
- **HTTP Method Filtering**: Match specific HTTP methods (GET, POST, PUT, DELETE, PATCH)

### User Interface
- **Clean Rule Management**: Intuitive interface for creating and managing interception rules
- **JSON Editor**: Built-in editor with validation and formatting
- **Real-time Logs**: Monitor intercepted requests with detailed information
- **Quick Toggle**: Enable/disable the extension with one click
- **Import/Export**: Backup and share rule configurations

### Security & Privacy
- **Local Storage Only**: All data stays on your device
- **Domain Scoping**: Restrict extension to specific domains
- **Sensitive Data Masking**: Option to mask tokens and secrets in logs

## 📦 Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download the Extension**
   ```bash
   git clone https://github.com/your-repo/override-response-extension.git
   cd override-response-extension
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `override-response-extension` folder
   - The extension should now appear in your extensions list

4. **Pin the Extension** (Optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Pin Override Response for easy access

### Method 2: Install from Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once it's published.

## 🛠️ Usage

### Quick Start

1. **Enable the Extension**
   - Click the Override Response icon in your toolbar
   - Toggle the extension ON

2. **Create Your First Rule**
   - Right-click the Override Response icon → "Options"
   - Click "Add Rule"
   - Fill in the rule details:
     - **Name**: Descriptive name for your rule
     - **URL Pattern**: The API endpoint to intercept
     - **Action**: What to do when the rule matches

3. **Test Your Rule**
   - Visit a website that makes the API call
   - Check the logs in the extension popup or options page

### Rule Examples

#### Example 1: Replace API Response (JSON)
```json
{
  "name": "Mock User Data",
  "matcher": {
    "url": {
      "type": "prefix",
      "value": "https://api.example.com/users"
    },
    "method": "GET"
  },
  "action": {
    "type": "replace",
    "responseType": "json",
    "contentType": "application/json",
    "response": {
      "users": [
        {
          "id": 1,
          "name": "John Doe",
          "email": "john@example.com"
        }
      ]
    },
    "statusCode": 200
  }
}
```

#### Example 1b: Replace with HTML Response
```json
{
  "name": "Custom HTML Page",
  "matcher": {
    "url": {
      "type": "exact",
      "value": "https://example.com/maintenance"
    }
  },
  "action": {
    "type": "replace",
    "responseType": "html",
    "contentType": "text/html",
    "response": "<!DOCTYPE html><html><body><h1>Under Maintenance</h1><p>Site will be back soon.</p></body></html>",
    "statusCode": 503
  }
}
```

#### Example 1c: Replace with Plain Text
```json
{
  "name": "Text Response",
  "matcher": {
    "url": {
      "type": "prefix",
      "value": "https://api.example.com/logs"
    }
  },
  "action": {
    "type": "replace",
    "responseType": "text",
    "contentType": "text/plain",
    "response": "[2024-01-16 12:00:00] INFO: Custom log message\n[2024-01-16 12:01:00] ERROR: Simulated error",
    "statusCode": 200
  }
}
```

#### Example 2: Enable Feature Flag
```json
{
  "name": "Enable Beta Features",
  "matcher": {
    "url": {
      "type": "exact",
      "value": "https://api.example.com/feature-flags"
    }
  },
  "action": {
    "type": "patch",
    "patches": [
      {
        "path": "features.beta_ui",
        "value": true
      }
    ]
  }
}
```

#### Example 3: Simulate Slow Network
```json
{
  "name": "Slow Dashboard",
  "matcher": {
    "url": {
      "type": "regex",
      "value": "https://api\\.example\\.com/dashboard.*"
    }
  },
  "action": {
    "type": "delay",
    "delay": 3000
  }
}
```

#### Example 4: Force Error Response
```json
{
  "name": "Login Error",
  "matcher": {
    "url": {
      "type": "exact",
      "value": "https://api.example.com/login"
    },
    "method": "POST"
  },
  "action": {
    "type": "status",
    "statusCode": 401,
    "response": {
      "error": "Invalid credentials"
    }
  }
}
```

## 🔧 Configuration

### URL Patterns

- **Exact Match**: Must match the URL exactly
- **Prefix Match**: URL must start with the specified string
- **Regex Match**: Use regular expressions for complex patterns

### Action Types

- **Replace**: Completely replace the response body
- **Patch**: Modify specific fields in the response
- **Delay**: Add latency to the response
- **Status**: Change the HTTP status code

### JSON Patching

Use dot notation to specify the path to modify:
- `user.name` → Updates the `name` field in the `user` object
- `settings.theme.color` → Updates nested objects
- `items.0.price` → Updates the first item in an array

## 📁 Sample Files

The extension includes several sample fixture files:

- `fixtures/orders.json` - Mock order data
- `fixtures/users.json` - Mock user profiles
- `fixtures/feature-flags.json` - Feature flag configurations
- `fixtures/error-responses.json` - Common error responses
- `example-rules.json` - Pre-configured rule examples

## 🔒 Permissions

The extension requires the following permissions:

- **declarativeNetRequest**: To intercept and modify network requests
- **storage**: To save rules and settings locally
- **activeTab**: To inject scripts into the current tab
- **scripting**: To execute interception scripts
- **host_permissions**: To access all websites (configurable)

### Why These Permissions?

- **Network Interception**: Required to modify API responses
- **Local Storage**: Keeps your rules and logs private and local
- **Tab Access**: Necessary to inject the interception code
- **All Websites**: Allows the extension to work on any domain (you can restrict this)

## 🛡️ Security

### Data Privacy
- All data is stored locally on your device
- No data is sent to external servers
- Rules and logs never leave your browser

### Best Practices
- Only enable the extension when needed
- Use domain restrictions to limit scope
- Regularly clear logs containing sensitive data
- Don't commit rules with real API keys to version control

## 🐛 Troubleshooting

### Extension Not Working?

1. **Check Extension Status**
   - Ensure the extension is enabled
   - Verify the toggle is ON in the popup

2. **Verify Rule Configuration**
   - Check URL patterns match exactly
   - Confirm HTTP methods are correct
   - Test rules using the "Test Rule" feature

3. **Browser Compatibility**
   - Requires Chrome/Chromium 88+
   - May work with other Chromium-based browsers

### Common Issues

**Rules Not Matching**
- Double-check URL patterns
- Ensure the website is making the expected API calls
- Use regex tester for complex patterns

**JSON Errors**
- Validate JSON syntax in response bodies
- Use the built-in formatter
- Check for trailing commas

**Performance Issues**
- Disable unused rules
- Clear old logs regularly
- Limit regex complexity

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/override-response-extension.git
cd override-response-extension

# Load the extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select this directory
```

## 📋 Changelog

### Version 1.0.0
- Initial release
- Basic request interception
- Rule management interface
- JSON response replacement
- Response patching
- Delay simulation
- Status code override
- Import/export functionality
- Request logging

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Chrome Extensions API documentation
- The developer community for feedback and suggestions
- Beta testers who helped identify issues

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/override-response-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/override-response-extension/discussions)
- **Email**: support@overrideresponse.io

## 🗺️ Roadmap

### Planned Features
- [ ] Request body modification
- [ ] GraphQL query interception
- [ ] WebSocket message modification
- [ ] Cloud sync (optional)
- [ ] Team collaboration features
- [ ] Advanced scripting support
- [ ] Browser automation integration

### Version 2.0 Preview
- Enhanced UI with dark mode
- Performance improvements
- Better error handling
- Advanced logging features

---

**Made with ❤️ for developers and QA engineers**

*Override Response helps you debug faster, test better, and ship with confidence.*