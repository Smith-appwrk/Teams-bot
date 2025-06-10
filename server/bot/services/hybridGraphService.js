const fs = require('fs').promises;
const path = require('path');
const { createCanvas } = require('canvas');

class HybridGraphService {
    constructor() {
        this.outputDir = null;
        this.isAzureEnvironment = process.env.WEBSITE_SITE_NAME ? true : false;
        this.dataForgeService = null;
        this.vegaService = null;
        console.log(`[HybridGraphService] Initialized for ${this.isAzureEnvironment ? 'Azure' : 'Local'} environment`);
    }

    async initializeServices() {
        // Try to initialize data-forge-plot first
        try {
            const DataForgeGraphService = require('./dataForgeGraphService');
            this.dataForgeService = new DataForgeGraphService();
            console.log('[HybridGraphService] Data-Forge service initialized');
        } catch (error) {
            console.warn('[HybridGraphService] Failed to initialize Data-Forge service:', error.message);
        }

        // Always have Vega as fallback
        try {
            const VegaGraphService = require('./vegaGraphService');
            this.vegaService = new VegaGraphService();
            console.log('[HybridGraphService] Vega service initialized as fallback');
        } catch (error) {
            console.error('[HybridGraphService] Failed to initialize Vega service:', error.message);
        }
    }

    async ensureOutputDir() {
        if (this.outputDir && await this.isDirectoryWritable(this.outputDir)) {
            return this.outputDir;
        }

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
                    console.log(`[HybridGraphService] Using output directory: ${dir}`);
                    return dir;
                }
            } catch (error) {
                console.log(`[HybridGraphService] Failed to create/use directory ${dir}: ${error.message}`);
            }
        }

        console.log('[HybridGraphService] No writable directory found, using in-memory processing');
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

    async generateWithVegaFallback(data, chartType, title) {
        console.log('[HybridGraphService] Using Vega fallback for chart generation');

        if (!this.vegaService) {
            throw new Error('No chart service available');
        }

        // Use a simplified Vega approach that works reliably
        try {
            await this.vegaService.initializeVega();

            // Create a basic Vega-Lite spec
            const spec = this.createSimpleVegaSpec(data, chartType, title);

            // Compile to Vega
            const vegaSpec = this.vegaService.vegaLite.compile(spec).spec;

            // Create view and render
            const view = new this.vegaService.vega.View(this.vegaService.vega.parse(vegaSpec), {
                renderer: 'none',
                logLevel: this.vegaService.vega.Warn
            });

            await view.runAsync();
            const imageUrl = await view.toImageURL('png');
            const base64Data = imageUrl.replace(/^data:image\/png;base64,/, '');
            const pngBuffer = Buffer.from(base64Data, 'base64');

            console.log('[HybridGraphService] Generated PNG with Vega fallback, size:', pngBuffer.length);

            // Save to file
            const outputDir = await this.ensureOutputDir();
            if (outputDir) {
                const filename = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
                const filepath = path.join(outputDir, filename);
                await fs.writeFile(filepath, pngBuffer);
                console.log('[HybridGraphService] Chart saved to:', filepath);
                return filepath;
            }

            return pngBuffer;
        } catch (error) {
            console.error('[HybridGraphService] Vega fallback also failed:', error);
            throw error;
        }
    }

    createSimpleVegaSpec(data, chartType, title) {
        // Prepare data
        let vegaData = [];
        if (data.labels && data.data) {
            vegaData = data.labels.map((label, index) => ({
                category: String(label),
                value: data.data[index]
            }));
        }

        const baseSpec = {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            title: title,
            width: 600,
            height: 400,
            data: { values: vegaData }
        };

        if (chartType === 'pie') {
            return {
                ...baseSpec,
                mark: { type: "arc" },
                encoding: {
                    theta: { field: "value", type: "quantitative" },
                    color: { field: "category", type: "nominal" }
                }
            };
        } else {
            return {
                ...baseSpec,
                mark: { type: "bar" },
                encoding: {
                    x: { field: "category", type: "nominal" },
                    y: { field: "value", type: "quantitative" }
                }
            };
        }
    }

    async generateGraph(data, chartType = 'bar', title = 'Chart') {
        try {
            console.log('[HybridGraphService] Generating graph:', { chartType, title });

            // Initialize services if not done
            if (!this.dataForgeService && !this.vegaService) {
                await this.initializeServices();
            }

            // Try data-forge-plot first with timeout
            if (this.dataForgeService) {
                try {
                    console.log('[HybridGraphService] Attempting Data-Forge chart generation...');

                    const dataForgePromise = this.dataForgeService.generateGraph(data, chartType, title);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Data-Forge timeout')), 15000);
                    });

                    const result = await Promise.race([dataForgePromise, timeoutPromise]);
                    console.log('[HybridGraphService] Data-Forge chart generated successfully');
                    return result;
                } catch (error) {
                    console.warn('[HybridGraphService] Data-Forge failed, trying Vega fallback:', error.message);
                }
            }

            // Fallback to Vega
            return await this.generateWithVegaFallback(data, chartType, title);

        } catch (error) {
            console.error('[HybridGraphService] All chart generation methods failed:', error);
            throw error;
        }
    }

    async cleanupGraphFile(filePath) {
        if (typeof filePath === 'string' && await fs.access(filePath).then(() => true).catch(() => false)) {
            try {
                await fs.unlink(filePath);
                console.log('[HybridGraphService] Cleaned up graph file:', filePath);
            } catch (error) {
                console.warn('[HybridGraphService] Failed to cleanup file:', error.message);
            }
        }
    }
}

module.exports = HybridGraphService; 