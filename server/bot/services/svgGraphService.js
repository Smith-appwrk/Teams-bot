const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { createCanvas, registerFont } = require('canvas'); // MODIFIED: Added registerFont

/**
 * SVG Graph Service
 * Uses a hybrid approach to generate charts where labels are rendered as SVG elements
 * instead of relying on canvas text rendering.
 */
class SVGGraphService {
    constructor() {
        // Check if running on Azure App Service
        this.isAzure = process.env.WEBSITE_SITE_NAME !== undefined;
        console.log(`[SVGGraphService] Running on Azure: ${this.isAzure}`);

        // Set up proper paths based on environment
        if (this.isAzure) {
            // On Azure App Service, use the writable wwwroot directory at the site root
            this.staticImagesDir = path.join(process.env.HOME || '', 'site', 'wwwroot', 'images');
            this.tempDir = path.join(process.env.TEMP || require('os').tmpdir(), 'teamsbot-graphs');
        } else {
            // Local development environment - use server/wwwroot/images
            this.staticImagesDir = path.join(__dirname, '../../../wwwroot/images');
            this.tempDir = path.join(__dirname, '../../temp/graphs');
        }
        
        console.log(`[SVGGraphService] staticImagesDir: ${this.staticImagesDir}`);
        console.log(`[SVGGraphService] tempDir: ${this.tempDir}`);
        
        this.ensureDirectories(); // This also sets this.outputDir
        this.startCleanupTimer();

        // --- Enhanced Font Loading Logic ---
        const fontFileName = 'OpenSans-Regular.ttf';
        // __dirname for server/bot/services/svgGraphService.js
        // Path to server/assets/fonts/OpenSans-Regular.ttf
        const fontPath = path.resolve(__dirname, '..', '..', 'assets', 'fonts', fontFileName); 
        
        console.log(`[FontLoading] Attempting to load font. Resolved path: ${fontPath}`);
        this.defaultFontFamily = 'sans-serif'; // Default fallback

        try {
            const fontExists = fs.existsSync(fontPath);
            console.log(`[FontLoading] Font file exists at '${fontPath}': ${fontExists}`);

            if (fontExists) {
                try {
                    registerFont(fontPath, { family: 'Open Sans' });
                    console.log(`[FontLoading] Successfully called registerFont for '${fontPath}' with family 'Open Sans'.`);
                    this.defaultFontFamily = 'Open Sans';
                } catch (regError) {
                    console.error(`[FontLoading] CRITICAL ERROR during registerFont call for '${fontPath}':`, regError.message, regError.stack);
                    // Even if registration fails, Chart.js will use the fallback.
                }
            } else {
                console.warn(`[FontLoading] FONT FILE NOT FOUND: '${fontPath}'. Please ensure '${fontFileName}' is in 'server/assets/fonts/' and deployed correctly. Chart.js will use fallback 'sans-serif'.`);
            }
        } catch (fontAccessError) {
            console.error(`[FontLoading] Error accessing font path '${fontPath}' (e.g., fs.existsSync failed):`, fontAccessError.message, fontAccessError.stack);
        }
        // --- End of Enhanced Font Loading Logic ---

        // Initialize Chart.js canvas with minimal configuration
        this.chartJSNodeCanvas = new ChartJSNodeCanvas({
            width: 1200,
            height: 700,
            backgroundColour: 'white',
            chartCallback: (ChartJS) => {
                // Register Chart.js plugins and components
                ChartJS.register(
                    ChartJS.CategoryScale,
                    ChartJS.LinearScale,
                    ChartJS.BarElement,
                    ChartJS.LineElement,
                    ChartJS.PointElement,
                    ChartJS.ArcElement,
                    ChartJS.Title,
                    ChartJS.Tooltip,
                    ChartJS.Legend
                );
                console.log(`[ChartJSSetup] Setting Chart.js default font family to: '${this.defaultFontFamily}'`);
                ChartJS.defaults.font.family = this.defaultFontFamily;
                ChartJS.defaults.font.size = 12;
                ChartJS.defaults.color = '#333333';
            }
        });
    }

    ensureDirectories() {
        // First ensure static images directory exists
        try {
            if (!fs.existsSync(this.staticImagesDir)) {
                fs.mkdirSync(this.staticImagesDir, { recursive: true });
                console.log(`Created static images directory at: ${this.staticImagesDir}`);
            }
            
            // Test write access to static directory
            const testFile = path.join(this.staticImagesDir, 'test_write.tmp');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('Static images directory is writable:', this.staticImagesDir);
            
            // Use static images directory as primary output
            this.outputDir = this.staticImagesDir;
            return;
        } catch (error) {
            console.warn('Static images directory is not writable, falling back to temp directory:', error.message);
        }
        
        try {
            // For Azure App Service, use the writable temp directory if static dir fails
            const isAzure = process.env.WEBSITE_SITE_NAME || process.env.APPSETTING_WEBSITE_SITE_NAME;

            if (isAzure) {
                // Azure App Service writable directories
                const azureTempPaths = [
                    '/tmp/graphs',
                    '/home/LogFiles/graphs',
                    '/home/site/deployments/tools/graphs',
                    '/home/data/graphs',
                    process.env.TEMP ? path.join(process.env.TEMP, 'graphs') : null,
                    process.env.TMP ? path.join(process.env.TMP, 'graphs') : null,
                    path.join(require('os').tmpdir(), 'graphs')
                ].filter(Boolean);

                for (const tempPath of azureTempPaths) {
                    try {
                        this.outputDir = tempPath;
                        if (!fs.existsSync(this.outputDir)) {
                            fs.mkdirSync(this.outputDir, { recursive: true });
                        }
                        // Test write access
                        const testFile = path.join(this.outputDir, 'test_write.tmp');
                        fs.writeFileSync(testFile, 'test');
                        fs.unlinkSync(testFile);
                        console.log('Using Azure writable directory:', this.outputDir);
                        return;
                    } catch (error) {
                        console.log(`Failed to use ${tempPath}:`, error.message);
                        continue;
                    }
                }
            }

            // Fallback for local development
            this.outputDir = this.tempDir;
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
                console.log('Created local graph output directory:', this.outputDir);
            }
        } catch (error) {
            console.error('Error creating graph output directory:', error);
            // Last resort: use system temp directory
            this.outputDir = path.join(require('os').tmpdir(), 'bot-graphs');
            try {
                if (!fs.existsSync(this.outputDir)) {
                    fs.mkdirSync(this.outputDir, { recursive: true });
                }
            } catch (finalError) {
                console.error('Failed to create any writable directory:', finalError);
                this.outputDir = null;
            }
        }
    }

    /**
     * Generate a basic chart without labels
     * @param {Object} data - Chart data
     * @param {string} type - Chart type
     * @param {string} title - Chart title
     * @returns {Object} - Chart configuration
     */
    createBaseChartConfig(data, type, title) {
        const { data: values, units } = data;
        
        // Enhanced color palettes
        const colorPalettes = {
            primary: [
                'rgba(54, 162, 235, 0.8)',   // Blue
                'rgba(255, 99, 132, 0.8)',   // Red
                'rgba(75, 192, 192, 0.8)',   // Teal
                'rgba(255, 206, 86, 0.8)',   // Yellow
                'rgba(153, 102, 255, 0.8)',  // Purple
                'rgba(255, 159, 64, 0.8)',   // Orange
                'rgba(199, 199, 199, 0.8)',  // Grey
                'rgba(83, 102, 255, 0.8)'    // Indigo
            ],
            borders: [
                'rgba(54, 162, 235, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(199, 199, 199, 1)',
                'rgba(83, 102, 255, 1)'
            ]
        };

        const getColors = (count, type = 'primary') => {
            return Array.from({ length: count }, (_, i) => colorPalettes[type][i % colorPalettes[type].length]);
        };

        // Empty labels - we'll add them later with SVG
        const emptyLabels = Array(values.length).fill('');

        switch (type.toLowerCase()) {
            case 'pie':
            case 'doughnut':
                return {
                    type: type.toLowerCase(),
                    data: {
                        labels: emptyLabels,
                        datasets: [{
                            data: values,
                            backgroundColor: getColors(values.length),
                            borderColor: getColors(values.length, 'borders'),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: title,
                                padding: 20
                            }
                        }
                    }
                };

            case 'line':
                return {
                    type: 'line',
                    data: {
                        labels: emptyLabels,
                        datasets: [{
                            label: 'Values',
                            data: values,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: title,
                                padding: 20
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        }
                    }
                };

            case 'bar':
            default:
                return {
                    type: 'bar',
                    data: {
                        labels: emptyLabels,
                        datasets: [{
                            label: 'Values',
                            data: values,
                            backgroundColor: getColors(values.length),
                            borderColor: getColors(values.length, 'borders'),
                            borderWidth: 2,
                            borderRadius: 6,
                            borderSkipped: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: title,
                                padding: 20
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        }
                    }
                };
        }
    }

    /**
     * Generate a chart with SVG overlays for labels
     * @param {Object} data - Chart data with labels and values
     * @param {string} type - Chart type
     * @param {string} title - Chart title
     * @returns {Promise<string|Object>} - File path or buffer object
     */
    async generateGraph(data, type = 'bar', title = 'Data Visualization') {
        try {
            console.log('Generating chart with SVG labels:', { type, title });
            
            // Create chart config without labels (we'll add them via SVG)
            const baseConfig = this.createBaseChartConfig(data, type, title);
            
            // Render the base chart
            const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(baseConfig);
            
            // Create SVG with labels
            const svgLabels = this.createLabelsSVG(data, type);
            
            // Combine chart image with SVG labels
            const finalBuffer = await this.combineChartWithLabels(imageBuffer, svgLabels, type);
            
            // Generate a unique filename with timestamp and random string
            const randomString = Math.random().toString(36).substring(2, 11);
            const filename = `graph_${Date.now()}_${randomString}.png`;
            
            // If no writable directory is available, return buffer directly
            if (!this.outputDir) {
                console.log('No writable directory available, returning image buffer directly');
                return { buffer: finalBuffer, isBuffer: true };
            }

            const filepath = path.join(this.outputDir, filename);

            try {
                fs.writeFileSync(filepath, finalBuffer);
                console.log('Chart saved to:', filepath);
                
                // Determine if we're using the static directory and return URL
                let baseUrl;
                
                if (this.isAzure) {
                    // Azure App Service environment
                    baseUrl = process.env.WEBSITE_HOSTNAME ? 
                        `https://${process.env.WEBSITE_HOSTNAME}` : 
                        process.env.APP_SERVICE_URL;
                } else {
                    // Local development fallback
                    const port = process.env.PORT || 3978;
                    baseUrl = `http://localhost:${port}`;
                }
                
                if (!baseUrl) {
                    // Final fallback
                    baseUrl = process.env.APP_SERVICE_URL || 'https://yourappname.azurewebsites.net';
                }
                
                // Ensure no trailing slash in the baseUrl
                if (baseUrl.endsWith('/')) {
                    baseUrl = baseUrl.slice(0, -1);
                }
                
                const imageUrl = `${baseUrl}/images/${filename}`;
                console.log('Chart URL:', imageUrl);
                return { url: imageUrl, filepath: filepath };
            } catch (writeError) {
                console.error('Failed to write chart to disk:', writeError);
                console.log('Falling back to in-memory buffer');
                return { buffer: finalBuffer, isBuffer: true };
            }
        } catch (error) {
            console.error('Error generating chart:', error);
            return null;
        }
    }

    /**
     * Create SVG with text labels
     * @param {Object} data - Chart data
     * @param {string} type - Chart type
     * @returns {string} - SVG string
     */
    createLabelsSVG(data, type) {
        const { labels } = data;
        if (!labels || !Array.isArray(labels)) {
            return null;
        }

        // Create a simplified SVG with just the text labels
        // This is just a placeholder - in a real implementation you'd calculate
        // the positions based on the chart type and data
        let svg = `<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg">`;
        
        if (type.toLowerCase() === 'bar' || type.toLowerCase() === 'line') {
            // For bar and line charts, add labels at the bottom
            const labelWidth = 1000 / labels.length;
            const xOffset = 100; // Left margin
            const yPosition = 650; // Bottom position
            
            labels.forEach((label, index) => {
                const x = xOffset + (index * labelWidth) + (labelWidth / 2);
                svg += `<text x="${x}" y="${yPosition}" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="black">${this.safeText(label)}</text>`;
            });
        } else if (type.toLowerCase() === 'pie' || type.toLowerCase() === 'doughnut') {
            // For pie/doughnut charts, add labels on the right side as a legend
            const yOffset = 200;
            const lineHeight = 30;
            
            labels.forEach((label, index) => {
                const y = yOffset + (index * lineHeight);
                svg += `<rect x="850" y="${y - 10}" width="20" height="20" fill="rgba(0,0,0,0)" stroke="black"/>`;
                svg += `<text x="880" y="${y + 5}" font-family="Arial, sans-serif" font-size="14" text-anchor="start" fill="black">${this.safeText(label)}</text>`;
            });
        }
        
        svg += `</svg>`;
        return svg;
    }

    /**
     * Sanitize text for SVG
     * @param {string} text - Input text
     * @returns {string} - Safe text
     */
    safeText(text) {
        if (typeof text !== 'string') {
            return String(text);
        }
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Combine chart image with SVG labels
     * @param {Buffer} imageBuffer - Chart image buffer
     * @param {string} svgLabels - SVG string with labels
     * @param {string} type - Chart type
     * @returns {Promise<Buffer>} - Combined image buffer
     */
    async combineChartWithLabels(imageBuffer, svgLabels, type) {
        // In a real implementation, you would combine the chart image with the SVG labels
        // This would require using a library like sharp or jimp to composite the images
        
        // For this simplified example, we'll just use a custom method to draw the labels
        // onto the chart using the canvas API
        
        try {
            // Create a canvas from the original chart image
            const img = new (require('canvas')).Image();
            img.src = imageBuffer;
            
            const canvas = createCanvas(1200, 700);
            const ctx = canvas.getContext('2d');
            
            // Draw the original chart
            ctx.drawImage(img, 0, 0, 1200, 700);
            
            // Draw the labels based on chart type
            // First, find all full <text>...</text> tag strings
            const fullTextTagMatches = svgLabels.match(/<text[^>]*>([^<]+)<\/text>/g);
            // Then, for each full tag string, extract only the inner content
            const labels = fullTextTagMatches ? fullTextTagMatches.map(fullTag => {
                const innerContentMatch = fullTag.match(/<text[^>]*>([^<]+)<\/text>/);
                return innerContentMatch ? innerContentMatch[1].trim() : ''; // Also trim whitespace
            }) : [];
            
            if (type.toLowerCase() === 'bar' || type.toLowerCase() === 'line') {
                // Draw labels for bar and line charts
                const labelWidth = 1000 / labels.length;
                const xOffset = 100;
                const yPosition = 650;
                
                ctx.font = '14px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'black';
                
                labels.forEach((label, index) => {
                    const x = xOffset + (index * labelWidth) + (labelWidth / 2);
                    ctx.fillText(label, x, yPosition);
                });
            } else if (type.toLowerCase() === 'pie' || type.toLowerCase() === 'doughnut') {
                // Draw legend for pie and doughnut charts
                const yOffset = 200;
                const lineHeight = 30;
                
                ctx.font = '14px Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillStyle = 'black';
                
                labels.forEach((label, index) => {
                    const y = yOffset + (index * lineHeight);
                    ctx.strokeRect(850, y - 10, 20, 20);
                    ctx.fillText(label, 880, y + 5);
                });
            }
            
            // Convert the canvas back to a buffer
            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error combining chart with labels:', error);
            // If there's an error, return the original chart image
            return imageBuffer;
        }
    }

    /**
     * Clean up a graph file
     * @param {string} filepath - Path to graph file
     */
    cleanupGraphFile(filepath) {
        try {
            if (filepath && typeof filepath === 'string' && fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log('Cleaned up graph file:', filepath);
            }
        } catch (error) {
            console.error('Error cleaning up graph file:', error);
        }
    }
    
    /**
     * Start timer to clean up old images periodically
     */
    startCleanupTimer() {
        // Clean every 10 minutes
        const interval = 10 * 60 * 1000;
        setInterval(() => {
            this.cleanupOldImages();
        }, interval);
        console.log(`Cleanup timer started, will run every ${interval/60000} minutes`);
    }
    
    /**
     * Clean up old images to prevent disk space issues
     */
    cleanupOldImages() {
        try {
            if (!this.staticImagesDir || !fs.existsSync(this.staticImagesDir)) {
                return;
            }
            
            console.log('Running cleanup of old graph images...');
            const files = fs.readdirSync(this.staticImagesDir);
            const now = Date.now();
            let cleanedCount = 0;
            
            files.forEach(file => {
                // Only clean graph files we've generated
                if (!file.startsWith('graph_')) {
                    return;
                }
                
                const filePath = path.join(this.staticImagesDir, file);
                const stats = fs.statSync(filePath);
                const fileAge = now - stats.mtime.getTime();
                
                // Delete files older than 30 minutes
                const maxAge = 30 * 60 * 1000; // 30 minutes
                if (fileAge > maxAge) {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`Cleaned up ${cleanedCount} old graph images`);
            }
        } catch (error) {
            console.error('Error cleaning up images:', error);
        }
    }
}

module.exports = SVGGraphService;
