const VegaGraphService = require('../../bot/services/vegaGraphService');

async function testVegaChart() {
    console.log('Testing Vega chart generation with fonts...');

    try {
        const graphService = new VegaGraphService();

        // Sample data for testing
        const testData = {
            labels: ['January', 'February', 'March', 'April', 'May'],
            data: [10, 25, 15, 40, 30]
        };

        console.log('Generating bar chart...');
        const barChart = await graphService.generateGraph(testData, 'bar', 'Monthly Sales Data');

        if (Buffer.isBuffer(barChart)) {
            console.log(`✅ Bar chart generated successfully! Size: ${barChart.length} bytes`);
        } else {
            console.log(`✅ Bar chart generated successfully! Path: ${barChart}`);
        }

        console.log('Generating pie chart...');
        const pieChart = await graphService.generateGraph(testData, 'pie', 'Sales Distribution');

        if (Buffer.isBuffer(pieChart)) {
            console.log(`✅ Pie chart generated successfully! Size: ${pieChart.length} bytes`);
        } else {
            console.log(`✅ Pie chart generated successfully! Path: ${pieChart}`);
        }

        console.log('All chart tests passed! ✅');

    } catch (error) {
        console.error('❌ Chart generation test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testVegaChart();
}

module.exports = { testVegaChart }; 