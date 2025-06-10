const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Test canvas and font rendering
function testFontRendering() {
    console.log('Testing font rendering with canvas...');

    try {
        // Create a simple canvas
        const canvas = createCanvas(400, 200);
        const ctx = canvas.getContext('2d');

        // Set background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 200);

        // Try to render text with different fonts
        ctx.fillStyle = 'black';

        // Test with Arial (should be available)
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText('Test Text with Arial: Hello World! 123', 10, 30);

        // Test with serif
        ctx.font = '16px serif';
        ctx.fillText('Test Text with serif: Hello World! 123', 10, 60);

        // Test with monospace
        ctx.font = '16px monospace';
        ctx.fillText('Test Text with monospace: Hello World! 123', 10, 90);

        // Test with sans-serif
        ctx.font = '16px sans-serif';
        ctx.fillText('Test Text with sans-serif: Hello World! 123', 10, 120);

        // Add some numbers and special characters
        ctx.font = '14px Arial';
        ctx.fillText('Numbers: 0123456789', 10, 150);
        ctx.fillText('Special: !@#$%^&*()[]{}', 10, 170);

        // Save the test image
        const buffer = canvas.toBuffer('image/png');
        const testPath = path.join(__dirname, 'font-test.png');
        fs.writeFileSync(testPath, buffer);

        console.log(`Font test image saved to: ${testPath}`);
        console.log(`Image size: ${buffer.length} bytes`);

        return true;
    } catch (error) {
        console.error('Font rendering test failed:', error);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testFontRendering();
}

module.exports = { testFontRendering }; 