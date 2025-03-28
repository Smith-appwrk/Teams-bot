const axios = require('axios');

class ImageService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    async retryOperation(operation) {
        let lastError;
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (error.message.includes('ECONNRESET') || error.message.includes('timeout')) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    async getToken(connectorClient) {
        return await this.retryOperation(async () => {
            try {
                if (connectorClient && connectorClient.credentials) {
                    const credentials = connectorClient.credentials;
                    const token = await credentials.getToken();
                    return token;
                }
                throw new Error('Unable to obtain token from connector client');
            } catch (err) {
                console.error({
                    type: 'TokenError',
                    error: err.message,
                    stack: err.stack,
                    timestamp: new Date().toISOString()
                });
                throw err;
            }
        });
    }

    async processImage(imageUrl, connectorClient) {
        return await this.retryOperation(async () => {
            const token = await this.getToken(connectorClient);
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            });
            return Buffer.from(response.data).toString('base64');
        });
    }
}

module.exports = ImageService; 