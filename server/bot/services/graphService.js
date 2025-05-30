const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class GraphService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../temp/graphs');
        this.ensureOutputDir();

        // Initialize Chart.js canvas as fallback
        this.chartJSNodeCanvas = new ChartJSNodeCanvas({
            width: 1000,
            height: 600,
            backgroundColour: 'white',
            chartCallback: (ChartJS) => {
                // Register better fonts and fallbacks
                ChartJS.defaults.font.family = 'Arial, Helvetica, sans-serif';
                ChartJS.defaults.font.size = 12;
                ChartJS.defaults.color = '#333333';
            }
        });
    }

    ensureOutputDir() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
                console.log('Created graph output directory:', this.outputDir);
            }
        } catch (error) {
            console.error('Error creating graph output directory:', error);
            // Fallback to a temporary directory in the current working directory
            this.outputDir = path.join(process.cwd(), 'temp', 'graphs');
            try {
                if (!fs.existsSync(this.outputDir)) {
                    fs.mkdirSync(this.outputDir, { recursive: true });
                    console.log('Created fallback graph directory:', this.outputDir);
                }
            } catch (fallbackError) {
                console.error('Error creating fallback directory:', fallbackError);
                // Last resort: use system temp directory
                this.outputDir = path.join(require('os').tmpdir(), 'bot-graphs');
                if (!fs.existsSync(this.outputDir)) {
                    fs.mkdirSync(this.outputDir, { recursive: true });
                    console.log('Created system temp graph directory:', this.outputDir);
                }
            }
        }
    }

    async generateGraph(data, type = 'bar', title = 'Data Visualization') {
        try {
            console.log('Generating high-quality graph with data:', data);
            console.log('Graph type:', type);
            console.log('Title:', title);

            // Try Puppeteer first (for better quality)
            try {
                const html = this.createPlotlyHTML(data, type, title);
                const imagePath = await this.renderChartToImage(html);
                console.log('High-quality graph saved to:', imagePath);
                return imagePath;
            } catch (puppeteerError) {
                console.log('Puppeteer failed, falling back to Chart.js:', puppeteerError.message);

                // Fallback to Chart.js
                const chartConfig = this.createChartJSConfig(data, type, title);
                const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(chartConfig);

                const filename = `graph_${Date.now()}.png`;
                const filepath = path.join(this.outputDir, filename);

                fs.writeFileSync(filepath, imageBuffer);
                console.log('Fallback graph saved to:', filepath);
                return filepath;
            }
        } catch (error) {
            console.error('Error generating graph:', error);
            return null;
        }
    }

    createPlotlyHTML(data, type, title) {
        const { labels, data: values, units } = data;

        let plotlyData, layout;

        switch (type.toLowerCase()) {
            case 'pie':
                plotlyData = [{
                    type: 'pie',
                    labels: labels,
                    values: values,
                    textinfo: 'label+percent+value',
                    textposition: 'auto',
                    hovertemplate: '<b>%{label}</b><br>Value: %{value}<br>Percentage: %{percent}<extra></extra>',
                    marker: {
                        colors: this.getPlotlyColors(labels.length),
                        line: {
                            color: '#FFFFFF',
                            width: 2
                        }
                    }
                }];

                layout = {
                    title: {
                        text: title,
                        font: { size: 24, family: 'Arial, Helvetica, sans-serif', color: '#2c3e50' },
                        x: 0.5
                    },
                    font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                    showlegend: true,
                    legend: {
                        orientation: 'v',
                        x: 1.02,
                        y: 0.5,
                        font: { size: 12, family: 'Arial, Helvetica, sans-serif' }
                    },
                    margin: { l: 50, r: 150, t: 80, b: 50 },
                    paper_bgcolor: 'white',
                    plot_bgcolor: 'white'
                };
                break;

            case 'line':
                plotlyData = [{
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: labels,
                    y: values,
                    line: {
                        color: '#3498db',
                        width: 4
                    },
                    marker: {
                        color: '#2980b9',
                        size: 8,
                        line: {
                            color: '#ffffff',
                            width: 2
                        }
                    },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y}<extra></extra>'
                }];

                layout = {
                    title: {
                        text: title,
                        font: { size: 24, family: 'Arial, Helvetica, sans-serif', color: '#2c3e50' },
                        x: 0.5
                    },
                    xaxis: {
                        title: { text: 'Categories', font: { size: 16 } },
                        tickangle: -45,
                        tickfont: { size: 12 },
                        gridcolor: '#ecf0f1'
                    },
                    yaxis: {
                        title: { text: units && units[0] ? `Value (${units[0]})` : 'Value', font: { size: 16 } },
                        tickfont: { size: 12 },
                        gridcolor: '#ecf0f1'
                    },
                    font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                    margin: { l: 80, r: 50, t: 80, b: 120 },
                    paper_bgcolor: 'white',
                    plot_bgcolor: 'white'
                };
                break;

            case 'bar':
            default:
                plotlyData = [{
                    type: 'bar',
                    x: labels,
                    y: values,
                    marker: {
                        color: this.getPlotlyColors(labels.length),
                        line: {
                            color: '#ffffff',
                            width: 2
                        }
                    },
                    text: values.map(v => units && units[0] ? `${v} ${units[0]}` : v.toString()),
                    textposition: 'outside',
                    textfont: { size: 12, color: '#2c3e50' },
                    hovertemplate: '<b>%{x}</b><br>Value: %{y}<extra></extra>'
                }];

                layout = {
                    title: {
                        text: title,
                        font: { size: 24, family: 'Arial, Helvetica, sans-serif', color: '#2c3e50' },
                        x: 0.5
                    },
                    xaxis: {
                        title: {
                            display: true,
                            text: 'Categories',
                            font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                            color: '#333333'
                        },
                        tickangle: -45,
                        tickfont: { size: 12 },
                        gridcolor: '#ecf0f1'
                    },
                    yaxis: {
                        title: { text: units && units[0] ? `Value (${units[0]})` : 'Value', font: { size: 16 } },
                        tickfont: { size: 12 },
                        gridcolor: '#ecf0f1'
                    },
                    font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                    margin: { l: 80, r: 50, t: 80, b: 120 },
                    paper_bgcolor: 'white',
                    plot_bgcolor: 'white',
                    showlegend: false
                };
                break;
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        body { 
            margin: 0; 
            padding: 20px; 
            font-family: 'Inter', Arial, Helvetica, sans-serif; 
            background: white;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        #chart { 
            width: 1200px; 
            height: 700px; 
            font-family: 'Inter', Arial, Helvetica, sans-serif;
        }
        
        /* Ensure text renders properly */
        * {
            font-family: 'Inter', Arial, Helvetica, sans-serif !important;
        }
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        const data = ${JSON.stringify(plotlyData)};
        const layout = ${JSON.stringify(layout)};
        
        // Override font family in layout to ensure proper rendering
        if (layout.font) {
            layout.font.family = 'Inter, Arial, Helvetica, sans-serif';
        }
        if (layout.title && layout.title.font) {
            layout.title.font.family = 'Inter, Arial, Helvetica, sans-serif';
        }
        if (layout.xaxis && layout.xaxis.title && layout.xaxis.title.font) {
            layout.xaxis.title.font.family = 'Inter, Arial, Helvetica, sans-serif';
        }
        if (layout.yaxis && layout.yaxis.title && layout.yaxis.title.font) {
            layout.yaxis.title.font.family = 'Inter, Arial, Helvetica, sans-serif';
        }
        
        const config = {
            responsive: true,
            displayModeBar: false,
            staticPlot: true
        };
        
        Plotly.newPlot('chart', data, layout, config);
    </script>
</body>
</html>`;
    }

    async renderChartToImage(html) {
        let browser;
        try {
            // Try to launch Puppeteer with more robust configuration for server environments
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 700 });
            await page.setContent(html, { waitUntil: 'networkidle0' });

            // Wait for Plotly to render - use the correct method
            await page.waitForSelector('#chart', { timeout: 10000 });
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    setTimeout(resolve, 2000); // Wait 2 seconds for chart to fully render
                });
            });

            const filename = `graph_${Date.now()}.png`;
            const filepath = path.join(this.outputDir, filename);

            await page.screenshot({
                path: filepath,
                type: 'png',
                fullPage: false,
                clip: { x: 0, y: 0, width: 1200, height: 700 }
            });

            return filepath;
        } catch (error) {
            console.error('Error in renderChartToImage:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    getPlotlyColors(count) {
        const colors = [
            '#3498db', '#e74c3c', '#f39c12', '#2ecc71',
            '#9b59b6', '#1abc9c', '#34495e', '#e67e22',
            '#95a5a6', '#f1c40f', '#8e44ad', '#16a085'
        ];

        return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
    }

    createChartJSConfig(data, type, title) {
        const { labels, data: values, units } = data;

        switch (type.toLowerCase()) {
            case 'pie':
                return {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: this.getChartJSColors(labels.length),
                            borderColor: '#ffffff',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: title,
                                font: { size: 20, weight: 'bold', family: 'Arial, Helvetica, sans-serif' },
                                padding: 20,
                                color: '#333333'
                            },
                            legend: {
                                position: 'right',
                                labels: {
                                    font: { size: 12 },
                                    padding: 15,
                                    generateLabels: function (chart) {
                                        const data = chart.data;
                                        if (data.labels.length && data.datasets.length) {
                                            return data.labels.map((label, i) => {
                                                const value = data.datasets[0].data[i];
                                                const unit = units && units[i] ? ` ${units[i]}` : '';
                                                return {
                                                    text: `${label}: ${value}${unit}`,
                                                    fillStyle: data.datasets[0].backgroundColor[i],
                                                    strokeStyle: '#ffffff',
                                                    lineWidth: 2,
                                                    index: i
                                                };
                                            });
                                        }
                                        return [];
                                    }
                                }
                            }
                        },
                        layout: { padding: 20 }
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
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.4,
                            pointBackgroundColor: '#3498db',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: title,
                                font: { size: 20, weight: 'bold', family: 'Arial, Helvetica, sans-serif' },
                                padding: 20,
                                color: '#333333'
                            },
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: units && units[0] ? `Value (${units[0]})` : 'Value',
                                    font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                                    color: '#333333'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Categories',
                                    font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                                    color: '#333333'
                                },
                                ticks: { maxRotation: 45 }
                            }
                        },
                        layout: { padding: 20 }
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
                            backgroundColor: this.getChartJSColors(labels.length),
                            borderColor: '#ffffff',
                            borderWidth: 2,
                            borderRadius: 8,
                            borderSkipped: false,
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: title,
                                font: { size: 20, weight: 'bold', family: 'Arial, Helvetica, sans-serif' },
                                padding: 20,
                                color: '#333333'
                            },
                            legend: { display: false },
                            tooltip: {
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
                                    font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                                    color: '#333333'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Categories',
                                    font: { size: 14, family: 'Arial, Helvetica, sans-serif' },
                                    color: '#333333'
                                },
                                ticks: { maxRotation: 45 }
                            }
                        },
                        layout: { padding: 20 }
                    }
                };
        }
    }

    getChartJSColors(count) {
        const colors = [
            'rgba(54, 162, 235, 0.8)', 'rgba(255, 99, 132, 0.8)', 'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
            'rgba(199, 199, 199, 0.8)', 'rgba(83, 102, 255, 0.8)'
        ];
        return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
    }

    // Clean up a specific graph file after it's been sent
    async cleanupGraphFile(filePath) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Cleaned up graph file:', filePath);
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
