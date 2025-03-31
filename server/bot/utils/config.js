const SUPPORT_USERS = (process.env.SUPPORT_USERS || '').split(',').map(user => {
    const [name, email] = user.split(':');
    return { name, email };
});

const REPLY_TO = (process.env.REPLY_TO || '').split('|').map(name =>
    name.toLowerCase().replaceAll(' ', '')
);

const CONFIG = {
    MESSAGE_RETENTION_COUNT: parseInt(process.env.MESSAGE_RETENTION_COUNT || "20"),
    RESPONSE_DELAY_MIN: parseInt(process.env.RESPONSE_DELAY_MIN || "15000"),
    RESPONSE_DELAY_MAX: parseInt(process.env.RESPONSE_DELAY_MAX || "20000"),
    OPENAI_MODEL: process.env.OPENAI_MODEL || "chatgpt-4o-latest",
    LANGUAGE_DETECTION_TEMPERATURE: parseFloat(process.env.LANGUAGE_DETECTION_TEMPERATURE || "0.3"),
    MESSAGE_INTENT_TEMPERATURE: parseFloat(process.env.MESSAGE_INTENT_TEMPERATURE || "0.5"),
    RESPONSE_TEMPERATURE: parseFloat(process.env.RESPONSE_TEMPERATURE || "0.7"),
    TRANSLATION_TEMPERATURE: parseFloat(process.env.TRANSLATION_TEMPERATURE || "0.3"),
    COMPLETION_FREQUENCY_PENALTY: parseFloat(process.env.COMPLETION_FREQUENCY_PENALTY || "0.8"),
    COMPLETION_PRESENCE_PENALTY: parseFloat(process.env.COMPLETION_PRESENCE_PENALTY || "0.3"),
    OPENAI_API_KEY: process.env.SECRET_OPENAI_API_KEY,
    SUPPORT_USERS,
    REPLY_TO
};

module.exports = CONFIG; 