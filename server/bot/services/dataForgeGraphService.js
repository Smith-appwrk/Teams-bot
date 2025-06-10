const fs = require('fs').promises;
const path = require('path');
const dataForge = require('data-forge');
require('data-forge-plot'); // Extends Data-Forge with the 'plot' function.
require('@plotex/render-image'); // Extends Data-Forge Plot with the 'renderImage' function.

class DataForgeGraphService {
    constructor() {
        this.outputDir = null;
        this.isAzureEnvironment = process.env.WEBSITE_SITE_NAME ? true : false;
        console.log(`[DataForgeGraphService] Initialized for ${this.isAzureEnvironment ? 'Azure' : 'Local'} environment`);
    }

    async ensureOutputDir() {
        if (this.outputDir && await this.isDirectoryWritable(this.outputDir)) {
            return this.outputDir;
        }

        // Try different directories for Azure compatibility
        const possibleDirs = [
            '/tmp/graphs',
            '/home/LogFiles/graphs',
            '/home/data/graphs',
            path.join(process.cwd(), 'temp', 'graphs'),
            path.join(require('os').tmpdir(), 'graphs')
        ];

        for (const dir of possibleDirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                if (await this.isDirectoryWritable(dir)) {
                    this.outputDir = dir;
                    console.log(`[DataForgeGraphService] Using output directory: ${dir}`);
                    return dir;
                }
            } catch (error) {
                console.log(`[DataForgeGraphService] Failed to create/use directory ${dir}: ${error.message}`);
            }
        }

        console.log('[DataForgeGraphService] No writable directory found, using in-memory processing');
        return null;
    }

    async isDirectoryWritable(dir) {
        try {
            const testFile = path.join(dir, 'test_write.tmp');
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            return true;
        } catch {
            return false;
        }
    }

    prepareDataForDataForge(data) {
        let chartData = [];

        // Handle different data formats
        if (Array.isArray(data)) {
            // If data is already an array of objects with proper structure
            if (data.length > 0 && typeof data[0] === 'object' && 'category' in data[0]) {
                chartData = data;
            } else {
                // If data is array of values, create categories
                chartData = data.map((value, index) => ({
                    category: `Category ${index + 1}`,
                    value: typeof value === 'number' ? value : parseFloat(value) || 0
                }));
            }
        } else if (data && typeof data === 'object') {
            // Handle object with labels and data arrays
            if (data.labels && data.data) {
                chartData = data.labels.map((label, index) => ({
                    category: String(label),
                    value: typeof data.data[index] === 'number' ? data.data[index] : parseFloat(data.data[index]) || 0
                }));
            } else {
                // Handle direct key-value pairs
                chartData = Object.entries(data).map(([key, value]) => ({
                    category: String(key),
                    value: typeof value === 'number' ? value : parseFloat(value) || 0
                }));
            }
        }

        console.log('[DataForgeGraphService] Prepared data:', chartData);
        return chartData;
    }

    async generateGraph(data, chartType = 'bar', title = 'Chart') {
        try {
            console.log('[DataForgeGraphService] Generating graph:', { chartType, title });

            // Prepare data for Data-Forge
            const chartData = this.prepareDataForDataForge(data);

            if (!chartData || chartData.length === 0) {
                console.warn('[DataForgeGraphService] No valid data for chart generation');
                throw new Error('No valid data provided for chart generation');
            }

            // Create Data-Forge DataFrame
            const dataFrame = new dataForge.DataFrame(chartData);

            // Generate filename
            const outputDir = await this.ensureOutputDir();
            const filename = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
            const filepath = outputDir ? path.join(outputDir, filename) : filename;

            // Create a simple plot configuration
            const plotDef = {
                chartType: chartType.toLowerCase() === 'pie' ? 'pie' :
                    chartType.toLowerCase() === 'line' ? 'line' : 'bar',
                width: 600,
                height: 400,
                x: 'category',
                y: 'value',
                title: {
                    text: title
                }
            };

            console.log('[DataForgeGraphService] Plot configuration:', plotDef);

            // Generate the plot and render to image
            await dataFrame
                .plot(plotDef)
                .renderImage(filepath);

            console.log('[DataForgeGraphService] Chart rendered successfully to:', filepath);

            // Clean up old files if using file directory
            if (outputDir) {
                this.cleanupOldFiles(outputDir);
            }

            // Read the file back as buffer for compatibility
            if (await fs.access(filepath).then(() => true).catch(() => false)) {
                const imageBuffer = await fs.readFile(filepath);
                console.log('[DataForgeGraphService] Chart buffer size:', imageBuffer.length);
                return filepath; // Return filepath for now, but could return buffer if needed
            } else {
                throw new Error('Failed to generate chart file');
            }

        } catch (error) {
            console.error('[DataForgeGraphService] Error generating graph:', error);
            throw error;
        }
    }

    async cleanupOldFiles(directory) {
        try {
            const files = await fs.readdir(directory);
            const chartFiles = files.filter(file => file.startsWith('chart_') && file.endsWith('.png'));

            // Keep only the 10 most recent files
            if (chartFiles.length > 10) {
                chartFiles.sort();
                const filesToDelete = chartFiles.slice(0, chartFiles.length - 10);

                for (const file of filesToDelete) {
                    try {
                        await fs.unlink(path.join(directory, file));
                        console.log('[DataForgeGraphService] Cleaned up old file:', file);
                    } catch (deleteError) {
                        console.warn('[DataForgeGraphService] Failed to delete old file:', file, deleteError.message);
                    }
                }
            }
        } catch (error) {
            console.warn('[DataForgeGraphService] Error during cleanup:', error.message);
        }
    }

    // Compatibility method for existing code
    async cleanupGraphFile(filePath) {
        if (typeof filePath === 'string' && await fs.access(filePath).then(() => true).catch(() => false)) {
            try {
                await fs.unlink(filePath);
                console.log('[DataForgeGraphService] Cleaned up graph file:', filePath);
            } catch (error) {
                console.warn('[DataForgeGraphService] Failed to cleanup file:', error.message);
            }
        }
    }
}

module.exports = DataForgeGraphService; 