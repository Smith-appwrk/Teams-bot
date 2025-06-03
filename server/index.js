// Initialize telemetry before any other imports
const appInsights = require("applicationinsights");
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config()
appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
    .setAutoCollectConsole(true, true)
    .start();

const server = express();

// Create images directory for graph storage
const fs = require('fs');

// Check if running on Azure App Service
const isAzure = process.env.WEBSITE_SITE_NAME !== undefined;

// Set up proper paths based on environment
let imagesDir;
if (isAzure) {
    // On Azure App Service, use the writable wwwroot directory at the site root
    imagesDir = path.join(process.env.HOME || '', 'site', 'wwwroot', 'images');
} else {
    // Local development environment - use server/wwwroot/images
    imagesDir = path.join(__dirname, 'wwwroot', 'images');
}

console.log(`Using images directory: ${imagesDir}`);

// Create the directory if it doesn't exist
try {
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log(`Successfully created images directory at ${imagesDir}`);
    }
} catch (error) {
    console.error(`Failed to create images directory: ${error.message}`);
    // Fallback to a temp directory if we can't create the images directory
    imagesDir = path.join(require('os').tmpdir(), 'teamsbot-images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    console.log(`Using fallback images directory: ${imagesDir}`);
}

// Serve static files for graph images
server.use('/images', express.static(imagesDir));

// API routes
server.use('/api', require('./api'));

server.get('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3978;

server.listen(port, () => {
    console.log(`Bot service listening at http://localhost:${port}`);
});