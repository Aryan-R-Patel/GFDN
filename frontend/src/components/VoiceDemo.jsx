import { useState } from 'react';
import AudioVisualizer from './AudioVisualizer';

export default function VoiceDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioData, setAudioData] = useState(null);

  const playDemoAudio = () => {
    // Simulate audio playback
    setIsPlaying(true);
    
    // Generate some fake audio data for visualization
    const fakeAudioData = btoa(String.fromCharCode(...new Array(1000).fill(0).map(() => Math.floor(Math.random() * 256))));
    setAudioData(fakeAudioData);
    
    // Stop after 3 seconds
    setTimeout(() => {
      setIsPlaying(false);
      setAudioData(null);
    }, 3000);
  };

  return (
    <div className="voice-demo">
      <h3>🎤 Voice Features Demo</h3>
      <p>Experience the AI Fraud Assistant's voice capabilities:</p>
      
      <div className="voice-demo__features">
        <div className="voice-demo__feature">
          <h4>🎵 Audio Visualization</h4>
          <p>Real-time audio visualization when the AI speaks</p>
          <AudioVisualizer 
            isPlaying={isPlaying}
            audioData={audioData}
            className="voice-demo__visualizer"
          />
          <button 
            onClick={playDemoAudio}
            className="voice-demo__btn"
            disabled={isPlaying}
          >
            {isPlaying ? 'Playing Demo...' : 'Play Demo Audio'}
          </button>
        </div>
        
        <div className="voice-demo__feature">
          <h4>🎤 Speech Input</h4>
          <p>Click the microphone button to speak your questions</p>
          <div className="voice-demo__mic">
            <button className="voice-demo__mic-btn">
              🎤 Try Speech Input
            </button>
          </div>
        </div>
        
        <div className="voice-demo__feature">
          <h4>🔊 Voice Output</h4>
          <p>AI responses are spoken using ElevenLabs high-quality voices</p>
          <div className="voice-demo__output">
            <span className="voice-demo__voice-name">Voice: Rachel</span>
          </div>
        </div>
      </div>
      
      <div className="voice-demo__note">
        <p><strong>Note:</strong> Voice features require ElevenLabs API configuration. See README for setup instructions.</p>
      </div>
    </div>
  );
}