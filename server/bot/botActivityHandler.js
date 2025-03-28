// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TeamsActivityHandler } = require('botbuilder');
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
      this.imageService
    );

    // Load IntelliGate FAQ content
    const intelligateContent = fs.readFileSync(
      path.join(__dirname, '../data/intelligate.md'),
      'utf8'
    );

    // Register handlers
    this.onMessage(async (context, next) => {
      await this.messageHandler.handleMessage(context, intelligateContent);
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
}

module.exports = { BotActivityHandler };
