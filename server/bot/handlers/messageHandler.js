const { MessageFactory, TurnContext } = require('botbuilder');

class MessageHandler {
    constructor(openaiService, conversationService, imageService) {
        this.openaiService = openaiService;
        this.conversationService = conversationService;
        this.imageService = imageService;
        this.REPLY_TO = (process.env.REPLY_TO || '').split('|').map(name =>
            name.toLowerCase().replaceAll(' ', '')
        );
        this.SUPPORT_USERS = (process.env.SUPPORT_USERS || '').split(',').map(user => {
            const [name, email] = user.split(':');
            return { name, email };
        });
    }

    async handleMessage(context, intelligateContent) {
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
            await this.generateAndSendResponse(context, userQuery, detectedLanguage, intelligateContent);
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

    async generateAndSendResponse(context, userQuery, detectedLanguage, intelligateContent) {
        const conversationMessages = this.conversationService.getConversationHistory(context.activity.conversation.id);
        const formattedHistory = conversationMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content || "content not found"
        }));

        const response = await this.openaiService.getCompletion([
            {
                role: "system",
                content: `You are an IntelliGate support assistant. Use only the following knowledge base to answer questions. If the detected language is not English, translate your response to ${detectedLanguage}.

For each response:
1. Vary your response format - sometimes use bullet points, sometimes paragraphs, sometimes numbered lists, sometimes a mix
2. Vary your response length - sometimes be concise, sometimes more detailed
3. Vary your tone - sometimes be more formal, sometimes more conversational
4. Vary your vocabulary and sentence structure
5. Personalize your responses based on the user's query
6. Never repeat the exact same phrasing from previous responses

Do not copy text directly from the knowledge base. Always rewrite information in your own words.

Knowledge base:
${intelligateContent}

If you cannot find a relevant answer in the knowledge base, respond with exactly: NO_ANSWER`
            },
            ...(formattedHistory ? formattedHistory : [{ role: "user", content: userQuery }]),
            { role: "user", content: userQuery }
        ]);

        if (response === 'NO_ANSWER') {
            const translatedError = detectedLanguage !== 'en' ?
                await this.openaiService.translateText("I don't have information about that in my knowledge base. Let me notify our support team.", detectedLanguage) :
                null;
            await this.handleErrorResponse(context, null, true, translatedError);
        } else {
            await this.sendMentionResponse(context, response);
        }

        this.conversationService.addMessageToHistory(context.activity.conversation.id, {
            role: 'assistant',
            content: response,
            timestamp: Date.now()
        });
    }

    async sendMentionResponse(context, response) {
        const activity = MessageFactory.text("");
        activity.entities = [{
            "type": "mention",
            "text": `<at>${context.activity.from.name}</at>`,
            "mentioned": {
                "id": context.activity.from.id,
                "name": context.activity.from.name
            }
        }];

        activity.text = `${activity.entities[0].text} ${response}`;
        await context.sendActivity(activity);
    }

    async handleErrorResponse(context, error, isNoAnswer = false, translatedMessage = null) {
        console.error({
            type: 'ErrorResponse',
            isNoAnswer,
            error: error?.message,
            stack: error?.stack,
            from: context.activity.from.name,
            timestamp: new Date().toISOString()
        });

        const errorMsg = isNoAnswer ?
            (translatedMessage || "I don't have information about that in my knowledge base. Let me notify our support team.") :
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

        activity.text += `${activity.entities.map((entity) => entity.text)} - Could you please help with this query?`;
        await context.sendActivity(activity);

        this.conversationService.addMessageToHistory(context.activity.conversation.id, {
            role: 'assistant',
            content: errorMsg,
            timestamp: Date.now()
        });
    }
}

module.exports = MessageHandler; 