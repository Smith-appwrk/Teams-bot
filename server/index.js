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
server.use('/api', require('./api'));

server.get('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3978;

server.listen(port, () => {
    console.log(`Bot service listening at http://localhost:${port}`);
});