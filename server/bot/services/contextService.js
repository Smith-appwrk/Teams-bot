const CONFIG = require('../utils/config');

class ContextService {
    constructor(openaiService) {
        this.openaiService = openaiService;
        this.conversationSummaries = new Map();
        this.MAX_RECENT_MESSAGES = 6; // Keep last 6 messages in full
        this.SUMMARY_THRESHOLD = 10; // Summarize when more than 10 messages
    }

    async getOptimizedContext(conversationId, conversationHistory, userQuery) {
        try {
            if (!conversationHistory || conversationHistory.length === 0) {
                return [];
            }

            // If conversation is short, return as is
            if (conversationHistory.length <= this.MAX_RECENT_MESSAGES) {
                return conversationHistory.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content || "content not found"
                }));
            }

            // Split conversation into old and recent messages
            const recentMessages = conversationHistory.slice(-this.MAX_RECENT_MESSAGES);
            const oldMessages = conversationHistory.slice(0, -this.MAX_RECENT_MESSAGES);

            let contextMessages = [];

            // Add summarized context for old messages
            if (oldMessages.length > 0) {
                const summary = await this.getSummary(conversationId, oldMessages);
                if (summary) {
                    contextMessages.push({
                        role: 'system',
                        content: `Previous conversation summary: ${summary}`
                    });
                }
            }

            // Add recent messages in full
            const recentFormatted = recentMessages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content || "content not found"
            }));

            contextMessages.push(...recentFormatted);

            console.log(`[ContextService] Optimized context: ${oldMessages.length} old messages summarized, ${recentMessages.length} recent messages kept`);
            return contextMessages;

        } catch (error) {
            console.error('[ContextService] Error optimizing context:', error);
            // Fallback to recent messages only
            return conversationHistory.slice(-this.MAX_RECENT_MESSAGES).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content || "content not found"
            }));
        }
    }

    async getSummary(conversationId, messages) {
        try {
            // Check if we already have a summary for this conversation segment
            const summaryKey = `${conversationId}_${messages.length}`;
            if (this.conversationSummaries.has(summaryKey)) {
                return this.conversationSummaries.get(summaryKey);
            }

            // Create summary of old messages
            const messagesToSummarize = messages.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n');

            const summaryPrompt = `
Summarize the following conversation history in 2-3 sentences, focusing on:
1. Key questions asked by the user
2. Main topics discussed
3. Any important context or ongoing issues

Conversation:
${messagesToSummarize}

Keep the summary concise and focused on information that might be relevant for future responses.`;

            const completion = await this.openaiService.openai.chat.completions.create({
                model: CONFIG.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a conversation summarizer. Create concise, informative summaries."
                    },
                    { role: "user", content: summaryPrompt }
                ],
                temperature: 0.3,
                max_tokens: 150
            });

            const summary = completion.choices[0].message.content;

            // Cache the summary
            this.conversationSummaries.set(summaryKey, summary);

            // Clean up old summaries periodically
            this.cleanupOldSummaries();

            return summary;

        } catch (error) {
            console.error('[ContextService] Error creating summary:', error);
            return null;
        }
    }

    cleanupOldSummaries() {
        // Keep only recent summaries to prevent memory bloat
        if (this.conversationSummaries.size > 100) {
            const entries = Array.from(this.conversationSummaries.entries());
            const recentEntries = entries.slice(-50); // Keep last 50
            this.conversationSummaries.clear();
            recentEntries.forEach(([key, value]) => {
                this.conversationSummaries.set(key, value);
            });
        }
    }

    // Utility method to estimate token count (approximate)
    estimateTokenCount(text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        return Math.ceil(text.length / 4);
    }

    // Get context within token limits
    async getContextWithinTokenLimit(conversationId, conversationHistory, userQuery, maxTokens = 2000) {
        const optimizedContext = await this.getOptimizedContext(conversationId, conversationHistory, userQuery);

        let totalTokens = 0;
        const finalContext = [];

        // Add messages until we hit the token limit
        for (const message of optimizedContext.reverse()) {
            const messageTokens = this.estimateTokenCount(message.content);
            if (totalTokens + messageTokens > maxTokens && finalContext.length > 0) {
                break;
            }
            finalContext.unshift(message);
            totalTokens += messageTokens;
        }

        console.log(`[ContextService] Final context: ${finalContext.length} messages, ~${totalTokens} tokens`);
        return finalContext;
    }
}

module.exports = ContextService; 