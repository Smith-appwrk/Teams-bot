# IntelliGate Support Bot

A Teams bot powered by OpenAI that provides intelligent support for IntelliGate using a knowledge base system.

## Features

- 🤖 AI-powered responses using OpenAI GPT models
- 🌐 Multi-language support with automatic language detection
- 📸 Image analysis capabilities for error screenshots
- 💬 Conversation history management
- 🔄 Automatic support team escalation
- ⚡ Retry mechanism for handling network issues
- 🎯 Intent analysis for message categorization

## Prerequisites

- Node.js 20.x or later
- Microsoft Teams development environment
- Azure subscription
- OpenAI API key

## Environment Variables

```
# OpenAI Configuration
SECRET_OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Bot Configuration
MESSAGE_RETENTION_COUNT=20
RESPONSE_DELAY_MIN=15000
RESPONSE_DELAY_MAX=20000

# Temperature Settings
LANGUAGE_DETECTION_TEMPERATURE=0.3
MESSAGE_INTENT_TEMPERATURE=0.5
RESPONSE_TEMPERATURE=0.7
TRANSLATION_TEMPERATURE=0.3

# Support Configuration
SUPPORT_USERS=name1:email1@domain.com,name2:email2@domain.com
REPLY_TO=user1|user2|user3
```

## Project Structure

```
server/
├── bot/
│   ├── botActivityHandler.js    # Main bot handler
│   ├── handlers/
│   │   └── messageHandler.js    # Message processing logic
│   ├── services/
│   │   ├── openaiService.js     # OpenAI integration
│   │   ├── conversationService.js # Conversation management
│   │   └── imageService.js      # Image processing
│   └── utils/
│       └── config.js           # Configuration management
└── data/
    └── intelligate.md         # Knowledge base content
```

## Installation

1. Clone the repository
2. Install dependencies:

```
npm install
```

3. Set up environment variables in a `.env` file
4. Start the development server:

```
npm run dev
```

## Deployment

The project is configured for automatic deployment to Azure Web Apps using GitHub Actions. The workflow includes:

- Automatic builds on push to main branch
- Node.js 20.x environment setup
- Production optimization
- Azure Web App deployment

## Key Components

### Bot Activity Handler

Main bot controller that initializes services and handles basic bot events.

### Message Handler

Processes incoming messages, manages conversation flow, and coordinates responses.

### Services

- **OpenAI Service**: Handles all AI-related operations including language detection, intent analysis, and response generation
- **Conversation Service**: Manages conversation history and cleanup
- **Image Service**: Processes and analyzes images with retry mechanism

## Error Handling

The system includes comprehensive error handling with:

- Automatic retries for network issues
- Support team escalation for unhandled errors
- Logging for debugging and monitoring
- Graceful degradation
