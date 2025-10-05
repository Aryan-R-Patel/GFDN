#!/bin/bash

# GFDN Environment Setup Script
# This script helps you configure the necessary API keys for the Global Fraud Defense Network

echo "🌐 Global Fraud Defense Network - Environment Setup"
echo "=================================================="
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. This script will create a backup and create a new one."
    echo "Do you want to continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
    mv .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up existing .env file"
fi

# Copy template
cp .env.example .env
echo "✅ Created .env file from template"
echo ""

# Function to update env file
update_env() {
    local key=$1
    local value=$2
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|${key}=.*|${key}=${value}|" .env
    else
        # Linux
        sed -i "s|${key}=.*|${key}=${value}|" .env
    fi
}

# Get Gemini API Key
echo "🤖 Google Gemini API Configuration"
echo "Get your API key from: https://makersuite.google.com/app/apikey"
echo "Enter your Gemini API key (or press Enter to skip):"
read -r GEMINI_KEY
if [ ! -z "$GEMINI_KEY" ]; then
    update_env "GEMINI_API_KEY" "$GEMINI_KEY"
    echo "✅ Gemini API key configured"
else
    echo "⚠️  Gemini API key skipped - chatbot will not work without this"
fi
echo ""

# Get ElevenLabs API Key
echo "🎤 ElevenLabs Voice API Configuration"
echo "Get your API key from: https://elevenlabs.io/"
echo "Enter your ElevenLabs API key (or press Enter to skip):"
read -r ELEVENLABS_KEY
if [ ! -z "$ELEVENLABS_KEY" ]; then
    update_env "ELEVENLABS_API_KEY" "$ELEVENLABS_KEY"
    echo "✅ ElevenLabs API key configured"
    
    echo ""
    echo "🗣️  Voice Selection"
    echo "Default voice is 'rachel'. You can choose from:"
    echo "- rachel (default)"
    echo "- adam"
    echo "- antoni"
    echo "- arnold"
    echo "- bella"
    echo "- domi"
    echo "- elli"
    echo "- josh"
    echo "- sam"
    echo ""
    echo "Enter voice ID (or press Enter for default 'rachel'):"
    read -r VOICE_ID
    if [ ! -z "$VOICE_ID" ]; then
        update_env "ELEVENLABS_VOICE_ID" "$VOICE_ID"
        echo "✅ Voice ID set to: $VOICE_ID"
    else
        echo "✅ Using default voice: rachel"
    fi
else
    echo "⚠️  ElevenLabs API key skipped - voice features will be disabled"
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "Your .env file has been configured. Here's what you can do next:"
echo ""
echo "1. Start the backend server:"
echo "   npm start"
echo ""
echo "2. In another terminal, start the frontend:"
echo "   cd ../frontend && npm run dev"
echo ""
echo "3. Open your browser to the URL shown by the frontend server"
echo ""
echo "📖 For more information, see the README.md file"
echo ""

if [ -z "$GEMINI_KEY" ]; then
    echo "⚠️  IMPORTANT: You need to add your Gemini API key to .env for the chatbot to work"
fi

if [ -z "$ELEVENLABS_KEY" ]; then
    echo "💡 NOTE: Voice features are optional but enhance the chatbot experience"
fi