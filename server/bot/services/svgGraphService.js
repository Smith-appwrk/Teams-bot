const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { createCanvas, registerFont } = require('canvas');

class SVGGraphService {
    constructor() {
        this.isAzure = process.env.WEBSITE_SITE_NAME !== undefined;
        console.log(`[SVGGraphService] Running on Azure: ${this.isAzure}`);

        if (this.isAzure) {
            this.staticImagesDir = path.join(process.env.HOME || '', 'site', 'wwwroot', 'images');
            this.tempDir = path.join(process.env.TEMP || require('os').tmpdir(), 'teamsbot-graphs');
        } else {
            this.staticImagesDir = path.join(__dirname, '../../../wwwroot/images');
            this.tempDir = path.join(__dirname, '../../temp/graphs');
        }
        
        console.log(`[SVGGraphService] staticImagesDir: ${this.staticImagesDir}`);
        console.log(`[SVGGraphService] tempDir: ${this.tempDir}`);
        
        this.ensureDirectories();
        this.setupFontConfig(); 
        this.startCleanupTimer();

        const fontFileName = 'OpenSans.ttf';
        const fontPath = path.resolve(__dirname, '..', '..', 'assets', 'fonts', fontFileName); 
        
        console.log(`[FontLoading] Attempting to load font. Resolved path: ${fontPath}`);
        this.defaultFontFamily = 'sans-serif';

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
                }
            } else {
                console.warn(`[FontLoading] FONT FILE NOT FOUND: '${fontPath}'. Please ensure '${fontFileName}' is in 'server/assets/fonts/' and deployed correctly. Chart.js will use fallback 'sans-serif'.`);
            }
        } catch (fontAccessError) {
            console.error(`[FontLoading] Error accessing font path '${fontPath}' (e.g., fs.existsSync failed):`, fontAccessError.message, fontAccessError.stack);
        }

        this.chartJSNodeCanvas = new ChartJSNodeCanvas({
            width: 1200,
            height: 700,
            backgroundColour: 'white',
            chartCallback: (ChartJS) => {
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
        try {
            if (!fs.existsSync(this.staticImagesDir)) {
                fs.mkdirSync(this.staticImagesDir, { recursive: true });
                console.log(`Created static images directory at: ${this.staticImagesDir}`);
            }
            
            const testFile = path.join(this.staticImagesDir, 'test_write.tmp');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('Static images directory is writable:', this.staticImagesDir);
            
            this.outputDir = this.staticImagesDir;
            return;
        } catch (error) {
            console.warn('Static images directory is not writable, falling back to temp directory:', error.message);
        }
        
        try {
            const isAzure = process.env.WEBSITE_SITE_NAME || process.env.APPSETTING_WEBSITE_SITE_NAME;

            if (isAzure) {
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

            this.outputDir = this.tempDir;
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
                console.log('Created local graph output directory:', this.outputDir);
            }
        } catch (error) {
            console.error('Error creating graph output directory:', error);
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

    createBaseChartConfig(data, type, title) {
        const { data: values, units } = data;
        
        const colorPalettes = {
            primary: [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(199, 199, 199, 0.8)',
                'rgba(83, 102, 255, 0.8)'
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

    async generateGraph(data, type = 'bar', title = 'Data Visualization') {
        try {
            console.log('Generating chart with canvas labels:', { type, title });
            
            const baseConfig = this.createBaseChartConfig(data, type, title);
            const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(baseConfig);
            
            const labelPositions = this.calculateLabelPositions(data, type, 1200, 700);
            console.log(`Label positions calculated: ${labelPositions.length} labels`);
            
            const finalBuffer = await this.combineChartWithLabels(imageBuffer, labelPositions);
            
            const randomString = Math.random().toString(36).substring(2, 11);
            const filename = `graph_${Date.now()}_${randomString}.png`;
            
            if (!this.outputDir) {
                console.log('No writable directory available, returning image buffer directly');
                return { buffer: finalBuffer, isBuffer: true };
            }

            const filepath = path.join(this.outputDir, filename);

            try {
                fs.writeFileSync(filepath, finalBuffer);
                console.log('Chart saved to:', filepath);
                
                let baseUrl;
                
                if (this.isAzure) {
                    baseUrl = process.env.WEBSITE_HOSTNAME ? 
                        `https://${process.env.WEBSITE_HOSTNAME}` : 
                        process.env.APP_SERVICE_URL;
                } else {
                    const port = process.env.PORT || 3978;
                    baseUrl = `http://localhost:${port}`;
                }
                
                if (!baseUrl) {
                    baseUrl = process.env.APP_SERVICE_URL || 'https://yourappname.azurewebsites.net';
                }
                
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

    // NEW: Calculate label positions based on chart type and dimensions
    calculateLabelPositions(data, type, width, height) {
        const { labels } = data;
        if (!labels || !Array.isArray(labels)) {
            return [];
        }

        const positions = [];
        const fontSize = 14;

        if (type.toLowerCase() === 'bar' || type.toLowerCase() === 'line') {
            const labelWidth = (width - 200) / labels.length;
            const xOffset = 100;
            const yPosition = height - 50;

            labels.forEach((label, index) => {
                positions.push({
                    text: label,
                    x: xOffset + (index * labelWidth) + (labelWidth / 2),
                    y: yPosition,
                    textAlign: 'center',
                    fontSize
                });
            });
        } else if (type.toLowerCase() === 'pie' || type.toLowerCase() === 'doughnut') {
            const startX = width - 150;
            const startY = 200;
            const lineHeight = 30;

            labels.forEach((label, index) => {
                positions.push({
                    text: label,
                    x: startX,
                    y: startY + (index * lineHeight),
                    textAlign: 'left',
                    fontSize
                });
            });
        }

        return positions;
    }

    // UPDATED: Draw labels directly on canvas
    async combineChartWithLabels(imageBuffer, labelPositions) {
        try {
            const { Image } = require('canvas');
            const img = new Image();
            img.src = imageBuffer;
            
            const canvas = createCanvas(1200, 700);
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0, 1200, 700);
            
            if (labelPositions && labelPositions.length > 0) {
                ctx.fillStyle = 'black';
                labelPositions.forEach(label => {
                    ctx.font = `${label.fontSize}px "${this.defaultFontFamily}"`;
                    ctx.textAlign = label.textAlign;
                    ctx.fillText(label.text, label.x, label.y);
                });
            }
            
            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error combining chart with labels:', error);
            return imageBuffer;
        }
    }

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
    
    startCleanupTimer() {
        const interval = 10 * 60 * 1000;
        setInterval(() => {
            this.cleanupOldImages();
        }, interval);
        console.log(`Cleanup timer started, will run every ${interval/60000} minutes`);
    }
    
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
                if (!file.startsWith('graph_')) {
                    return;
                }
                
                const filePath = path.join(this.staticImagesDir, file);
                const stats = fs.statSync(filePath);
                const fileAge = now - stats.mtime.getTime();
                
                const maxAge = 30 * 60 * 1000;
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

    setupFontConfig() {
    try {
        // Only set FONTCONFIG_PATH if not already defined
        if (!process.env.FONTCONFIG_PATH) {
            const fontConfigDir = path.join(require('os').tmpdir(), 'fontconfig');
            if (!fs.existsSync(fontConfigDir)) {
                fs.mkdirSync(fontConfigDir, { recursive: true });
            }
            
            // Create minimal fonts.conf file
            const fontsConfPath = path.join(fontConfigDir, 'fonts.conf');
            if (!fs.existsSync(fontsConfPath)) {
                const minimalConfig = `<?xml version="1.0"?>
                <!DOCTYPE fontconfig SYSTEM "fonts.dtd">
                <fontconfig>
                    <dir>/tmp</dir>
                    <cachedir>${path.join(fontConfigDir, 'cache')}</cachedir>
                    <config></config>
                </fontconfig>`;
                fs.writeFileSync(fontsConfPath, minimalConfig);
            }
            
            process.env.FONTCONFIG_PATH = fontConfigDir;
            console.log(`Set FONTCONFIG_PATH to: ${fontConfigDir}`);
        }
    } catch (error) {
        console.error('Error setting up fontconfig:', error);
    }
}
}

module.exports = SVGGraphService;