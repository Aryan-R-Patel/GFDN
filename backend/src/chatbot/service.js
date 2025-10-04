import { GoogleGenerativeAI } from '@google/generative-ai';

class ChatbotService {
  constructor() {
    console.log('Initializing ChatbotService...');
    console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
    console.log('API Key length:', process.env.GEMINI_API_KEY?.length || 0);
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-flash which is available in your API key
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        maxOutputTokens: 1000,
      }
    });
    console.log('Using model: gemini-2.5-flash');
    
    // Memory storage for conversation history
    this.conversationMemory = new Map();
    this.maxMemoryLength = 10; // Keep last 10 exchanges per session
  }

  getSessionId(req) {
    // First try to use the session ID from the frontend
    const customSessionId = req.get('X-Session-ID');
    if (customSessionId) {
      return customSessionId;
    }
    
    // Fallback to IP + User Agent for session identification
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${ip}_${userAgent}`.substring(0, 50);
  }

  addToMemory(sessionId, userMessage, botResponse) {
    if (!this.conversationMemory.has(sessionId)) {
      this.conversationMemory.set(sessionId, []);
    }
    
    const memory = this.conversationMemory.get(sessionId);
    memory.push({
      user: userMessage,
      assistant: botResponse,
      timestamp: new Date().toISOString()
    });
    
    // Keep only the last N exchanges to prevent memory bloat
    if (memory.length > this.maxMemoryLength) {
      memory.shift();
    }
  }

  getConversationHistory(sessionId) {
    return this.conversationMemory.get(sessionId) || [];
  }

  formatConversationHistory(history) {
    if (history.length === 0) return '';
    
    return '\n\nPrevious conversation:\n' + 
      history.map(exchange => 
        `Human: ${exchange.user}\nAssistant: ${exchange.assistant}`
      ).join('\n') + '\n';
  }

  async generateResponse(userMessage, context = {}, sessionId = 'default') {
    try {
      console.log('Generating response for message:', userMessage);
      console.log('Session ID:', sessionId);
      
      const { metrics, recentTransactions, suggestions } = context;
      
      // Get conversation history for this session
      const history = this.getConversationHistory(sessionId);
      const conversationContext = this.formatConversationHistory(history);
      
      // Create a comprehensive prompt with context and memory
      const systemPrompt = `You are an AI Fraud Assistant for a Global Fraud Defense Network. You help analysts understand fraud patterns, optimize workflows, and analyze transactions.

IMPORTANT: You have memory of previous conversations with this user. Use this context to provide personalized responses and remember details they've shared (like their name, preferences, previous questions, etc.).

Current System Context:
${metrics ? `
Metrics Summary:
- Total Transactions: ${metrics.snapshot?.()?.totals?.total || 'N/A'}
- Approved: ${metrics.snapshot?.()?.totals?.approved || 'N/A'}
- Blocked: ${metrics.snapshot?.()?.totals?.blocked || 'N/A'}
- Average Risk Score: ${metrics.snapshot?.()?.risk?.averageScore || 'N/A'}
` : ''}

${recentTransactions ? `
Recent Transactions: ${recentTransactions.length} transactions
${recentTransactions.slice(0, 3).map(txn => 
  `- ${txn.transaction?.amount || 'Unknown'} ${txn.transaction?.currency || ''} from ${txn.transaction?.origin?.country || 'Unknown'} - Status: ${txn.decision?.status || 'Unknown'}`
).join('\n')}
` : ''}

${suggestions ? `
Current Suggestions: ${suggestions.length} active suggestions
${suggestions.slice(0, 2).map(s => `- ${s.priority}: ${s.title}`).join('\n')}
` : ''}

${conversationContext}

Please provide helpful, accurate responses about fraud detection, prevention strategies, workflow optimization, and transaction analysis. Remember details from our conversation and reference them when relevant. Keep responses concise but informative.`;

      const prompt = `${systemPrompt}

Current User Message: ${userMessage}

Please provide a helpful response:`;

      console.log('Sending request to Gemini API...');
      const result = await this.model.generateContent(prompt);
      console.log('Received response from Gemini API');
      
      const response = await result.response;
      const text = response.text();
      console.log('Response text length:', text.length);
      
      // Store this exchange in memory
      this.addToMemory(sessionId, userMessage, text);
      console.log(`Stored conversation in memory for session: ${sessionId}`);
      
      return text;
    } catch (error) {
      console.error('Detailed error generating chatbot response:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Provide a more helpful fallback response based on the user's question
      const fallbackResponse = this.getFallbackResponse(userMessage);
      
      // Still store the exchange in memory even for fallback responses
      this.addToMemory(sessionId, userMessage, fallbackResponse);
      
      return fallbackResponse;
    }
  }

  getFallbackResponse(userMessage) {
    if (userMessage.toLowerCase().includes('fraud')) {
      return `I understand you're asking about fraud detection. While I'm experiencing technical difficulties connecting to my AI service, I can share that effective fraud detection typically involves monitoring transaction patterns, velocity checks, geographic analysis, and anomaly detection. Would you like me to help analyze your current system metrics instead?`;
    } else if (userMessage.toLowerCase().includes('transaction')) {
      return `I see you're asking about transactions. Common fraud indicators include unusual transaction amounts, rapid-fire transactions from the same account, transactions from high-risk geographic locations, and deviations from normal spending patterns. Check your current workflow for these patterns.`;
    } else {
      return `I'm experiencing technical difficulties with my AI service right now, but I'm here to help with fraud detection and prevention. You can ask me about transaction analysis, workflow optimization, or fraud patterns. I'll do my best to provide helpful guidance based on your current system data.`;
    }
  }
}

export default new ChatbotService();