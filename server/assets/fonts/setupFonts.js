const fs = require('fs');
const path = require('path');

class FontManager {
    constructor() {
        this.fontsDir = __dirname;
        this.fontConfig = null;
    }

    getFontConfig() {
        if (this.fontConfig) {
            return this.fontConfig;
        }

        // Use system fonts that are commonly available
        this.fontConfig = {
            "Arial": {
                "normal": this.getSystemFontPath("Arial"),
                "bold": this.getSystemFontPath("Arial Bold")
            },
            "Helvetica": {
                "normal": this.getSystemFontPath("Helvetica"),
                "bold": this.getSystemFontPath("Helvetica Bold")
            },
            "sans-serif": {
                "normal": this.getSystemFontPath("Arial"),
                "bold": this.getSystemFontPath("Arial Bold")
            }
        };

        return this.fontConfig;
    }

    getSystemFontPath(fontName) {
        // For Windows
        const windowsPaths = [
            `C:\\Windows\\Fonts\\${fontName.replace(' ', '')}.ttf`,
            `C:\\Windows\\Fonts\\arial.ttf`,
            `C:\\Windows\\Fonts\\calibri.ttf`
        ];

        // For Linux/Docker
        const linuxPaths = [
            `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`,
            `/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf`,
            `/System/Library/Fonts/Helvetica.ttc`
        ];

        const allPaths = [...windowsPaths, ...linuxPaths];

        for (const fontPath of allPaths) {
            if (fs.existsSync(fontPath)) {
                console.log(`Found font: ${fontPath}`);
                return fontPath;
            }
        }

        console.log(`No system font found for ${fontName}, using fallback`);
        return null;
    }

    getVegaFontConfig() {
        // Return a simplified config for Vega
        return {
            config: {
                font: "Arial, sans-serif",
                axis: {
                    labelFont: "Arial, sans-serif",
                    titleFont: "Arial, sans-serif"
                },
                legend: {
                    labelFont: "Arial, sans-serif",
                    titleFont: "Arial, sans-serif"
                },
                title: {
                    font: "Arial, sans-serif"
                }
            }
        };
    }
}

module.exports = FontManager; 