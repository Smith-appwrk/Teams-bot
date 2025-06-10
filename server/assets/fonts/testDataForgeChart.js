const DataForgeGraphService = require('../../bot/services/dataForgeGraphService');

async function testDataForgeChart() {
    console.log('Testing Data-Forge chart generation...');

    try {
        const graphService = new DataForgeGraphService();

        // Test data - same as the detention cost scenario
        const detentionData = {
            labels: ["Papers Transportation", "Clipper Logistics", "Shaffer Trucking Company", "Legend Transport"],
            data: [740, 260, 120, 380],
            units: ["USD", "USD", "USD", "USD"],
            title: "Detention Cost by Carrier - March 2025",
            chartType: "bar"
        };

        console.log('Generating detention cost chart with Data-Forge...');
        const chartResult = await graphService.generateGraph(detentionData, 'bar', 'Detention Cost by Carrier - March 2025');

        console.log(`✅ Data-Forge chart generated successfully! Path: ${chartResult}`);

        // Test different chart types
        console.log('Generating pie chart...');
        const pieChart = await graphService.generateGraph(detentionData, 'pie', 'Sales Distribution Pie Chart');
        console.log(`✅ Pie chart generated successfully! Path: ${pieChart}`);

        console.log('Generating line chart...');
        const lineChart = await graphService.generateGraph(detentionData, 'line', 'Trend Analysis');
        console.log(`✅ Line chart generated successfully! Path: ${lineChart}`);

        console.log('🎉 All Data-Forge chart tests passed!');

    } catch (error) {
        console.error('❌ Data-Forge chart test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testDataForgeChart();
}

module.exports = { testDataForgeChart }; 