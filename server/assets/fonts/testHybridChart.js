const HybridGraphService = require('../../bot/services/hybridGraphService');

async function testHybridChart() {
    console.log('Testing Hybrid chart generation...');

    try {
        const graphService = new HybridGraphService();

        // Test data - same as the detention cost scenario
        const detentionData = {
            labels: ["Papers Transportation", "Clipper Logistics", "Shaffer Trucking Company", "Legend Transport"],
            data: [740, 260, 120, 380],
            units: ["USD", "USD", "USD", "USD"],
            title: "Detention Cost by Carrier - March 2025",
            chartType: "bar"
        };

        console.log('Generating detention cost chart with Hybrid service...');
        const chartResult = await graphService.generateGraph(detentionData, 'bar', 'Detention Cost by Carrier - March 2025');

        if (Buffer.isBuffer(chartResult)) {
            console.log(`✅ Hybrid chart generated successfully! Size: ${chartResult.length} bytes`);
        } else {
            console.log(`✅ Hybrid chart generated successfully! Path: ${chartResult}`);
        }

        console.log('🎉 Hybrid chart test passed!');

    } catch (error) {
        console.error('❌ Hybrid chart test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testHybridChart();
}

module.exports = { testHybridChart }; 