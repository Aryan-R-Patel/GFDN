import { useEffect, useRef, useState } from 'react';

export default function AudioVisualizer({ 
  isPlaying = false, 
  audioData = null, 
  className = '',
  barCount = 32,
  barHeight = 40,
  barWidth = 3,
  barGap = 2
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElementRef = useRef(null);
  const [frequencies, setFrequencies] = useState(new Array(barCount).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = (barWidth + barGap) * barCount;
    canvas.height = barHeight;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      frequencies.forEach((freq, index) => {
        const barHeightScaled = isPlaying ? 
          Math.max(2, (freq / 255) * barHeight) : 
          Math.random() * 8 + 2; // Subtle animation when not playing
        
        const x = index * (barWidth + barGap);
        const y = canvas.height - barHeightScaled;
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)'); // Blue
        gradient.addColorStop(0.5, 'rgba(147, 51, 234, 0.8)'); // Purple
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0.8)'); // Pink
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeightScaled);
      });
      
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [frequencies, isPlaying, barCount, barHeight, barWidth, barGap]);

  // Setup audio analysis when playing audio
  useEffect(() => {
    if (!isPlaying || !audioData) {
      // Generate subtle random animation when not playing
      const interval = setInterval(() => {
        if (!isPlaying) {
          setFrequencies(prev => prev.map(() => Math.random() * 30 + 5));
        }
      }, 100);
      
      return () => clearInterval(interval);
    }

    // Create audio element and setup analysis
    const setupAudioAnalysis = async () => {
      try {
        // Create audio element
        const audio = new Audio();
        audioElementRef.current = audio;
        
        // Convert base64 to blob URL
        const audioBlob = new Blob([
          new Uint8Array(
            atob(audioData)
              .split('')
              .map(char => char.charCodeAt(0))
          )
        ], { type: 'audio/mpeg' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        audio.src = audioUrl;
        
        // Setup Web Audio API
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const audioContext = audioContextRef.current;
        const source = audioContext.createMediaElementSource(audio);
        const analyser = audioContext.createAnalyser();
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        analyserRef.current = analyser;
        
        // Start analysis
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateFrequencies = () => {
          if (analyserRef.current && !audio.paused) {
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Sample frequencies for visualization
            const step = Math.floor(dataArray.length / barCount);
            const newFrequencies = [];
            
            for (let i = 0; i < barCount; i++) {
              const start = i * step;
              const end = start + step;
              const slice = dataArray.slice(start, end);
              const average = slice.reduce((sum, val) => sum + val, 0) / slice.length;
              newFrequencies.push(average || 0);
            }
            
            setFrequencies(newFrequencies);
          }
          
          if (isPlaying && !audio.paused) {
            requestAnimationFrame(updateFrequencies);
          }
        };
        
        // Play audio and start visualization
        await audio.play();
        updateFrequencies();
        
        // Cleanup when audio ends
        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
        });
        
      } catch (error) {
        console.error('Error setting up audio analysis:', error);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, [audioData, isPlaying, barCount]);

  return (
    <div className={`audio-visualizer ${className}`}>
      <canvas 
        ref={canvasRef}
        className="audio-visualizer__canvas"
        style={{
          borderRadius: '4px',
          opacity: isPlaying ? 1 : 0.6
        }}
      />
    </div>
  );
}