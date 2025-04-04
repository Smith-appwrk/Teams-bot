const { OpenAI } = require('openai');
const CONFIG = require('../utils/config');

class OpenAIService {
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
    }

    async detectLanguage(text) {
        const languageDetection = await this.openai.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "Detect the language of the following text and respond with the language code only (e.g., 'en' for English, 'es' for Spanish, etc.)"
                },
                { role: "user", content: text }
            ],
            temperature: CONFIG.LANGUAGE_DETECTION_TEMPERATURE,
        });

        return languageDetection.choices[0].message.content.toLowerCase();
    }

    async analyzeIntent(message) {
        const intentAnalysis = await this.openai.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "Analyze if the given message is a question or error or RELATED_STATEMENT or can be ignored. Respond with exactly: QUESTION, ERROR, RELATED_STATEMENT or IGNORE. Examples: 'How do I...' -> QUESTION, 'I'm getting error...' -> ERROR, 'Any info regarding warehouse checkin checkout yard, validator, containg PIN, password etc' ->  RELATED_STATEMENT, 'Good morning, any general convo that seams is not asked or given to bot just some people interacting with each other' -> IGNORE"
                },
                { role: "user", content: message }
            ],
            temperature: CONFIG.MESSAGE_INTENT_TEMPERATURE,
        });

        return intentAnalysis.choices[0].message.content;
    }

    async getCompletion(messages) {
        const completion = await this.openai.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages,
            temperature: CONFIG.RESPONSE_TEMPERATURE,  // Controls randomness (lower = more predictable)
            frequency_penalty: CONFIG.COMPLETION_FREQUENCY_PENALTY,  // Discourages repetition
            presence_penalty: CONFIG.COMPLETION_PRESENCE_PENALTY
        });

        return completion.choices[0].message.content;
    }

    async translateText(text, targetLanguage) {
        const translation = await this.openai.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: `Translate the following text to ${targetLanguage}`
                },
                { role: "user", content: text }
            ],
            temperature: CONFIG.TRANSLATION_TEMPERATURE,
        });

        return translation.choices[0].message.content;
    }

    async analyzeImage(base64Image, prompt) {
        const visionResponse = await this.openai.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
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

        return visionResponse.choices[0].message.content;
    }
}

module.exports = OpenAIService; 