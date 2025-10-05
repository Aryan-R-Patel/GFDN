
# Global Fraud Defense Network (GFDN)

A real-time fraud detection and prevention platform with AI-powered chatbot featuring voice capabilities.

## [Demo](https://youtu.be/DS-EhEhqzJU)

## Features

- **Real-time Fraud Detection**: Advanced workflow-based fraud detection system
- **AI Fraud Assistant**: Intelligent chatbot powered by Google Gemini with voice capabilities
- **Voice Interface**: ElevenLabs-powered text-to-speech with audio visualization
- **Interactive Dashboard**: Real-time metrics and transaction monitoring
- **Global Transaction Mapping**: 3D globe visualization of worldwide transactions

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
ENABLE_SIMULATOR=false npm run dev

cd ../frontend
npm install
```

### 2. Environment Configuration

**Option A: Automated Setup (Recommended)**

Use the interactive setup script:

```bash
cd backend
./setup-env.sh
```

**Option B: Manual Setup**

Copy the example environment file and configure your API keys:

```bash
cd backend
cp .env.example .env
```

Edit `.env` file with your API keys:

```bash
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs API Configuration (for voice features)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=rachel
```

#### Getting API Keys:

**Google Gemini API:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env` file

**ElevenLabs API (for voice features):**
1. Visit [ElevenLabs](https://elevenlabs.io/)
2. Sign up for an account
3. Go to your profile and generate an API key
4. Copy the key to your `.env` file
5. Optionally, choose a different voice ID from their voice library

### 3. Run the Application

Start both backend and frontend servers:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173`

## Voice Features

The AI Fraud Assistant includes advanced voice capabilities:

- **Voice Mode**: Default mode with speech-to-text input and text-to-speech output
- **Audio Visualization**: Real-time audio visualization during AI responses
- **Speech Recognition**: Browser-based speech-to-text for voice input
- **Voice Synthesis**: ElevenLabs-powered high-quality voice synthesis
- **Mode Toggle**: Easy switching between voice and text modes

## Technology Stack

- **Frontend**: React, Vite, Three.js, React Flow
- **Backend**: Node.js, Express, Socket.io
- **AI**: Google Gemini API, ElevenLabs Voice API
- **Visualization**: D3.js, React Globe GL
- **Real-time**: WebSocket connections
