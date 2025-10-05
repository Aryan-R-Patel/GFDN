import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

class VoiceService {
  constructor() {
    console.log('Initializing VoiceService...');
    
    this.isConfigured = !!process.env.ELEVENLABS_API_KEY;
    
    if (this.isConfigured) {
      // Initialize ElevenLabs client
      this.client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      });
      
      // Default voice ID/name - use voice name if ID not available
      this.defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'Sarah'; // Sarah is a good default voice
      
      console.log('VoiceService initialized with ElevenLabs API');
    } else {
      console.log('VoiceService initialized without ElevenLabs API (voice features disabled)');
    }
  }

  async synthesizeSpeech(text, voiceId = null) {
    try {
      if (!this.isConfigured) {
        throw new Error('ElevenLabs API key not configured');
      }

      console.log('Synthesizing speech for text:', text.substring(0, 100) + '...');
      
      const audioResponse = await this.client.textToSpeech.convert(voiceId || this.defaultVoiceId, {
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      });

      // Convert the audio stream to a buffer
      const chunks = [];
      const reader = audioResponse.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const audioBuffer = Buffer.concat(chunks);
      console.log('Audio synthesized successfully, buffer size:', audioBuffer.length);
      
      return audioBuffer;
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  async getAvailableVoices() {
    try {
      if (!this.isConfigured) {
        throw new Error('ElevenLabs API key not configured');
      }

      const voices = await this.client.voices.getAll();
      return voices.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  // Convert speech to text using browser's Web Speech API (handled on frontend)
  // This service focuses on text-to-speech
}

export default new VoiceService();