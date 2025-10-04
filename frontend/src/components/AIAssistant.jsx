import { useState, useRef, useEffect } from 'react';

export default function AIAssistant({ suggestions = [], metrics, transactions }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI Fraud Assistant powered by Gemini. I have memory of our conversation, so feel free to refer back to things we've discussed. Ask me about fraud patterns, workflow optimization, or transaction analysis.",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Generate a persistent session ID for this browser session
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('fraud-assistant-session');
    if (!id) {
      id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('fraud-assistant-session', id);
    }
    return id;
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId, // Send session ID for memory tracking
        },
        body: JSON.stringify({
          message: inputMessage,
          context: {
            metrics,
            recentTransactions: transactions.slice(-10),
            suggestions
          }
        }),
      });

      const data = await response.json();
      
      const botMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    // Reset messages to initial state
    setMessages([
      {
        id: 1,
        text: "Hello! I'm your AI Fraud Assistant powered by Gemini. I have memory of our conversation, so feel free to refer back to things we've discussed. Ask me about fraud patterns, workflow optimization, or transaction analysis.",
        sender: 'bot',
        timestamp: new Date()
      }
    ]);
    
    // Generate new session ID to start fresh
    const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('fraud-assistant-session', newSessionId);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="panel panel--assistant">
      <div className="panel__header">
        <div>
          <h2>AI Fraud Chatbot</h2>
          <p className="muted">Ask me anything about fraud detection and prevention.</p>
        </div>
        <button 
          onClick={clearConversation}
          className="chatbot__clear-btn"
          title="Clear conversation memory"
        >
          🔄
        </button>
      </div>
      <div className="chatbot">
        <div className="chatbot__messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chatbot__message chatbot__message--${message.sender}`}
            >
              <div className="chatbot__message-content">
                <p>{message.text}</p>
                <span className="chatbot__timestamp">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chatbot__message chatbot__message--bot">
              <div className="chatbot__message-content">
                <div className="chatbot__typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="chatbot__input">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about fraud patterns, metrics, or workflow suggestions..."
            rows={2}
            disabled={isLoading}
          />
          <button 
            onClick={sendMessage} 
            disabled={!inputMessage.trim() || isLoading}
            className="chatbot__send-btn"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
