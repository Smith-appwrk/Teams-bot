const fs = require('fs').promises;
const path = require('path');
const FontManager = require('../../assets/fonts/setupFonts');
const { createCanvas } = require('canvas');

class VegaGraphService {
    constructor() {
        this.outputDir = null;
        this.isAzureEnvironment = process.env.WEBSITE_SITE_NAME ? true : false;
        this.vega = null;
        this.vegaLite = null;
        this.fontManager = new FontManager();
        console.log(`[VegaGraphService] Initialized for ${this.isAzureEnvironment ? 'Azure' : 'Local'} environment`);
    }

    async initializeVega() {
        if (!this.vega || !this.vegaLite) {
            try {
                console.log('[VegaGraphService] Loading Vega modules...');
                this.vega = await import('vega');
                this.vegaLite = await import('vega-lite');

                // Ensure modules are properly loaded
                if (!this.vega || !this.vegaLite) {
                    throw new Error('Failed to load Vega modules');
                }

                console.log('[VegaGraphService] Vega modules loaded successfully');
            } catch (error) {
                console.error('[VegaGraphService] Failed to load Vega modules:', error);
                throw error;
            }
        }
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
                    console.log(`[VegaGraphService] Using output directory: ${dir}`);
                    return dir;
                }
            } catch (error) {
                console.log(`[VegaGraphService] Failed to create/use directory ${dir}: ${error.message}`);
            }
        }

        console.log('[VegaGraphService] No writable directory found, using in-memory processing');
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

    createVegaLiteSpec(data, chartType, title) {
        const baseSpec = {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            title: {
                text: title,
                fontSize: 16,
                fontWeight: "bold",
                color: "#333333"
            },
            width: 600,
            height: 400,
            background: "white",
            config: {
                font: "Arial, sans-serif",
                axis: {
                    labelFontSize: 12,
                    titleFontSize: 14,
                    titleColor: "#333333",
                    labelColor: "#666666",
                    labelFont: "Arial, sans-serif",
                    titleFont: "Arial, sans-serif"
                },
                legend: {
                    labelFontSize: 12,
                    titleFontSize: 14,
                    labelFont: "Arial, sans-serif",
                    titleFont: "Arial, sans-serif"
                },
                title: {
                    font: "Arial, sans-serif"
                },
                text: {
                    font: "Arial, sans-serif"
                }
            }
        };

        // Prepare data for Vega-Lite
        const vegaData = this.prepareDataForVega(data);

        // Ensure we have valid data
        if (!vegaData || vegaData.length === 0) {
            console.warn('[VegaGraphService] No valid data for chart generation');
            return null;
        }

        switch (chartType.toLowerCase()) {
            case 'bar':
                return {
                    ...baseSpec,
                    data: { values: vegaData },
                    mark: {
                        type: "bar",
                        color: "#4285f4",
                        cornerRadius: 4
                    },
                    encoding: {
                        x: {
                            field: "category",
                            type: "nominal",
                            axis: { title: "Categories" }
                        },
                        y: {
                            field: "value",
                            type: "quantitative",
                            axis: { title: "Values" }
                        },
                        tooltip: [
                            { field: "category", type: "nominal" },
                            { field: "value", type: "quantitative" }
                        ]
                    }
                };

            case 'line':
                return {
                    ...baseSpec,
                    data: { values: vegaData },
                    mark: {
                        type: "line",
                        color: "#4285f4",
                        strokeWidth: 3,
                        point: {
                            filled: true,
                            size: 80,
                            color: "#4285f4"
                        }
                    },
                    encoding: {
                        x: {
                            field: "category",
                            type: "nominal",
                            axis: { title: "Categories" }
                        },
                        y: {
                            field: "value",
                            type: "quantitative",
                            axis: { title: "Values" }
                        },
                        tooltip: [
                            { field: "category", type: "nominal" },
                            { field: "value", type: "quantitative" }
                        ]
                    }
                };

            case 'pie':
            case 'doughnut':
                return {
                    ...baseSpec,
                    data: { values: vegaData },
                    mark: {
                        type: "arc",
                        innerRadius: chartType.toLowerCase() === 'doughnut' ? 50 : 0,
                        stroke: "white",
                        strokeWidth: 2
                    },
                    encoding: {
                        theta: {
                            field: "value",
                            type: "quantitative"
                        },
                        color: {
                            field: "category",
                            type: "nominal",
                            scale: {
                                range: ["#4285f4", "#34a853", "#fbbc04", "#ea4335", "#9aa0a6", "#ff6d01", "#46bdc6"]
                            }
                        },
                        tooltip: [
                            { field: "category", type: "nominal" },
                            { field: "value", type: "quantitative" }
                        ]
                    }
                };

            default:
                // Default to bar chart
                return this.createVegaLiteSpec(data, 'bar', title);
        }
    }

    prepareDataForVega(data) {
        // Handle different data formats
        if (Array.isArray(data)) {
            // If data is already an array of objects with proper structure
            if (data.length > 0 && typeof data[0] === 'object' && 'category' in data[0]) {
                return data;
            }
            // If data is array of values, create categories
            return data.map((value, index) => ({
                category: `Category ${index + 1}`,
                value: typeof value === 'number' ? value : parseFloat(value) || 0
            }));
        }

        if (data && typeof data === 'object') {
            // Handle object with labels and data arrays
            if (data.labels && data.data) {
                return data.labels.map((label, index) => ({
                    category: String(label),
                    value: typeof data.data[index] === 'number' ? data.data[index] : parseFloat(data.data[index]) || 0
                }));
            }

            // Handle direct key-value pairs
            return Object.entries(data).map(([key, value]) => ({
                category: String(key),
                value: typeof value === 'number' ? value : parseFloat(value) || 0
            }));
        }

        // Fallback: return empty data
        console.warn('[VegaGraphService] Invalid data format, returning empty dataset');
        return [];
    }

    async generateGraph(data, chartType = 'bar', title = 'Chart') {
        try {
            console.log('[VegaGraphService] Generating graph:', { chartType, title });

            // Initialize Vega modules
            await this.initializeVega();

            // Create Vega-Lite specification
            const spec = this.createVegaLiteSpec(data, chartType, title);
            console.log('[VegaGraphService] Created Vega-Lite spec');

            // Compile Vega-Lite to Vega
            const vegaSpec = this.vegaLite.compile(spec).spec;

            // Try multiple rendering approaches for better compatibility
            let pngBuffer;

            try {
                // Method 1: Try using toImageURL (works better with fonts)
                const view1 = new this.vega.View(this.vega.parse(vegaSpec), {
                    renderer: 'none',
                    logLevel: this.vega.Warn
                });

                await view1.runAsync();
                const imageUrl = await view1.toImageURL('png');
                const base64Data = imageUrl.replace(/^data:image\/png;base64,/, '');
                pngBuffer = Buffer.from(base64Data, 'base64');

                console.log('[VegaGraphService] Generated PNG using toImageURL method, size:', pngBuffer.length);

                // Check if we got a good result
                if (pngBuffer.length > 5000) {
                    console.log('[VegaGraphService] Using toImageURL result (good size)');
                } else {
                    throw new Error('toImageURL result too small, trying canvas method');
                }

            } catch (imageUrlError) {
                console.log('[VegaGraphService] toImageURL failed, trying canvas method:', imageUrlError.message);

                // Method 2: Canvas rendering with manual setup
                const canvas = createCanvas(spec.width || 600, spec.height || 400);
                const ctx = canvas.getContext('2d');

                // Set white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const view2 = new this.vega.View(this.vega.parse(vegaSpec), {
                    renderer: 'canvas',
                    canvas: canvas,
                    logLevel: this.vega.Warn
                });

                await view2.runAsync();
                pngBuffer = canvas.toBuffer('image/png');

                console.log('[VegaGraphService] Generated PNG using canvas method, size:', pngBuffer.length);
            }

            // Try to save to file if possible
            const outputDir = await this.ensureOutputDir();
            if (outputDir) {
                const filename = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
                const filepath = path.join(outputDir, filename);

                try {
                    await fs.writeFile(filepath, pngBuffer);
                    console.log('[VegaGraphService] Chart saved to:', filepath);

                    // Clean up old files
                    this.cleanupOldFiles(outputDir);

                    return filepath;
                } catch (writeError) {
                    console.warn('[VegaGraphService] Failed to write to file, returning buffer:', writeError.message);
                }
            }

            // Return buffer if file write failed or no writable directory
            console.log('[VegaGraphService] Returning PNG buffer');
            return pngBuffer;

        } catch (error) {
            console.error('[VegaGraphService] Error generating graph:', error);
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
                        console.log('[VegaGraphService] Cleaned up old file:', file);
                    } catch (deleteError) {
                        console.warn('[VegaGraphService] Failed to delete old file:', file, deleteError.message);
                    }
                }
            }
        } catch (error) {
            console.warn('[VegaGraphService] Error during cleanup:', error.message);
        }
    }

    // Compatibility method for existing code
    async cleanupGraphFile(filePath) {
        if (typeof filePath === 'string' && await fs.access(filePath).then(() => true).catch(() => false)) {
            try {
                await fs.unlink(filePath);
                console.log('[VegaGraphService] Cleaned up graph file:', filePath);
            } catch (error) {
                console.warn('[VegaGraphService] Failed to cleanup file:', error.message);
            }
        }
    }
}

module.exports = VegaGraphService; 