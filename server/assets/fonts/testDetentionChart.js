const VegaGraphService = require('../../bot/services/vegaGraphService');

async function testDetentionChart() {
    console.log('Testing detention cost chart (same as user scenario)...');

    try {
        const graphService = new VegaGraphService();

        // Exact data from the user's logs
        const detentionData = {
            labels: ["Papers Transportation", "Clipper Logistics", "Shaffer Trucking Company", "Legend Transport"],
            data: [740, 260, 120, 380],
            units: ["USD", "USD", "USD", "USD"],
            title: "Detention Cost by Carrier - March 2025",
            chartType: "bar"
        };

        console.log('Generating detention cost chart...');
        const chartResult = await graphService.generateGraph(detentionData, 'bar', 'Detention Cost by Carrier - March 2025');

        if (Buffer.isBuffer(chartResult)) {
            console.log(`✅ Detention chart generated successfully! Size: ${chartResult.length} bytes`);

            // Save to file for inspection
            const fs = require('fs');
            const path = require('path');
            const testPath = path.join(__dirname, 'detention-test.png');
            fs.writeFileSync(testPath, chartResult);
            console.log(`📊 Chart saved to: ${testPath}`);

            if (chartResult.length < 5000) {
                console.log('⚠️  WARNING: Chart size seems small, might be empty');
            } else {
                console.log('✅ Chart size looks good!');
            }
        } else {
            console.log(`✅ Detention chart generated successfully! Path: ${chartResult}`);
        }

    } catch (error) {
        console.error('❌ Detention chart test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testDetentionChart();
}

module.exports = { testDetentionChart }; 