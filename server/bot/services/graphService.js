const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class GraphService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../temp/graphs');
        this.ensureOutputDir();

        // Configure fonts for better Azure compatibility
        this.configureFonts();

        // Initialize Chart.js canvas with enhanced configuration
        this.chartJSNodeCanvas = new ChartJSNodeCanvas({
            width: 1200,
            height: 700,
            backgroundColour: 'white',
            // Explicitly set canvas options for better cross-platform support
            plugins: {
                modern: true,
                requireLegacy: false
            },
            // Ensure text encoding is properly handled
            encoding: 'utf8',
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

                // Enhanced default styling with system-safe fonts for Azure
                const systemSafeFonts = this.getSystemSafeFonts();

                ChartJS.defaults.font.family = systemSafeFonts;
                ChartJS.defaults.font.size = 14; // Slightly larger for better readability
                
                // Ensure all text elements use the safe font stack
                if (ChartJS.defaults.plugins && ChartJS.defaults.plugins.title) {
                    ChartJS.defaults.plugins.title.font = {
                        family: systemSafeFonts,
                        size: 18,
                        weight: 'bold'
                    };
                }
                
                if (ChartJS.defaults.plugins && ChartJS.defaults.plugins.legend) {
                    ChartJS.defaults.plugins.legend.labels.font = {
                        family: systemSafeFonts,
                        size: 14
                    };
                }
                ChartJS.defaults.color = '#333333';
                ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
                ChartJS.defaults.plugins.legend.labels.padding = 15;

                // Set default border radius for bars
                if (ChartJS.defaults.elements && ChartJS.defaults.elements.bar) {
                    ChartJS.defaults.elements.bar.borderRadius = 6;
                    ChartJS.defaults.elements.bar.borderSkipped = false;
                }
            }
        });
    }

    configureFonts() {
        try {
            // Set environment variables for canvas font fallbacks
            process.env.PANGOCAIRO_BACKEND = 'fontconfig';
            process.env.FONTCONFIG_PATH = process.env.FONTCONFIG_PATH || '/etc/fonts';
            
            // Add additional font configuration for Azure
            if (process.env.WEBSITE_SITE_NAME || process.env.APPSETTING_WEBSITE_SITE_NAME) {
                // Force use of system fonts on Azure
                process.env.NODE_CANVAS_FORCE_SYSTEM_FONTS = 'true';
            }
        } catch (error) {
            console.log('Font configuration warning:', error.message);
        }
    }

    getSystemSafeFonts() {
        // More conservative font stack for server environments
        // Use web-safe fonts that are available on most systems including Azure
        return 'Arial, Helvetica, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    }

    ensureOutputDir() {
        try {
            // For Azure App Service, use the writable temp directory
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
                    '/home/site/wwwroot/App_Data/graphs',
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
            this.outputDir = path.join(__dirname, '../../temp/graphs');
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
                    console.log('Created system temp graph directory:', this.outputDir);
                }
            } catch (finalError) {
                console.error('Failed to create any writable directory:', finalError);
                // Use in-memory approach as absolute fallback
                this.outputDir = null;
            }
        }
    }

    async generateGraph(data, type = 'bar', title = 'Data Visualization') {
        try {
            console.log('Generating chart with Chart.js:', { data, type, title });

            const chartConfig = this.createChartJSConfig(data, type, title);
            const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(chartConfig);

            // If no writable directory is available, return buffer directly
            if (!this.outputDir) {
                console.log('No writable directory available, returning image buffer directly');
                return { buffer: imageBuffer, isBuffer: true };
            }

            const filename = `graph_${Date.now()}.png`;
            const filepath = path.join(this.outputDir, filename);

            try {
                fs.writeFileSync(filepath, imageBuffer);
                console.log('Chart saved to:', filepath);
                return filepath;
            } catch (writeError) {
                console.error('Failed to write chart to disk:', writeError);
                console.log('Falling back to in-memory buffer');
                return { buffer: imageBuffer, isBuffer: true };
            }
        } catch (error) {
            console.error('Error generating chart:', error);
            return null;
        }
    }

    createChartJSConfig(data, type, title) {
        const { labels, data: values, units } = data;

        // Use conservative fonts for cross-platform compatibility
        const systemSafeFonts = this.getSystemSafeFonts();

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

        switch (type.toLowerCase()) {
            case 'pie':
            case 'doughnut':
                return {
                    type: type.toLowerCase() === 'pie' ? 'pie' : 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: getColors(labels.length),
                            borderColor: getColors(labels.length, 'borders'),
                            borderWidth: 2,
                            hoverBorderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: title,
                                font: {
                                    size: 18,
                                    weight: 'bold',
                                    family: systemSafeFonts
                                },
                                padding: 20,
                                color: '#2c3e50'
                            },
                            legend: {
                                position: 'right',
                                labels: {
                                    font: { size: 11, family: systemSafeFonts },
                                    padding: 12,
                                    usePointStyle: true,
                                    generateLabels: function (chart) {
                                        const data = chart.data;
                                        if (data.labels.length && data.datasets.length) {
                                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                            return data.labels.map((label, i) => {
                                                const value = data.datasets[0].data[i];
                                                const percentage = ((value / total) * 100).toFixed(1);
                                                const unit = units && units[i] ? ` ${units[i]}` : '';
                                                return {
                                                    text: `${label}: ${value}${unit} (${percentage}%)`,
                                                    fillStyle: data.datasets[0].backgroundColor[i],
                                                    strokeStyle: data.datasets[0].borderColor[i],
                                                    lineWidth: 1,
                                                    index: i
                                                };
                                            });
                                        }
                                        return [];
                                    }
                                }
                            },
                            tooltip: {
                                titleFont: { family: systemSafeFonts, size: 12 },
                                bodyFont: { family: systemSafeFonts, size: 11 },
                                callbacks: {
                                    label: function (context) {
                                        const label = context.label || '';
                                        const value = context.parsed;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        const unit = units && units[context.dataIndex] ? ` ${units[context.dataIndex]}` : '';
                                        return `${label}: ${value}${unit} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        layout: {
                            padding: {
                                top: 15,
                                bottom: 15,
                                left: 15,
                                right: 120
                            }
                        }
                    }
                };

            case 'line':
                return {
                    type: 'line',
                    data: {
                        labels: labels,
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
                            pointRadius: 6,
                            pointHoverRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: title,
                                font: {
                                    size: 18,
                                    weight: 'bold',
                                    family: systemSafeFonts
                                },
                                padding: 20,
                                color: '#2c3e50'
                            },
                            legend: {
                                display: false
                            },
                            tooltip: {
                                titleFont: { family: systemSafeFonts, size: 12 },
                                bodyFont: { family: systemSafeFonts, size: 11 },
                                callbacks: {
                                    label: function (context) {
                                        const unit = units && units[0] ? ` ${units[0]}` : '';
                                        return `Value: ${context.parsed.y}${unit}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: units && units[0] ? `Value (${units[0]})` : 'Value',
                                    font: {
                                        size: 12,
                                        family: systemSafeFonts,
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                },
                                ticks: {
                                    font: { size: 10, family: systemSafeFonts }
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Categories',
                                    font: {
                                        size: 12,
                                        family: systemSafeFonts,
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                ticks: {
                                    maxRotation: 45,
                                    font: { size: 10, family: systemSafeFonts }
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        },
                        layout: {
                            padding: 20
                        }
                    }
                };

            case 'bar':
            default:
                return {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Values',
                            data: values,
                            backgroundColor: getColors(labels.length),
                            borderColor: getColors(labels.length, 'borders'),
                            borderWidth: 2,
                            borderRadius: 6,
                            borderSkipped: false,
                            hoverBackgroundColor: getColors(labels.length).map(color =>
                                color.replace('0.8', '1')
                            ),
                            hoverBorderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: title,
                                font: {
                                    size: 18,
                                    weight: 'bold',
                                    family: systemSafeFonts
                                },
                                padding: 20,
                                color: '#2c3e50'
                            },
                            legend: {
                                display: false
                            },
                            tooltip: {
                                titleFont: { family: systemSafeFonts, size: 12 },
                                bodyFont: { family: systemSafeFonts, size: 11 },
                                callbacks: {
                                    label: function (context) {
                                        const unit = units && units[context.dataIndex] ? ` ${units[context.dataIndex]}` : '';
                                        return `${context.parsed.y}${unit}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: units && units[0] ? `Value (${units[0]})` : 'Value',
                                    font: {
                                        size: 12,
                                        family: systemSafeFonts,
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                },
                                ticks: {
                                    font: { size: 10, family: systemSafeFonts }
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Categories',
                                    font: {
                                        size: 12,
                                        family: systemSafeFonts,
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                ticks: {
                                    maxRotation: 45,
                                    font: { size: 10, family: systemSafeFonts }
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        },
                        layout: {
                            padding: 20
                        }
                    }
                };
        }
    }

    // Clean up a specific graph file after it's been sent
    async cleanupGraphFile(filePath) {
        try {
            // Only attempt cleanup for actual file paths, not buffer objects
            if (typeof filePath === 'string' && filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Cleaned up graph file:', filePath);
            } else if (typeof filePath === 'object' && filePath.isBuffer) {
                console.log('Buffer object cleanup not needed');
            }
        } catch (error) {
            console.error('Error cleaning up graph file:', filePath, error.message);
        }
    }

    // Clean up old graph files (older than 1 hour)
    cleanupOldGraphs() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                console.log('Graph output directory does not exist, skipping cleanup');
                return;
            }

            const files = fs.readdirSync(this.outputDir);
            const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour in milliseconds
            let cleanedCount = 0;

            files.forEach(file => {
                try {
                    const filePath = path.join(this.outputDir, file);
                    const stats = fs.statSync(filePath);

                    if (stats.mtime.getTime() < oneHourAgo) {
                        fs.unlinkSync(filePath);
                        console.log('Cleaned up old graph file:', file);
                        cleanedCount++;
                    }
                } catch (fileError) {
                    console.error('Error processing file during cleanup:', file, fileError.message);
                }
            });

            if (cleanedCount > 0) {
                console.log(`Cleaned up ${cleanedCount} old graph files`);
            }
        } catch (error) {
            console.error('Error during graph cleanup:', error.message);
        }
    }
}

module.exports = GraphService;
