import { useState, useRef, useEffect } from "react";
import AudioVisualizer from "./AudioVisualizer";
import VoiceRecorder from "./VoiceRecorder";

export default function AIAssistant({
  suggestions = [],
  metrics = {},
  transactions = [],
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI Fraud Assistant powered by Gemini. I have memory of our conversation, so feel free to refer back to things we've discussed. Ask me about fraud patterns, workflow optimization, or transaction analysis.",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(true); // Voice mode is default
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudioData, setCurrentAudioData] = useState(null);
  const messagesEndRef = useRef(null);

  // Generate a persistent session ID for this browser session
  const [sessionId] = useState(() => {
    let id = localStorage.getItem("fraud-assistant-session");
    if (!id) {
      id =
        "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("fraud-assistant-session", id);
    }
    return id;
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: messageToSend,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const endpoint = isVoiceMode ? "/api/chat/voice" : "/api/chat";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId,
        },
        body: JSON.stringify({
          message: messageToSend,
          context: {
            metrics,
            recentTransactions: transactions.slice(-10),
            suggestions,
          },
        }),
      });

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: "bot",
        timestamp: new Date(),
        audio: data.audio || null, // Include audio data if available
      };

      setMessages(prev => [...prev, botMessage]);

      // If voice mode and audio is available, play it automatically
      if (isVoiceMode && data.audio) {
        setCurrentAudioData(data.audio);
        setIsPlayingAudio(true);
        
        // Audio will stop playing automatically when done
        setTimeout(() => {
          setIsPlayingAudio(false);
          setCurrentAudioData(null);
        }, 10000); // Max 10 seconds, adjust as needed
      } else if (isVoiceMode && data.error) {
        // Show notification that voice synthesis is not available
        console.warn('Voice synthesis not available:', data.error);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        sender: "bot",
        timestamp: new Date(),
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
        sender: "bot",
        timestamp: new Date(),
      },
    ]);

    // Generate new session ID to start fresh
    const newSessionId =
      "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("fraud-assistant-session", newSessionId);
  };

  const handleKeyPress = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceRecording = (data, type) => {
    if (type === 'text') {
      // Speech recognition result
      sendMessage(data);
    } else if (type === 'audio') {
      // Audio recording - would need to implement speech-to-text on backend
      console.log('Audio recording received:', data);
      // For now, just show a message
      const userMessage = {
        id: Date.now(),
        text: "[Voice message recorded - speech-to-text not implemented yet]",
        sender: "user",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
    }
  };

  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode);
    setIsPlayingAudio(false);
    setCurrentAudioData(null);
  };

  const playMessageAudio = (audio) => {
    if (audio) {
      setCurrentAudioData(audio);
      setIsPlayingAudio(true);
      
      setTimeout(() => {
        setIsPlayingAudio(false);
        setCurrentAudioData(null);
      }, 10000);
    }
  };

  return (
    <div className="panel panel--assistant">
      <div className="panel__header">
        <div>
          <h2>AI Fraud Chatbot</h2>
          <p className="muted">
            Ask me anything about fraud detection and prevention.
          </p>
        </div>
        <div className="chatbot__controls">
          <button
            onClick={toggleVoiceMode}
            className={`chatbot__mode-btn ${isVoiceMode ? 'chatbot__mode-btn--active' : ''}`}
            title={`Switch to ${isVoiceMode ? 'text' : 'voice'} mode`}
          >
            {isVoiceMode ? '🎤' : '💬'}
          </button>
          <button
            onClick={clearConversation}
            className="chatbot__clear-btn"
            title="Clear conversation memory"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Audio Visualizer */}
      {isVoiceMode && (
        <div className="chatbot__visualizer">
          <AudioVisualizer 
            isPlaying={isPlayingAudio}
            audioData={currentAudioData}
            className="chatbot__audio-viz"
          />
          <div className="chatbot__mode-indicator">
            <span className="chatbot__mode-text">
              🎤 Voice Mode {isPlayingAudio ? '(Speaking...)' : '(Ready)'}
            </span>
          </div>
        </div>
      )}

      <div className="chatbot">
        <div className="chatbot__messages">
          {messages.map(message => (
            <div
              key={message.id}
              className={`chatbot__message chatbot__message--${message.sender}`}
            >
              <div className="chatbot__message-content">
                <p>{message.text}</p>
                {message.audio && (
                  <button
                    className="chatbot__replay-btn"
                    onClick={() => playMessageAudio(message.audio)}
                    title="Replay audio"
                  >
                    🔊 Replay
                  </button>
                )}
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
          {isVoiceMode ? (
            <VoiceRecorder 
              onRecordingComplete={handleVoiceRecording}
              disabled={isLoading}
            />
          ) : (
            <>
              <textarea
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about fraud patterns, metrics, or workflow suggestions..."
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="chatbot__send-btn"
              >
                Send
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
