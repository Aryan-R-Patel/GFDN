import { useState, useRef, useEffect } from 'react';

export default function AIAssistant({ suggestions = [], metrics, transactions }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI Fraud Assistant powered by Gemini. Ask me about fraud patterns, workflow optimization, or transaction analysis.",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="panel panel--assistant">
      <div className="panel__header">
        <h2>AI Fraud Chatbot</h2>
        <p className="muted">Ask me anything about fraud detection and prevention.</p>
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
