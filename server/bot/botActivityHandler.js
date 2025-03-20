// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TeamsActivityHandler, MessageFactory, TurnContext } = require('botbuilder');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Parse support users and reply to list from environment variables
const SUPPORT_USERS = (process.env.SUPPORT_USERS || '').split(',').map(user => {
  const [name, email] = user.split(':');
  return { name, email };
});

const REPLY_TO = (process.env.REPLY_TO || '').split(',');

class BotActivityHandler extends TeamsActivityHandler {
  constructor() {
    super();

    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Load IntelliGate FAQ content
    const intelligateContent = fs.readFileSync(
      path.join(__dirname, '../data/intelligate.md'),
      'utf8'
    );

    // Activity called when there's a message in channel
    this.onMessage(async (context, next) => {

      if (!REPLY_TO.includes(context.activity.from.name)) {
        return;
      }

      const removedMentionText = TurnContext.removeRecipientMention(context.activity);
      const message = removedMentionText || context.activity.text;

      try {
        let userQuery;

        // Check if message contains an image
        if (context.activity.attachments?.length > 0 &&
          context.activity.attachments[0].contentType.startsWith('image/')) {

          // Get image URL and auth token
          const imageUrl = context.activity.attachments[0].contentUrl;
          const connectorClient = context.turnState.get(context.adapter.ConnectorClientKey);
          const token = await this.getToken(connectorClient);

          // Download image with auth
          const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          const base64Image = Buffer.from(response.data).toString('base64');

          // Analyze image with Vision API
          const visionResponse = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Please extract and return: 1) The exact question being asked in the form, and 2) Any error message shown. Format as: Question: [question text] Error: [error message]"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Image}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          });

          userQuery = visionResponse.choices[0].message.content;
        } else {
          userQuery = message;
        }

        // Get response from knowledge base
        const completion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are an IntelliGate support assistant. Use only the following knowledge base to answer questions: \n\n${intelligateContent}\n\nIf you cannot find a relevant answer in the knowledge base, respond with exactly: NO_ANSWER`
            },
            { role: "user", content: userQuery }
          ],
          temperature: 0.7,
        });

        const response = completion.choices[0].message.content;

        if (response === 'NO_ANSWER') {
          await this.handleErrorResponse(context, null, true);
        } else {
          await context.sendActivity(MessageFactory.text(response));
        }
      } catch (error) {
        console.error('OpenAI API error:', error);
        await this.handleErrorResponse(context, error);
      }

      await next();
    });

    // Called when the bot is added to a team.
    this.onMembersAdded(async (context, next) => {
      var welcomeText = "Hello and welcome! I am your assistant for IntelliGate support. Please mention me with your query and I will do my best to help you. If I am unable to assist, I will notify our support team.";
      await context.sendActivity(MessageFactory.text(welcomeText));
      await next();
    });
  }

  async getToken(connectorClient) {
    try {
      if (connectorClient && connectorClient.credentials) {
        const credentials = connectorClient.credentials;
        const token = await credentials.getToken();
        return token;
      }
      throw new Error('Unable to obtain token from connector client');
    } catch (err) {
      console.error('Error getting token:', err);
      throw err;
    }
  }

  async handleErrorResponse(context, error, isNoAnswer = false) {

    const errorMsg = isNoAnswer ?
      "I don't have information about that in my knowledge base. Let me notify our support team." :
      "Sorry, I encountered an error processing your request. Let me notify our support team.";

    // Create activity with proper mention format
    const activity = MessageFactory.text(`${errorMsg}\n\n`);
    activity.entities = SUPPORT_USERS.map((user) => ({
      "type": "mention",
      "text": `<at>${new TextEncoder().encode(user.name)}</at>`,
      "mentioned": {
        "id": user.email,// User Principle Name
        "name": user.name
      }
    }));


    activity.text += `${activity.entities.map((entity) => entity.text)} - Could you please help with this query?`;

    // Add the query text after mentions

    await context.sendActivity(activity);
  }
}

module.exports.BotActivityHandler = BotActivityHandler;
