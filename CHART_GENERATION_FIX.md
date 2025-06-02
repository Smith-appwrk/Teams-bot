# Chart Generation Fix for Azure App Service

## Problem Resolved

Fixed the `EROFS: read-only file system` error that occurred when trying to generate charts on Azure App Service.

## Root Cause

Azure App Service has read-only file system restrictions. The application was trying to write chart files to `/home/site/wwwroot/server/temp/graphs/` which is read-only.

## Solution Implemented

### 1. Smart Directory Detection

The application now automatically detects if it's running on Azure App Service and tries multiple writable directories:

- `/tmp/graphs`
- `/home/LogFiles/graphs`
- `/home/site/deployments/tools/graphs`
- `/home/data/graphs`
- Environment-based temp directories
- System temp directory

### 2. Fallback to In-Memory Processing

If no writable directory is found, the application falls back to in-memory chart generation:

- Charts are generated as buffers instead of files
- No disk I/O required
- Immediate delivery to the bot framework

### 3. Dual-Mode Support

The message handler now supports both:

- **File-based charts** (when writable directory is available)
- **Buffer-based charts** (when no writable directory exists)

## Technical Changes

### GraphService Updates

- Enhanced `ensureOutputDir()` with Azure-specific logic
- Modified `generateGraph()` to return buffers when needed
- Updated `cleanupGraphFile()` to handle both modes

### MessageHandler Updates

- Modified `sendMentionResponse()` to process both file paths and buffers
- Updated `createAttachmentImages()` for consistent handling
- Automatic detection of chart data type

## Benefits

1. **Reliability**: Works on any Azure App Service plan
2. **Performance**: In-memory processing is faster than disk I/O
3. **Compatibility**: Maintains backward compatibility with file-based systems
4. **Resilience**: Multiple fallback options ensure charts always generate

## Testing

The fix has been tested for:

- ✅ Local development (file-based)
- ✅ Azure App Service (buffer-based fallback)
- ✅ Chart types: Bar, Line, Pie, Doughnut
- ✅ Error handling and graceful degradation

## Deployment

No additional configuration required. The application automatically adapts to the environment.
