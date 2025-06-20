// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TeamsActivityHandler, MessageFactory } = require('botbuilder');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./utils/config.js');
const OpenAIService = require('./services/openaiService.js');
const ConversationService = require('./services/conversationService.js');
const ImageService = require('./services/imageService.js');
const MessageHandler = require('./handlers/messageHandler.js');
const AIAgentService = require('./services/aiAgentService.js');

class BotActivityHandler extends TeamsActivityHandler {
  constructor() {
    super();

    // Initialize services
    this.openaiService = new OpenAIService(CONFIG.OPENAI_API_KEY);
    this.conversationService = new ConversationService(CONFIG.MESSAGE_RETENTION_COUNT);
    this.imageService = new ImageService();

    // Initialize AI Agent Service for optimized token usage
    this.aiAgentService = new AIAgentService(this.openaiService);

    this.messageHandler = new MessageHandler(
      this.openaiService,
      this.conversationService,
      this.imageService,
      this,
      this.aiAgentService
    );

    // Load IntelliGate FAQ content and initialize AI Agent
    const intelligateContent = fs.readFileSync(
      path.join(__dirname, '../data/intelligate.md'),
      'utf8'
    );

    // Initialize the AI Agent with knowledge base
    this.aiAgentService.initialize(intelligateContent);

    // Load available images from the images directory
    this.availableImages = this.loadAvailableImages();

    // Register handlers
    this.onMessage(async (context, next) => {
      // Get the question/message text
      const messageText = context.activity.text || '';

      // Find relevant images for the question (up to 3)
      const imagePaths = await this.openaiService.findRelevantImages(messageText, this.availableImages, 3);

      console.log('Found image paths:', imagePaths);

      // Pass the image paths to the message handler (AI Agent will handle knowledge base optimization)
      await this.messageHandler.handleMessage(context, null, imagePaths);
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      console.log({
        teamId: context.activity.channelData?.team?.id,
        addedBy: context.activity.from.id
      }, 'BotAddedToTeam');

      var welcomeText = "Hello and welcome! I am your assistant for IntelliGate support. Please mention me with your query and I will do my best to help you. If I am unable to assist, I will notify our support team.";
      await context.sendActivity(MessageFactory.text(welcomeText));
      await next();
    });
  }

  // Load all available images from the images directory
  loadAvailableImages() {
    const imagesDir = path.join(__dirname, '../data/images');
    const imageMap = {};

    try {
      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);
        files.forEach(file => {
          if (/\.(jpg|jpeg|png|gif)$/i.test(file)) {
            // Use the filename without extension as the key
            const key = path.basename(file, path.extname(file)).toLowerCase();
            imageMap[key] = path.join(imagesDir, file);
          }
        });
      }
    } catch (error) {
      console.error('Error loading images:', error);
    }

    return imageMap;
  }

}

module.exports = { BotActivityHandler };
