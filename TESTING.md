# 🧪 Testing Guide for Requestly Extension

## Pre-Installation Testing

### Test Site Preparation
Create a simple HTML page with API calls to test the extension:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Requestly Test Page</title>
</head>
<body>
    <h1>API Test Page</h1>
    <button onclick="testAPI()">Test API Call</button>
    <div id="result"></div>
    
    <script>
        async function testAPI() {
            try {
                const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('result').innerHTML = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
```

## Installation Testing

### Step 1: Load Extension
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the extension folder
5. Verify extension appears in the list

**Expected Result:** Extension loads without errors

### Step 2: Basic UI Test
1. Click the Requestly icon in toolbar
2. Verify popup opens
3. Check extension status shows "Disabled" initially
4. Toggle extension ON
5. Verify status changes to "Enabled"

**Expected Result:** Popup UI works correctly

### Step 3: Options Page Test
1. Right-click extension icon
2. Select "Options"
3. Verify options page opens
4. Check all tabs load (Rules, Logs, Settings)

**Expected Result:** Options page displays correctly

## Feature Testing

### Test 1: Basic Rule Creation
1. Open Options page
2. Click "Add Rule"
3. Create a rule:
   - Name: "Test JSONPlaceholder"
   - URL: `https://jsonplaceholder.typicode.com/posts/1` (exact)
   - Action: Replace
   - Response: `{"title": "Intercepted!", "body": "This response was modified by Requestly"}`
4. Save rule
5. Open test HTML page
6. Click "Test API Call"

**Expected Result:** Modified response appears instead of original

### Test 2: URL Pattern Matching
1. Create rule with prefix match: `https://jsonplaceholder.typicode.com/`
2. Test with different endpoints: `/posts/1`, `/posts/2`, `/users/1`

**Expected Result:** All matching URLs are intercepted

### Test 3: Response Patching
1. Create rule with patch action
2. Add patch: `title` → `"Patched Title"`
3. Test API call

**Expected Result:** Only the title field is modified

### Test 4: Delay Simulation
1. Create rule with 3-second delay
2. Test API call
3. Observe loading time

**Expected Result:** Response takes ~3 seconds to arrive

### Test 5: Status Code Override
1. Create rule forcing 404 status
2. Test API call

**Expected Result:** API call fails with 404 error

### Test 6: Import/Export
1. Export current rules
2. Clear all rules
3. Import the exported file

**Expected Result:** Rules are restored correctly

### Test 7: Logging
1. Make several API calls with different rules
2. Check logs in popup
3. Check logs in options page

**Expected Result:** All intercepted requests are logged

## Browser Compatibility Testing

### Chrome/Chromium
- Test on Chrome 90+
- Test on Chromium-based browsers (Edge, Brave)

### Expected Behavior
- Extension loads without warnings
- All features work as intended
- No console errors
- Good performance

## Error Scenarios

### Test Invalid JSON
1. Create rule with malformed JSON response
2. Attempt to save

**Expected Result:** Validation error is shown

### Test Invalid Regex
1. Create rule with invalid regex pattern
2. Test matching

**Expected Result:** Rule fails gracefully, no crashes

### Test Network Failures
1. Test on pages with no internet
2. Test with blocked requests

**Expected Result:** Extension handles errors gracefully

## Performance Testing

### Memory Usage
1. Load extension
2. Create 50+ rules
3. Make 100+ requests
4. Check memory usage in Task Manager

**Expected Result:** Reasonable memory footprint

### Startup Time
1. Reload extension
2. Measure time to become functional

**Expected Result:** Quick startup (< 2 seconds)

## Security Testing

### Permissions Check
1. Verify only required permissions are requested
2. Check manifest.json matches actual usage

**Expected Result:** No unnecessary permissions

### Data Privacy
1. Create rules with sensitive data
2. Disable extension
3. Uninstall extension
4. Check if data persists

**Expected Result:** Data is properly cleaned up

## Production Readiness Checklist

- [ ] All core features working
- [ ] No console errors or warnings
- [ ] UI is responsive and intuitive
- [ ] Import/export functionality works
- [ ] Logging captures all necessary information
- [ ] Extension handles edge cases gracefully
- [ ] Memory usage is reasonable
- [ ] Works across different websites
- [ ] Privacy and security requirements met
- [ ] Documentation is complete and accurate

## Common Issues and Solutions

### Extension Not Loading
- Check manifest.json syntax
- Verify all referenced files exist
- Check for JavaScript errors

### Rules Not Working
- Verify extension is enabled
- Check URL patterns match exactly
- Test with simple exact match first

### UI Not Responsive
- Check CSS files are loaded
- Verify JavaScript has no errors
- Test with different screen sizes

### Performance Issues
- Limit number of active rules
- Optimize regex patterns
- Clear old logs regularly

## Reporting Bugs

When reporting bugs, include:
1. Chrome version
2. Extension version
3. Steps to reproduce
4. Expected vs actual behavior
5. Console error messages
6. Screenshots if applicable

---

**Ready for Production? 🚀**

Once all tests pass, the extension is ready for distribution!