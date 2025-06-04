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

    async findRelevantImages(question, imagePaths, maxImages = 3) {
        if (!question || !imagePaths || imagePaths.length === 0) {
            return [];
        }

        // Extract just the filenames for better matching
        const imageFilenames = Object.keys(imagePaths).map(path => {
            return path.toLowerCase()
                .replace(/\.[^/.]+$/, "") // Remove extension
                .replace(/[_-]/g, " "); // Replace underscores/hyphens with spaces
        });

        // Create a prompt for the LLM to understand the task
        const prompt = `
You are an image matching assistant specialized in finding exact matches between questions and image descriptions.

Given a user's question and image filenames, return ONLY the indices of images that are EXACTLY relevant to the question.
Do not return partial matches or thematically similar images.

User question: "${question}"

Available image descriptions (indices start at 0):
${imageFilenames.map((name, i) => `${i}: ${name}`).join("\n")}

Return a JSON array containing ONLY the indices of perfectly matching images. Return [] if no exact matches found.

Example outputs:
- Perfect match: [2]
- Multiple matches: [1, 3] 
- No matches: []`;

        // Call OpenAI to get the relevant image indices
        const completion = await this.openai.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are a precise image matcher that only returns exact matches."
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.1, // Low temperature for consistent results
        });

        try {
            // Parse response and get matching image paths
            const responseContent = completion.choices[0].message.content;
            const indices = JSON.parse(responseContent);
            const selectedPaths = indices
                .map(i => imagePaths[Object.keys(imagePaths)[i]])
                .filter(path => path); // Remove any undefined entries

            return selectedPaths.slice(0, maxImages);
        } catch (error) {
            console.error("Error finding relevant images:", error);
            return [];
        }
    }

    async canShowGraphically(question, data) {
        if (!question || !data) {
            return { canGraph: false };
        }

        // Pre-analyze data to see if it contains numerical values that could be graphed
        const hasNumericalData = this._hasGraphableData(data);
        if (!hasNumericalData) {
            return { canGraph: false, reason: "Data does not contain numerical values suitable for graphing" };
        }

        const prompt = `
Analyze if the following data should be displayed as a graph.
Return a valid JSON object with:
- canGraph: boolean (true if data can be displayed as a graph, false otherwise)
- graphType: "bar" | "line" | "pie" (only if canGraph is true)
- reason: string explaining your decision

The data is graphable if:
- It contains numeric values that can be compared or tracked
- The question is asking for a comparison, trend, or distribution
- Visualization would enhance understanding

Question: "${question}"
Data:
${JSON.stringify(data)}

Return ONLY a valid JSON object like:
{
  "canGraph": true,
  "graphType": "bar",
  "reason": "Data contains numeric values that can be compared"
}`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: CONFIG.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a data visualization expert. Your job is to determine if data can be meaningfully displayed as a graph and what type of graph would be most appropriate."
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            const responseContent = completion.choices[0].message.content;
            const parsedResponse = JSON.parse(responseContent);
            
            // Validate the response format
            if (typeof parsedResponse.canGraph !== 'boolean') {
                console.warn("Invalid response format - canGraph is not a boolean:", responseContent);
                return this._analyzeDataFallback(data);
            }
            
            return parsedResponse;
        } catch (error) {
            console.error("Error in graph analysis:", error);
            return this._analyzeDataFallback(data);
        }
    }

    // Helper method to check if data contains numerical values suitable for graphing
    _hasGraphableData(data) {
        if (Array.isArray(data)) {
            // For arrays, check if elements contain numeric properties
            return data.some(item => {
                if (typeof item === 'object') {
                    return Object.values(item).some(val => typeof val === 'number');
                }
                return typeof item === 'number';
            });
        } else if (typeof data === 'object') {
            // For objects, check if values are numeric
            return Object.values(data).some(val => {
                if (typeof val === 'number') return true;
                if (Array.isArray(val)) return val.some(v => typeof v === 'number');
                return false;
            });
        }
        return false;
    }
    
    // Fallback analysis when API call or parsing fails
    _analyzeDataFallback(data) {
        let canGraph = false;
        let graphType = null;
        let reason = "Unable to determine if data is graphable";
        
        // Simple heuristic analysis
        if (Array.isArray(data) && data.length >= 2) {
            const hasNumericValues = data.some(item => {
                if (typeof item === 'number') return true;
                if (typeof item === 'object') {
                    return Object.values(item).some(v => typeof v === 'number');
                }
                return false;
            });
            
            if (hasNumericValues) {
                canGraph = true;
                graphType = "bar"; // Default to bar chart
                reason = "Data contains multiple items with numeric values";
            }
        }
        
        return { canGraph, graphType, reason };
    }

    extractGraphData(text) {
        console.log('Extracting graph data from text:', text);

        // Enhanced regex patterns for better data extraction
        const patterns = {
            // Pattern for "Label - Value USD" or "Label: Value USD"
            labelValueUSD: /([A-Za-z\s&]+?)\s*[-:]\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(USD|dollars?)/gi,
            // Pattern for "Label Value USD" (space separated)
            labelSpaceValueUSD: /([A-Za-z\s&]+?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*(USD|dollars?)/gi,
            // Pattern for "Label - Value" or "Label: Value" (general)
            labelValue: /([A-Za-z\s&]+?)\s*[-:]\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(%|units?|pieces?)?/gi,
            // Pattern for standalone numbers
            numbers: /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g,
            // Pattern for currency values
            currency: /\$?\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?)?/gi
        };

        const matches = [];
        let match;

        // Special handling for the detention cost format - check this first
        const lines = text.split('\n').filter(line => line.trim());
        for (const line of lines) {
            // Pattern for lines that contain company names followed by bars and numbers
            if (line.includes('█') || (line.match(/[A-Za-z]/) && line.match(/\d+\s*USD/i))) {
                // Extract company name (everything before the bars or large spaces)
                const nameMatch = line.match(/^([A-Za-z\s&]+?)(?:\s{3,}|█)/);
                // Extract value and unit
                const valueMatch = line.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(USD|dollars?)/i);

                if (nameMatch && valueMatch && !line.toLowerCase().includes('total')) {
                    const value = parseFloat(valueMatch[1].replace(/,/g, ''));
                    if (!isNaN(value)) {
                        matches.push({
                            label: nameMatch[1].trim(),
                            value: value,
                            unit: valueMatch[2] || 'USD'
                        });
                    }
                }
            }
        }

        // If we found matches from the detention format, use them
        if (matches.length > 0) {
            console.log('Extracted matches from detention format:', matches);
            return {
                labels: matches.map(m => m.label),
                data: matches.map(m => m.value),
                units: matches.map(m => m.unit)
            };
        }

        // First try to extract USD values specifically
        const textCopy1 = text.slice(); // Create a copy for regex
        while ((match = patterns.labelValueUSD.exec(textCopy1)) !== null) {
            const value = parseFloat(match[2].replace(/,/g, ''));
            if (!isNaN(value)) {
                matches.push({
                    label: match[1].trim(),
                    value: value,
                    unit: match[3] || 'USD'
                });
            }
        }

        // If no USD matches, try space-separated format
        if (matches.length === 0) {
            const textCopy2 = text.slice();
            while ((match = patterns.labelSpaceValueUSD.exec(textCopy2)) !== null) {
                const value = parseFloat(match[2].replace(/,/g, ''));
                if (!isNaN(value)) {
                    matches.push({
                        label: match[1].trim(),
                        value: value,
                        unit: match[3] || 'USD'
                    });
                }
            }
        }

        // If still no matches, try general label-value pairs
        if (matches.length === 0) {
            const textCopy3 = text.slice();
            while ((match = patterns.labelValue.exec(textCopy3)) !== null) {
                const value = parseFloat(match[2].replace(/,/g, ''));
                if (!isNaN(value)) {
                    matches.push({
                        label: match[1].trim(),
                        value: value,
                        unit: match[3] || ''
                    });
                }
            }
        }

        console.log('Extracted matches:', matches);

        if (matches.length > 0) {
            return {
                labels: matches.map(m => m.label),
                data: matches.map(m => m.value),
                units: matches.map(m => m.unit)
            };
        }

        // Fallback to simple number extraction
        const numbers = text.match(patterns.numbers)?.map(num => parseFloat(num.replace(/,/g, ''))) || [];
        const fallbackLines = text.split('\n').filter(line => line.trim());
        const labels = fallbackLines.slice(0, numbers.length).map(line =>
            line.replace(/\d+.*/, '').replace(/[█\s]+/g, '').trim()
        ).filter(label => label.length > 0);

        console.log('Fallback - Numbers:', numbers);
        console.log('Fallback - Labels:', labels);

        if (numbers.length === 0 || labels.length === 0) {
            return null;
        }

        return {
            labels: labels.slice(0, numbers.length),
            data: numbers.slice(0, labels.length),
            units: []
        };
    }

    async extractGraphDataWithAI(text, question = '') {
        try {
            console.log('Using OpenAI to extract graph data from:', text);

            const prompt = `
Extract data from the following text that can be used to create a graph/chart.

Text: "${text}"
Question context: "${question}"

Please analyze the text and extract:
1. Labels/categories (company names, time periods, etc.)
2. Numerical values associated with each label
3. Units (USD, %, etc.)

Return a JSON object with this exact structure:
{
  "labels": ["Label1", "Label2", "Label3"],
  "data": [value1, value2, value3],
  "units": ["unit1", "unit2", "unit3"],
  "title": "Suggested chart title",
  "chartType": "bar" | "pie" | "line"
}

Rules:
- Only include data that has both a clear label and numerical value
- Exclude totals, summaries, or aggregate values
- Clean up label names (remove extra spaces, formatting characters)
- Convert all numbers to numeric values (remove commas, currency symbols)
- Suggest the most appropriate chart type for the data
- If no graphable data is found, return {"labels": [], "data": [], "units": []}

Example:
Text: "Sales by Region: North 1,500 USD, South 2,300 USD, East 1,800 USD"
Output: {
  "labels": ["North", "South", "East"],
  "data": [1500, 2300, 1800],
  "units": ["USD", "USD", "USD"],
  "title": "Sales by Region",
  "chartType": "bar"
}`;

            const completion = await this.openai.chat.completions.create({
                model: CONFIG.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a data extraction specialist. Extract structured data for chart creation. Always return valid JSON."
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 1000
            });

            const response = completion.choices[0].message.content;
            console.log('OpenAI extraction response:', response);

            // Parse the JSON response
            const extractedData = JSON.parse(response);

            // Validate the extracted data
            if (extractedData.labels && extractedData.data &&
                extractedData.labels.length > 0 && extractedData.data.length > 0 &&
                extractedData.labels.length === extractedData.data.length) {

                console.log('Successfully extracted data with AI:', extractedData);
                return extractedData;
            } else {
                console.log('AI extraction returned invalid data structure');
                return null;
            }

        } catch (error) {
            console.error('Error extracting graph data with AI:', error);
            return null;
        }
    }
}

module.exports = OpenAIService;