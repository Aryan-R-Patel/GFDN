import { useState, useRef, useEffect } from 'react';

export default function VoiceRecorder({ 
  onRecordingComplete, 
  onRecordingStart,
  onRecordingStop,
  disabled = false 
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Speech recognition setup
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    // Setup speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (onRecordingComplete) {
          onRecordingComplete(transcript, 'text');
        }
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onRecordingComplete]);

  const startSpeechRecognition = async () => {
    if (!recognitionRef.current || disabled) return;

    try {
      setIsListening(true);
      if (onRecordingStart) onRecordingStart();
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (onRecordingStop) onRecordingStop();
    }
  };

  const startRecording = async () => {
    if (disabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, 'audio');
        }
        setIsRecording(false);
        setRecordingTime(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (onRecordingStop) onRecordingStop();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      if (onRecordingStart) onRecordingStart();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isSpeechRecognitionAvailable = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  return (
    <div className="voice-recorder">
      <div className="voice-recorder__buttons">
        {/* Speech Recognition Button (preferred) */}
        {isSpeechRecognitionAvailable && (
          <button
            className={`voice-recorder__btn voice-recorder__btn--speech ${isListening ? 'voice-recorder__btn--active' : ''}`}
            onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
            disabled={disabled || isRecording}
            title="Click to speak"
          >
            {isListening ? (
              <>
                <span className="voice-recorder__icon">🔴</span>
                <span className="voice-recorder__text">Listening...</span>
              </>
            ) : (
              <>
                <span className="voice-recorder__icon">🎤</span>
                <span className="voice-recorder__text">Speak</span>
              </>
            )}
          </button>
        )}

        {/* Audio Recording Button (fallback) */}
        <button
          className={`voice-recorder__btn voice-recorder__btn--record ${isRecording ? 'voice-recorder__btn--active' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isListening}
          title="Record audio message"
        >
          {isRecording ? (
            <>
              <span className="voice-recorder__icon">⏹️</span>
              <span className="voice-recorder__text">Stop ({formatTime(recordingTime)})</span>
            </>
          ) : (
            <>
              <span className="voice-recorder__icon">📹</span>
              <span className="voice-recorder__text">Record</span>
            </>
          )}
        </button>
      </div>

      {(isRecording || isListening) && (
        <div className="voice-recorder__indicator">
          <div className="voice-recorder__pulse"></div>
          <span className="voice-recorder__status">
            {isListening ? 'Listening for speech...' : `Recording: ${formatTime(recordingTime)}`}
          </span>
        </div>
      )}
    </div>
  );
}