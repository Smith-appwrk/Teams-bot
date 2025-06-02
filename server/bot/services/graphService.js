const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class GraphService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../temp/graphs');
        this.ensureOutputDir();

        // Initialize Chart.js canvas with enhanced configuration
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

                // Enhanced default styling
                ChartJS.defaults.font.family = 'Arial, Helvetica, sans-serif';
                ChartJS.defaults.font.size = 14;
                ChartJS.defaults.color = '#333333';
                ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
                ChartJS.defaults.plugins.legend.labels.padding = 20;

                // Set default border radius for bars
                if (ChartJS.defaults.elements && ChartJS.defaults.elements.bar) {
                    ChartJS.defaults.elements.bar.borderRadius = 8;
                    ChartJS.defaults.elements.bar.borderSkipped = false;
                }
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
            console.log('Generating chart with Chart.js:', { data, type, title });

            const chartConfig = this.createChartJSConfig(data, type, title);
            const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(chartConfig);

            const filename = `graph_${Date.now()}.png`;
            const filepath = path.join(this.outputDir, filename);

            fs.writeFileSync(filepath, imageBuffer);
            console.log('Chart saved to:', filepath);
            return filepath;
        } catch (error) {
            console.error('Error generating chart:', error);
            return null;
        }
    }

    createChartJSConfig(data, type, title) {
        const { labels, data: values, units } = data;

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
                            borderWidth: 3,
                            hoverBorderWidth: 5
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
                                    size: 24,
                                    weight: 'bold',
                                    family: 'Arial, Helvetica, sans-serif'
                                },
                                padding: 30,
                                color: '#2c3e50'
                            },
                            legend: {
                                position: 'right',
                                labels: {
                                    font: { size: 14 },
                                    padding: 20,
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
                                                    lineWidth: 2,
                                                    index: i
                                                };
                                            });
                                        }
                                        return [];
                                    }
                                }
                            },
                            tooltip: {
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
                                top: 20,
                                bottom: 20,
                                left: 20,
                                right: 150
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
                            borderWidth: 4,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 3,
                            pointRadius: 8,
                            pointHoverRadius: 12
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
                                    size: 24,
                                    weight: 'bold',
                                    family: 'Arial, Helvetica, sans-serif'
                                },
                                padding: 30,
                                color: '#2c3e50'
                            },
                            legend: {
                                display: false
                            },
                            tooltip: {
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
                                        size: 16,
                                        family: 'Arial, Helvetica, sans-serif',
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                },
                                ticks: {
                                    font: { size: 12 }
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Categories',
                                    font: {
                                        size: 16,
                                        family: 'Arial, Helvetica, sans-serif',
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                ticks: {
                                    maxRotation: 45,
                                    font: { size: 12 }
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        },
                        layout: {
                            padding: 30
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
                            borderRadius: 8,
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
                                    size: 24,
                                    weight: 'bold',
                                    family: 'Arial, Helvetica, sans-serif'
                                },
                                padding: 30,
                                color: '#2c3e50'
                            },
                            legend: {
                                display: false
                            },
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
                                    font: {
                                        size: 16,
                                        family: 'Arial, Helvetica, sans-serif',
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                },
                                ticks: {
                                    font: { size: 12 }
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Categories',
                                    font: {
                                        size: 16,
                                        family: 'Arial, Helvetica, sans-serif',
                                        weight: 'bold'
                                    },
                                    color: '#2c3e50'
                                },
                                ticks: {
                                    maxRotation: 45,
                                    font: { size: 12 }
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        },
                        layout: {
                            padding: 30
                        }
                    }
                };
        }
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
