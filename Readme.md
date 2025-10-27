# IntelliGate Support Bot

An enterprise-grade Microsoft Teams bot powered by OpenAI that delivers intelligent support for IntelliGate through an advanced AI agent system with RAG (Retrieval-Augmented Generation), multi-modal capabilities, and automated visualization.

## 🚀 Key Features

### AI-Powered Intelligence
- **Advanced GPT-4 Integration**: Leverages OpenAI's latest models for natural language understanding and generation
- **RAG (Retrieval-Augmented Generation)**: Semantic search through knowledge base with intelligent chunking
- **AI Agent Service**: Optimized token usage with context management and summarization - **Multi-Language Support**: Automatic language detection and translation for global teams
- **Spelling Correction**: Automatic correction of user queries for better accuracy
- **Intent Analysis**: Smart categorization of messages (QUESTION, ERROR, RELATED_STATEMENT, IGNORE)

### Visual Intelligence
- **GPT-4 Vision Integration**: Analyzes error screenshots and images with high accuracy
- **Intelligent Image Matching**: AI-powered relevant image retrieval based on user queries
- **Chart Generation**: Hybrid graphing system with automatic data extraction and visualization
  - Supports bar charts, line charts, and pie charts
  - Data-Forge primary engine with Vega fallback
  - AI-powered data extraction from natural language responses
  - Azure and local environment compatibility

### Context & Conversation Management
- **Smart Context Optimization**: Reduces token usage by 70%+ through intelligent summarization
- **Conversation History**: Maintains up to 20 messages per conversation with automatic cleanup
- **Multi-Conversation Support**: Handles concurrent conversations across different channels
- **Conversation Summarization**: Automatically summarizes old messages to preserve context while minimizing tokens
- **24-Hour Retention**: Automatic cleanup of inactive conversations

### Enterprise Features
- **Support Team Integration**: Automatic escalation with @mentions
- **Error Handling & Retry Logic**: Built-in resilience for network issues
- **Application Insights**: Comprehensive logging and monitoring
- **Azure App Service Ready**: Production-ready deployment configuration
- **Secure Authentication**: Bot Framework authentication with Microsoft App ID/Password

## 📋 Prerequisites

- **Node.js**: 20.x or later
- **Microsoft Teams**: Development environment or production Teams tenant
- **Azure Subscription**: For deployment and Application Insights
- **OpenAI API Key**: GPT-4 access recommended for vision capabilities
- **Bot Framework**: Registered bot with Microsoft Bot Framework

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following configuration:

```bash
# ===== Bot Framework Configuration =====
MicrosoftAppId=your_app_id
MicrosoftAppPassword=your_app_password

# ===== OpenAI Configuration =====
SECRET_OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini                    # or gpt-4o, gpt-4-turbo

# ===== Bot Behavior Configuration =====
MESSAGE_RETENTION_COUNT=20                   # Number of messages to retain per conversation
RESPONSE_DELAY_MIN=15000                     # Minimum response delay (ms)
RESPONSE_DELAY_MAX=20000                     # Maximum response delay (ms)

# ===== AI Temperature Settings =====
# Lower = more deterministic, Higher = more creative
LANGUAGE_DETECTION_TEMPERATURE=0.3           # Language detection accuracy
MESSAGE_INTENT_TEMPERATURE=0.5               # Intent classification
RESPONSE_TEMPERATURE=0.7                     # Response generation creativity
TRANSLATION_TEMPERATURE=0.3                  # Translation accuracy
COMPLETION_FREQUENCY_PENALTY=0.8             # Reduce repetition in responses
COMPLETION_PRESENCE_PENALTY=0.3              # Encourage topic diversity

# ===== Support Team Configuration =====
SUPPORT_USERS=John Doe:john@company.com,Jane Smith:jane@company.com
REPLY_TO=botname|assistant|support           # Names that trigger bot responses

# ===== Azure Configuration =====
APPINSIGHTS_INSTRUMENTATIONKEY=your_insights_key
WEBSITE_SITE_NAME=your_azure_site_name       # Set automatically on Azure
```

## 📁 Project Structure

```
Teams-bot/
├── server/
│   ├── index.js                          # Express server & static file serving
│   ├── api/
│   │   ├── index.js                      # API routes
│   │   └── botController.js              # Bot Framework adapter
│   ├── bot/
│   │   ├── botActivityHandler.js         # Main bot event handler
│   │   ├── handlers/
│   │   │   └── messageHandler.js         # Message processing orchestrator
│   │   ├── services/
│   │   │   ├── aiAgentService.js         # AI agent with RAG optimization
│   │   │   ├── openaiService.js          # OpenAI API integration
│   │   │   ├── ragService.js             # Knowledge base retrieval
│   │   │   ├── contextService.js         # Context optimization & summarization
│   │   │   ├── conversationService.js    # Conversation history management
│   │   │   ├── imageService.js           # Image processing & authentication
│   │   │   ├── hybridGraphService.js     # Hybrid chart generation
│   │   │   ├── dataForgeGraphService.js  # Data-Forge chart engine
│   │   │   └── vegaGraphService.js       # Vega chart fallback
│   │   └── utils/
│   │       └── config.js                 # Configuration management
│   ├── data/
│   │   ├── intelligate.md                # Knowledge base (markdown format)
│   │   ├── images/                       # Reference images for support
│   │   └── graphs/                       # Generated graph storage
│   └── wwwroot/
│       └── images/                       # Served images (Azure writable path)
├── appPackage/
│   ├── manifest.json                     # Teams app manifest
│   ├── color.png                         # App icon (color)
│   └── outline.png                       # App icon (outline)
├── infra/
│   ├── azure.bicep                       # Azure infrastructure as code
│   └── azure.parameters.json             # Deployment parameters
├── package.json
├── build.js                              # Build script for app package
├── teamsapp.yml                          # Teams Toolkit configuration
└── .env                                  # Environment variables (not in repo)
```

## 🏗️ Architecture

### System Overview

```
User Message → Bot Framework Adapter → Bot Activity Handler → Message Handler
                                                                      ↓
                                                          ┌──────────┴──────────┐
                                                          ↓                     ↓
                                                  AI Agent Service      Image Service
                                                          ↓                     ↓
                                              ┌───────────┴────────┐    Image Analysis
                                              ↓                    ↓
                                         RAG Service      Context Service
                                              ↓                    ↓
                                      Knowledge Retrieval   Conversation Summary
                                              ↓                    ↓
                                              └────────────┬────────┘
                                                           ↓
                                                   OpenAI Service
                                                           ↓
                                                      Response
                                                           ↓
                                                  Graph Service (if needed)
                                                           ↓
                                                   Final Response → User
```

### Component Details

#### 1. **BotActivityHandler** (`botActivityHandler.js`)
- Initializes all services on startup
- Loads knowledge base from markdown file
- Handles bot lifecycle events (message received, members added)
- Manages image library for relevant image matching
- Coordinates between message handler and services

#### 2. **MessageHandler** (`messageHandler.js`)
- **Message Processing Pipeline**:
  1. Validates user mentions and permissions
  2. Extracts text from images (if attached)
  3. Corrects spelling in user query
  4. Analyzes message intent
  5. Detects language
  6. Generates response via AI Agent
  7. Creates graphs if requested
  8. Sends response with attachments
- **Error Handling**: Automatic support team escalation
- **Image Attachments**: Supports multiple images per response

#### 3. **AIAgentService** (`aiAgentService.js`)
- **Core Optimization Engine**:
  - Retrieves only relevant knowledge chunks (vs entire knowledge base)
  - Optimizes conversation context (summarizes old + keeps recent)
  - Creates efficient system prompts
  - Logs token savings (typically 5000+ tokens saved per request)
- **Enhanced Features**:
  - Query analysis for better retrieval
  - Performance metrics tracking
  - Automatic initialization on startup

#### 4. **RAGService** (`ragService.js`)
- **Knowledge Base Management**:
  - Chunks knowledge base by markdown headers and paragraphs
  - Maximum chunk size: 500 characters
  - Semantic similarity search using keyword scoring
- **Retrieval Algorithm**:
  - Keyword matching with weighted scoring
  - Phrase match boosting
  - Returns top N most relevant chunks (default: 3)
- **Future Enhancement**: Embeddings-based search (prepared interface)

#### 5. **ContextService** (`contextService.js`)
- **Context Optimization**:
  - Keeps last 6 messages in full detail
  - Summarizes older messages (when > 10 messages)
  - Implements token-aware context limiting
- **Conversation Summarization**:
  - Creates 2-3 sentence summaries of old context
  - Caches summaries to avoid re-summarization
  - Focuses on key questions, topics, and ongoing issues
- **Token Management**:
  - Estimates token count (1 token ≈ 4 characters)
  - Enforces configurable token limits
  - Provides detailed logging of optimization

#### 6. **OpenAIService** (`openaiService.js`)
- **Language Operations**:
  - `detectLanguage()`: Identifies input language with low temperature
  - `translateText()`: Translates responses to user's language
  - `correctSpelling()`: Pre-processes queries for accuracy
- **AI Analysis**:
  - `analyzeIntent()`: Classifies messages (QUESTION/ERROR/RELATED_STATEMENT/IGNORE)
  - `analyzeImage()`: GPT-4 Vision for error screenshot analysis
  - `findRelevantImages()`: Matches user queries with available images
- **Graph Intelligence**:
  - `extractGraphDataWithAI()`: AI-powered data extraction from text
  - `canShowGraphically()`: Determines if data is suitable for visualization
  - `extractGraphData()`: Regex-based fallback for data extraction
- **Completion**:
  - `getCompletion()`: Main response generation with configurable temperature and penalties

#### 7. **HybridGraphService** (`hybridGraphService.js`)
- **Chart Generation Strategy**:
  - Primary: Data-Forge Plot (fast, font support)
  - Fallback: Vega/Vega-Lite (reliable, cloud-compatible)
  - 15-second timeout for primary method
- **Environment Handling**:
  - Detects Azure vs local environment
  - Finds writable directories dynamically
  - Falls back to in-memory buffers if needed
- **Supported Chart Types**: Bar, Line, Pie
- **Output Options**: File path, URL, or in-memory buffer

#### 8. **ConversationService** (`conversationService.js`)
- Maintains conversation history per conversation ID
- Automatic message retention (configurable, default: 20 messages)
- 24-hour conversation cleanup
- Thread-safe conversation management

#### 9. **ImageService** (`imageService.js`)
- **Robust Image Handling**:
  - Fetches images from Teams with bot authentication
  - 3 retry attempts with exponential backoff
  - Handles ECONNRESET and timeout errors
- **Token Management**: Secure credential retrieval from Bot Framework
- **Output**: Base64-encoded images for GPT-4 Vision

## 🚀 Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd Teams-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create `.env` file with all required variables (see Environment Variables section)

### 4. Set Up Knowledge Base
Place your knowledge base content in `server/data/intelligate.md` (markdown format)

### 5. Add Reference Images
Place support images in `server/data/images/` with descriptive filenames

### 6. Run Locally
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

Bot will be available at `http://localhost:3978`

### 7. Test with Bot Framework Emulator
- Download [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator)
- Connect to `http://localhost:3978/api/messages`
- Enter your App ID and Password

## ☁️ Azure Deployment

### Option 1: Azure CLI Deployment

```bash
# Login to Azure
az login

# Create resource group
az group create --name TeamsBotRG --location eastus

# Deploy infrastructure
az deployment group create \
  --resource-group TeamsBotRG \
  --template-file infra/azure.bicep \
  --parameters @infra/azure.parameters.json

# Deploy code
az webapp deployment source config-zip \
  --resource-group TeamsBotRG \
  --name <your-app-service-name> \
  --src <path-to-zip>
```

### Option 2: Teams Toolkit Deployment
```bash
# Using Teams Toolkit CLI
teamsfx provision
teamsfx deploy
teamsfx publish
```

### Post-Deployment Configuration
1. Set environment variables in Azure App Service → Configuration → Application Settings
2. Enable Application Insights for monitoring
3. Configure writable storage for graph generation
4. Update Teams app manifest with production endpoint

## 🔑 Key Capabilities

### 1. Natural Language Q&A
**Example Interactions:**
```
User: "How do I reset my password in IntelliGate?"
Bot: [Searches knowledge base, provides step-by-step instructions]

User: "¿Cómo puedo restablecer mi contraseña?"
Bot: [Detects Spanish, provides response in Spanish]
```

### 2. Error Screenshot Analysis
**Example:**
```
User: [Uploads screenshot] "Getting this error"
Bot: [Analyzes image using GPT-4 Vision]
     "I can see you're getting error code 403. This typically means..."
```

### 3. Visual Data Representation
**Example:**
```
User: "Show me detention costs by company"
Bot: [Response with data]
     [Automatically generates bar chart]
     📊 I've generated a professional chart to visualize this data:
     [Embedded chart image]
```

### 4. Intelligent Image Matching
**Example:**
```
User: "How to scan QR code?"
Bot: [Finds relevant images from library]
     "Here's how to scan QR codes in IntelliGate:"
     [Response with 2-3 relevant reference images attached]
```

### 5. Context-Aware Conversations
**Example:**
```
User: "How do I check in a driver?"
Bot: [Provides check-in instructions]

User: "What about check out?"
Bot: [Remembers context, provides checkout instructions without repeating background info]
```

### 6. Automatic Support Escalation
**Example:**
```
User: "The system is completely down!"
Bot: "Let me notify our support team."
     @JohnDoe @JaneSmith - Could you please help with this query?
```

## 📊 Performance Optimization

### Token Usage Optimization
The AI Agent Service implements aggressive token optimization:

- **Before Optimization**: ~8,000-12,000 tokens per request
  - Full knowledge base: 5,000+ tokens
  - Full conversation history: 3,000+ tokens
  - Query + system prompt: 1,000+ tokens

- **After Optimization**: ~1,500-3,000 tokens per request
  - Relevant chunks only: 500-1,000 tokens
  - Summarized context + recent messages: 500-1,500 tokens
  - Query + optimized prompt: 500 tokens

**Result**: 70%+ reduction in token usage, faster responses, lower costs

### Response Time
- Average response time: 2-5 seconds
- Image analysis: 3-7 seconds
- Graph generation: 1-3 seconds
- Total with visualization: 5-10 seconds

### Scalability
- Handles concurrent conversations across multiple channels
- Automatic memory cleanup prevents memory leaks
- Stateless design allows horizontal scaling
- Azure App Service auto-scaling compatible

## 🛠️ Configuration Guide

### Temperature Settings Explained
Temperature controls randomness in AI responses (0.0 = deterministic, 2.0 = very creative):

- **LANGUAGE_DETECTION_TEMPERATURE (0.3)**: Low for accurate language identification
- **MESSAGE_INTENT_TEMPERATURE (0.5)**: Medium for consistent intent classification
- **RESPONSE_TEMPERATURE (0.7)**: Higher for natural, conversational responses
- **TRANSLATION_TEMPERATURE (0.3)**: Low for accurate translations

### Penalty Settings
- **COMPLETION_FREQUENCY_PENALTY (0.8)**: Reduces repetitive phrases (0.0-2.0)
- **COMPLETION_PRESENCE_PENALTY (0.3)**: Encourages topic diversity (0.0-2.0)

### Message Retention
- **MESSAGE_RETENTION_COUNT (20)**: Number of messages kept per conversation
- Increase for longer context (uses more tokens)
- Decrease for faster responses (less context)

### Support Configuration
```bash
# Format: Name:Email,Name:Email
SUPPORT_USERS=John Doe:john@company.com,Jane Smith:jane@company.com

# Users/keywords that trigger bot responses (case-insensitive)
REPLY_TO=intelligatebot|support|help
```

## 🧪 Testing

### Unit Testing
```bash
npm test
```

### Manual Testing Scenarios
1. **Basic Q&A**: Ask a question from knowledge base
2. **Multi-turn**: Follow-up questions to test context retention
3. **Image Upload**: Send error screenshot
4. **Multi-language**: Send question in Spanish/French
5. **Graph Request**: Ask for data in graphical format
6. **Error Handling**: Send unrelated query to test escalation
7. **Image Matching**: Request help with feature that has images

## 📈 Monitoring & Logging

### Application Insights Integration
The bot automatically logs:
- All incoming messages and activities
- Intent analysis results
- Token usage optimization metrics
- Error traces and exceptions
- Response times and performance metrics

### Log Examples
```
[AIAgentService] Token usage optimization:
  - Knowledge chunks: ~800 tokens (vs full KB which could be 5000+)
  - Context: ~600 tokens (4 messages)
  - Query: ~50 tokens
  - Total: ~1450 tokens
  - Estimated savings: ~3550 tokens per request

[RAGService] Found 3 relevant chunks for query: "password reset"

[ContextService] Optimized context: 12 old messages summarized, 6 recent messages kept
```

## 🐛 Troubleshooting

### Common Issues

**1. Bot not responding**
- Check `REPLY_TO` configuration includes bot name or keyword
- Verify bot is @mentioned in Teams channel
- Check Application Insights for errors

**2. Image analysis failing**
- Ensure using GPT-4 model with vision (gpt-4o, gpt-4o-mini, gpt-4-turbo)
- Check OpenAI API key has vision access
- Verify image URL is accessible

**3. Graphs not generating**
- Check writable directory permissions
- Review HybridGraphService logs for errors
- Verify Data-Forge and Vega dependencies installed
- Test with fallback in-memory mode

**4. High token usage**
- Reduce MESSAGE_RETENTION_COUNT
- Lower MAX_RECENT_MESSAGES in ContextService
- Reduce RAG chunk count in AIAgentService

**5. Support team not notified**
- Verify SUPPORT_USERS format: `Name:Email,Name:Email`
- Check user email addresses match Teams accounts
- Review error handling logs

## 🔐 Security Best Practices

1. **Never commit `.env` file** to version control
2. **Use Azure Key Vault** for production secrets
3. **Rotate API keys** regularly
4. **Restrict Bot Framework App ID** to specific tenants
5. **Enable Application Insights** for security monitoring
6. **Review conversation logs** for sensitive data leakage
7. **Implement rate limiting** for production environments

## 🚦 Development Workflow

```bash
# Start development server
npm run dev

# Build app package
npm run build

# Run linter
npm run lint

# Watch mode (auto-restart)
npm run watch
```

## 📚 API Reference

### Environment Detection
```javascript
const isAzure = process.env.WEBSITE_SITE_NAME !== undefined;
```

### Custom Service Integration
```javascript
// Example: Adding a new service
class CustomService {
  constructor(openaiService) {
    this.openaiService = openaiService;
  }
  
  async processRequest(query) {
    // Your logic here
  }
}

// In botActivityHandler.js
this.customService = new CustomService(this.openaiService);
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

MIT License - See LICENSE file for details

## 🙋 Support

For issues and questions:
- Create GitHub issue
- Contact support team (configured in SUPPORT_USERS)
- Review Application Insights logs

---

**Built with ❤️ using Microsoft Bot Framework, OpenAI GPT-4, and Azure**
