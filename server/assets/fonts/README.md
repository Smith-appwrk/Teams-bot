# Font Configuration for Chart Generation

This directory contains font configuration files for the VegaGraphService to ensure proper text rendering in charts.

## What's Fixed

- **Font Rendering Issues**: Previously charts showed placeholder boxes (□) instead of text due to missing font support on the server
- **Canvas Integration**: Now uses the `canvas` library with proper font configuration
- **Better Text Display**: Charts now render with proper Arial/sans-serif fonts

## How It Works

1. **VegaGraphService** now uses the `canvas` library for server-side rendering
2. **Font Configuration** is handled automatically using system fonts (Arial, sans-serif)
3. **Cross-Platform Support** works on both Windows and Linux environments

## Files

- `setupFonts.js` - Font manager class for system font detection
- `testFonts.js` - Test script to verify canvas font rendering
- `testVegaChart.js` - Test script to verify chart generation with fonts
- `font-test.png` - Generated test image showing font rendering

## Testing

To test font rendering:

```bash
cd server/assets/fonts
node testFonts.js        # Test basic canvas font rendering
node testVegaChart.js    # Test chart generation with fonts
```

## Usage

The VegaGraphService automatically uses the font configuration. No additional setup required - just ensure the `canvas` package is installed (already included in package.json).

## Font Priority

1. Arial (Windows/Linux)
2. sans-serif (fallback)
3. System default fonts as backup
