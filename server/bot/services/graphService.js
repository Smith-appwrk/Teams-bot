const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

class GraphService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../temp/graphs');
        this.ensureOutputDir();
    }

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async generateGraph(data, type = 'bar', title = 'Data Visualization') {
        try {
            console.log('Generating high-quality graph with data:', data);
            console.log('Graph type:', type);
            console.log('Title:', title);

            // Create HTML with Plotly chart
            const html = this.createPlotlyHTML(data, type, title);

            // Generate image using Puppeteer
            const imagePath = await this.renderChartToImage(html);

            console.log('High-quality graph saved to:', imagePath);
            return imagePath;
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
                        font: { size: 24, family: 'Arial, sans-serif', color: '#2c3e50' },
                        x: 0.5
                    },
                    font: { size: 14, family: 'Arial, sans-serif' },
                    showlegend: true,
                    legend: {
                        orientation: 'v',
                        x: 1.02,
                        y: 0.5,
                        font: { size: 12 }
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
                        font: { size: 24, family: 'Arial, sans-serif', color: '#2c3e50' },
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
                    font: { size: 14, family: 'Arial, sans-serif' },
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
                        font: { size: 24, family: 'Arial, sans-serif', color: '#2c3e50' },
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
                    font: { size: 14, family: 'Arial, sans-serif' },
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
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            font-family: Arial, sans-serif; 
            background: white;
        }
        #chart { 
            width: 1200px; 
            height: 700px; 
        }
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        const data = ${JSON.stringify(plotlyData)};
        const layout = ${JSON.stringify(layout)};
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
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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

    // Clean up a specific graph file after it's been sent
    async cleanupGraphFile(filePath) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Cleaned up graph file:', filePath);
            }
        } catch (error) {
            console.error('Error cleaning up graph file:', error);
        }
    }

    // Clean up old graph files (older than 1 hour)
    cleanupOldGraphs() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                return;
            }

            const files = fs.readdirSync(this.outputDir);
            const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour in milliseconds

            files.forEach(file => {
                const filePath = path.join(this.outputDir, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime.getTime() < oneHourAgo) {
                    fs.unlinkSync(filePath);
                    console.log('Cleaned up old graph file:', file);
                }
            });
        } catch (error) {
            console.error('Error cleaning up old graphs:', error);
        }
    }
}

module.exports = GraphService;
