const { MessageFactory, TurnContext } = require('botbuilder');
const fs = require('fs');
const path = require('path');

// Import Hybrid graph service (tries Data-Forge first, falls back to Vega)
const HybridGraphService = require('../services/hybridGraphService');

class MessageHandler {
    constructor(openaiService, conversationService, imageService, botActivityHandler, aiAgentService) {
        this.openaiService = openaiService;
        this.conversationService = conversationService;
        this.imageService = imageService;
        this.botActivityHandler = botActivityHandler;
        this.aiAgentService = aiAgentService;
        // Initialize Hybrid graph service
        this.graphService = new HybridGraphService();
        this.REPLY_TO = (process.env.REPLY_TO || '').split('|').map(name =>
            name.toLowerCase().replaceAll(' ', '')
        );
        this.SUPPORT_USERS = (process.env.SUPPORT_USERS || '').split(',').map(user => {
            const [name, email] = user.split(':');
            return { name, email };
        });
    }

    async handleMessage(context, intelligateContent, imagePaths) {
        console.log({
            type: 'MessageReceived',
            from: context.activity.from.name,
            text: context.activity.text,
            timestamp: new Date().toISOString()
        });

        const isMentioned = context.activity.entities?.some(entity =>
            entity.type === 'mention' &&
            entity.mentioned.id === context.activity.recipient.id
        );

        if (!this.REPLY_TO.includes(context.activity.from.name.toLowerCase().replaceAll(' ', '')) && !isMentioned) {
            return;
        }

        const removedMentionText = TurnContext.removeRecipientMention(context.activity);
        const message = removedMentionText || context.activity.text;

        this.conversationService.addMessageToHistory(context.activity.conversation.id, {
            role: 'user',
            name: context.activity.from.name,
            content: message,
            timestamp: Date.now()
        });

        try {
            const userQuery = await this.processUserInput(context, message);
            if (!userQuery) return;

            await context.sendActivity({ type: 'typing' });

            const detectedLanguage = await this.openaiService.detectLanguage(userQuery);
            await this.generateAndSendResponse(context, userQuery, detectedLanguage, imagePaths);

        } catch (error) {
            console.error({
                type: 'Error',
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            await this.handleErrorResponse(context, error);
        }

        this.conversationService.cleanupOldConversations();
    }

    async processUserInput(context, message) {
        // Correct spelling before further processing
        message = await this.openaiService.correctSpelling(message);
        if (context.activity.attachments?.length > 0 &&
            context.activity.attachments[0].contentType.startsWith('image/')) {
            const imageUrl = context.activity.attachments[0].contentUrl;
            const connectorClient = context.turnState.get(context.adapter.ConnectorClientKey);
            const base64Image = await this.imageService.processImage(imageUrl, connectorClient);
            const textFromImage = await this.openaiService.analyzeImage(base64Image, "Please extract and return: 1) The exact question being asked in the form, and 2) Any error message shown. Format as: Question: [question text] Error: [error message]");

            message += '\n\n' + textFromImage;
        }

        const messageIntent = await this.openaiService.analyzeIntent(message);
        const isMentioned = context.activity.entities?.some(entity =>
            entity.type === 'mention' &&
            entity.mentioned.id === context.activity.recipient.id
        );

        if (messageIntent === 'IGNORE' && !isMentioned) {
            return null;
        }

        return message;
    }

    isGraphRequest(text) {
        const graphKeywords = [
            'graph', 'chart', 'plot', 'visual', 'graphical', 'visualization',
            'breakdown', 'distribution', 'show this in graphical format',
            'bar chart', 'pie chart', 'line chart', 'diagram'
        ];
        return graphKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    async processGraphRequest(userQuery, response) {
        console.log('Processing graph request for:', userQuery);

        // First try AI-powered extraction
        let graphData = await this.openaiService.extractGraphDataWithAI(response, userQuery);

        // Fallback to regex extraction if AI fails
        if (!graphData || !graphData.data || graphData.data.length === 0) {
            console.log('AI extraction failed, falling back to regex extraction');
            graphData = this.openaiService.extractGraphData(response);
        }

        // If still no graphable data, return without a graph
        if (!graphData || !graphData.data || graphData.data.length === 0) {
            return {
                response: response,
                graphPath: null
            };
        }

        console.log('Extracted graph data:', JSON.stringify(graphData));

        // For data that's already been structured for graphing, we can skip analysis
        // and directly use it (since extractGraphDataWithAI already determined it's graphable)
        let chartType = graphData.chartType || 'bar';

        // Use the existing graph data since it's already been processed and determined to be graphable
        // No need to check canGraph as the extraction already verified this data is suitable
        console.log('Using chartType:', chartType);

        // Use AI-suggested title if available, otherwise create one
        const title = graphData.title ||
            (userQuery.length > 50 ? userQuery.substring(0, 47) + '...' : userQuery);

        try {
            const graphResult = await this.graphService.generateGraph(
                graphData,
                chartType,
                title
            );

            console.log('Generated graph result:', graphResult);

            if (!graphResult) {
                return {
                    response: response + "\n\n📊 I apologize, but I encountered an error while generating the graph.",
                    graphPath: null
                };
            }

            // Handle URL-based graph results (from static file approach)
            if (graphResult && typeof graphResult === 'object' && graphResult.url) {
                return {
                    response: response + "\n\n📊 I've generated a professional chart to visualize this data:",
                    graphUrl: graphResult.url,
                    graphPath: graphResult.filepath // Keep for backward compatibility
                };
            }

            // Handle traditional file path or buffer results
            return {
                response: response + "\n\n📊 I've generated a professional chart to visualize this data:",
                graphPath: graphResult
            };
        } catch (error) {
            console.error('Error generating graph:', error);
            return {
                response: response + "\n\n📊 I apologize, but I encountered an error while generating the graph.",
                graphPath: null
            };
        }
    }

    async generateAndSendResponse(context, userQuery, detectedLanguage, imagePaths) {
        const conversationMessages = this.conversationService.getConversationHistory(context.activity.conversation.id);
        const conversationId = context.activity.conversation.id;

        // Use AI Agent for optimized response generation
        const response = await this.aiAgentService.generateResponse(
            conversationId,
            conversationMessages,
            userQuery,
            detectedLanguage
        );

        if (response === 'NO_ANSWER') {
            const translatedError = detectedLanguage !== 'en' ?
                await this.openaiService.translateText("I don't have information about that in my knowledge base. Let me notify our support team.", detectedLanguage) :
                null;
            await this.handleErrorResponse(context, null, true, translatedError, false, imagePaths);
        } else if (response === 'NEED_SUPPORT') {
            await this.handleErrorResponse(context, null, false, null, true, imagePaths);
        } else {
            let finalResponse = response;
            let graphPathOrUrl = null;

            // Check if user wants a graph
            // if (this.isGraphRequest(userQuery)) {
            //     const graphResult = await this.processGraphRequest(userQuery, response);
            //     finalResponse = graphResult.response;
            //     graphPathOrUrl = graphResult.graphPath || graphResult.graphUrl;
            // }

            await this.createAndSendResponse(context, finalResponse, graphPathOrUrl, false, imagePaths);
        }

        this.conversationService.addMessageToHistory(context.activity.conversation.id, {
            role: 'assistant',
            content: response,
            timestamp: Date.now()
        });
    }

    async createAndSendResponse(context, response, graphPathOrUrl, isImage = false, relevantImages = []) {
        const activity = { type: 'message' };

        if (isImage) {
            // Just send the image directly
            if (typeof graphPathOrUrl === 'string') {
                // Check if it's a URL or a file path
                if (graphPathOrUrl.startsWith('http')) {
                    // It's a URL
                    activity.attachments = [{
                        contentType: 'image/png',
                        contentUrl: graphPathOrUrl,
                        name: 'chart.png'
                    }];
                } else if (fs.existsSync(graphPathOrUrl)) {
                    // It's a file path
                    const base64Image = fs.readFileSync(graphPathOrUrl, { encoding: 'base64' });
                    activity.attachments = [{
                        contentType: 'image/png',
                        contentUrl: `data:image/png;base64,${base64Image}`,
                        name: 'image.png'
                    }];
                }
            } else if (graphPathOrUrl && graphPathOrUrl.isBuffer && graphPathOrUrl.buffer) {
                // It's a buffer
                const base64Image = graphPathOrUrl.buffer.toString('base64');
                activity.attachments = [{
                    contentType: 'image/png',
                    contentUrl: `data:image/png;base64,${base64Image}`,
                    name: 'image.png'
                }];
            } else {
                activity.text = "Sorry, I couldn't generate the image.";
            }
        } else {
            // For normal responses
            activity.text = response;

            // Handle both graphs and relevant images
            let allImages = [];

            // Add chart/graph if present
            if (graphPathOrUrl) {
                if (typeof graphPathOrUrl === 'object' && graphPathOrUrl.graphUrl) {
                    // It's a result object with a URL
                    allImages.push(graphPathOrUrl.graphUrl);
                } else if (typeof graphPathOrUrl === 'object' && graphPathOrUrl.url) {
                    // It's a direct URL object from the service
                    allImages.push(graphPathOrUrl.url);
                } else {
                    // It's a traditional file path or buffer
                    allImages.push(graphPathOrUrl);
                }
            }

            // Add relevant images if present
            if (relevantImages && Array.isArray(relevantImages) && relevantImages.length > 0) {
                console.log('Adding relevant images to response:', relevantImages.length);
                allImages.push(...relevantImages);
            }

            const attachments = this.createAttachmentImages(allImages);
            if (attachments) {
                activity.attachments = attachments;
                console.log('Created attachments for images:', attachments.length);
            }
        }

        await context.sendActivity(activity);
    }

    createAttachmentImages(imagePaths) {
        if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
            return null;
        }

        const attachments = [];

        for (const imageItem of imagePaths) {
            try {
                let imageData;
                let fileName;
                let isUrl = false;

                // Handle URLs, file paths, and buffer objects
                if (typeof imageItem === 'string') {
                    // Check if it's a URL
                    if (imageItem.startsWith('http')) {
                        // Direct URL - use it as contentUrl
                        console.log('Using direct URL for image:', imageItem);
                        attachments.push({
                            contentType: 'image/png',
                            contentUrl: imageItem,
                            name: 'chart.png'
                        });
                        continue; // Skip the rest of the processing for this item
                    }

                    // It's a file path
                    if (!imageItem || !fs.existsSync(imageItem)) {
                        console.log('Image not found:', imageItem);
                        continue;
                    }
                    imageData = fs.readFileSync(imageItem);
                    fileName = path.basename(imageItem);
                } else if (imageItem && imageItem.isBuffer && imageItem.buffer) {
                    // It's a buffer object from in-memory generation
                    imageData = imageItem.buffer;
                    fileName = `chart_${Date.now()}.png`;
                    console.log('Using in-memory chart buffer in createAttachmentImages');
                } else {
                    console.log('Unsupported image item:', imageItem);
                    continue;
                }

                const base64Image = Buffer.from(imageData).toString('base64');
                const imageExtension = fileName.includes('.') ?
                    path.extname(fileName).substring(1).toLowerCase() : 'png';

                // Map common image extensions to MIME types
                const mimeTypes = {
                    'jpg': 'jpeg',
                    'jpeg': 'jpeg',
                    'png': 'png',
                    'gif': 'gif',
                    'webp': 'webp',
                    'bmp': 'bmp'
                };

                const mimeType = mimeTypes[imageExtension] || imageExtension;

                attachments.push({
                    contentType: `image/${mimeType}`,
                    contentUrl: `data:image/${mimeType};base64,${base64Image}`,
                    name: fileName,
                });

                console.log('Successfully created attachment for:', fileName);
            } catch (error) {
                console.error('Error creating attachment for image:', imageItem, error);
            }
        }

        return attachments.length > 0 ? attachments : null;
    }

    async handleErrorResponse(context, error, isNoAnswer = false, translatedMessage = null, needSupport = false, relevantImages = []) {
        console.error({
            type: 'ErrorResponse',
            isNoAnswer,
            error: error?.message,
            stack: error?.stack,
            from: context.activity.from.name,
            timestamp: new Date().toISOString()
        });

        const errorMsg = isNoAnswer ?
            (translatedMessage || "I do not have information about that in my knowledge base. Let me notify our support team.") : needSupport ? "Let me notify our support team." :
                "Sorry, I encountered an error processing your request. Let me notify our support team.";

        const activity = MessageFactory.text(`${errorMsg}\n\n`);
        activity.entities = this.SUPPORT_USERS.map((user) => ({
            "type": "mention",
            "text": `<at>${user.name}</at>`,
            "mentioned": {
                "id": user.email,
                "name": user.name
            }
        }));

        activity.text += `${activity.entities.map((entity) => entity.text)} - Could you please help with this query ?`;

        await context.sendActivity(activity);

        this.conversationService.addMessageToHistory(context.activity.conversation.id, {
            role: 'assistant',
            content: errorMsg,
            timestamp: Date.now()
        });
    }
}

module.exports = MessageHandler;