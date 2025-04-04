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

class BotActivityHandler extends TeamsActivityHandler {
  constructor() {
    super();

    // Initialize services
    this.openaiService = new OpenAIService(CONFIG.OPENAI_API_KEY);
    this.conversationService = new ConversationService(CONFIG.MESSAGE_RETENTION_COUNT);
    this.imageService = new ImageService();
    this.messageHandler = new MessageHandler(
      this.openaiService,
      this.conversationService,
      this.imageService,
      this
    );

    // Load IntelliGate FAQ content
    const intelligateContent = fs.readFileSync(
      path.join(__dirname, '../data/intelligate.md'),
      'utf8'
    );

    // Load available images from the images directory
    this.availableImages = this.loadAvailableImages();

    // Register handlers
    this.onMessage(async (context, next) => {
      // Get the question/message text
      const messageText = context.activity.text || '';

      // Find relevant images for the question (up to 3)
      const imagePaths = this.findRelevantImages(messageText, 3);

      console.log('Found image paths:', imagePaths);

      // Pass the image paths to the message handler
      await this.messageHandler.handleMessage(context, intelligateContent, imagePaths);
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

  // Find relevant images for the given question
  findRelevantImages(question, maxImages = 3) {
    if (!question) return [];

    // Convert question to lowercase for case-insensitive matching
    const lowerQuestion = question.toLowerCase();

    // Extract key topics from the question
    const topics = this.extractTopics(lowerQuestion);

    const matchedImages = [];

    // Try to find exact matches first
    for (const topic of topics) {
      if (this.availableImages[topic]) {
        matchedImages.push(this.availableImages[topic]);
        if (matchedImages.length >= maxImages) return matchedImages;
      }
    }

    // If we need more images, try partial matching
    for (const [imageName, imagePath] of Object.entries(this.availableImages)) {
      // Skip images we've already matched
      if (matchedImages.includes(imagePath)) continue;

      for (const topic of topics) {
        if (imageName.includes(topic) || topic.includes(imageName)) {
          matchedImages.push(imagePath);
          if (matchedImages.length >= maxImages) return matchedImages;
          break; // Move to next image after finding a match
        }
      }
    }

    return matchedImages;
  }

  // Extract potential topics from the question
  extractTopics(question) {
    // List of common topics from the knowledge base
    const knownTopics = [
      'qr code', 'qr', 'scan', 'license', 'licence', 'registration',
      'trailer', 'carrier', 'empty', 'loaded', 'bobtail', 'pickup',
      'shipment', 'error', 'check in', 'check out', 'yard', 'otp',
      'employee id', 'validator', 'app', 'application', 'blank screen',
      'overweight', 'seal', 'damaged', 'spotter'
    ];

    // Start with the whole question as a potential topic
    const topics = [question];

    // Add individual words as potential topics
    const words = question.split(/\s+/).filter(word => word.length > 3);
    topics.push(...words);

    // Check for known topics in the question
    for (const topic of knownTopics) {
      if (question.includes(topic)) {
        topics.push(topic);
      }
    }

    return topics;
  }

  // Create a message with text and image attachment

}

module.exports = { BotActivityHandler };
