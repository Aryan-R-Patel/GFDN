# AI Chatbot Firebase Integration

The AI Fraud Chatbot now has access to user information stored in Firebase, allowing it to provide personalized responses based on user profiles, preferences, transaction history, and system interactions.

## What's New

### Backend Changes
- **User Data Access**: The chatbot can now fetch user profiles, preferences, transaction history, and interaction logs from Firebase
- **Personalized Responses**: AI responses are tailored based on user role, department, preferences, and activity history
- **Caching**: User data is cached for 5 minutes to improve performance and reduce Firebase calls
- **Memory Enhancement**: Conversation memory now includes user-specific context

### Frontend Changes
- **User Identification**: The frontend now sends user IDs with chat requests
- **Demo User Support**: Includes demo user switching for testing personalization
- **Enhanced UI**: Shows current user ID and includes user switching button

## Firebase Data Structure

The system expects the following data structure in Firebase:

```
/users/{userId}
  /profile
    - name: string
    - role: string
    - department: string
    - location: string
    - joinDate: string
    - email: string
  /preferences
    - alertThreshold: number
    - notificationTypes: array
    - dashboard: string
    - riskTolerance: string
    - autoApprove: boolean

/user_transactions/{userId}
  /{transactionId}
    - id: string
    - amount: number
    - currency: string
    - status: string
    - timestamp: string
    - reviewedBy: string
    - notes: string

/user_interactions/{userId}
  /{interactionId}
    - action: string
    - description: string
    - timestamp: string
    - outcome: string (optional)
    - priority: string (optional)
```

## Testing the Integration

### 1. Seed Sample Data
First, populate Firebase with sample user data:

```bash
cd backend
node src/data/seedUserData.js
```

Or use the API endpoint:
```bash
curl -X POST http://localhost:4000/api/admin/seed-users
```

### 2. Demo Users
The system includes two demo users:
- **user_demo_001**: Sarah Chen (Senior Fraud Analyst)
- **user_demo_002**: Marcus Rodriguez (Fraud Investigator)

### 3. Test Personalization
Try these questions to see personalized responses:
- "What's my name?"
- "What's my role?"
- "Show me my recent activity"
- "What are my alert preferences?"
- "Based on my role, what should I focus on?"

### 4. Switch Users
Use the 👤 button in the chat interface to switch between demo users and see different personalized responses.

## API Endpoints

### Chat with User Context
```
POST /api/chat
Headers:
  X-Session-ID: session_123
  X-User-ID: user_demo_001
Body:
{
  "message": "What's my role?",
  "userId": "user_demo_001",
  "context": { ... }
}
```

### Admin Endpoints
```
GET /api/chatbot/cache-stats     # View cache statistics
POST /api/chatbot/clear-cache    # Clear user data cache
POST /api/admin/seed-users       # Seed sample user data
```

## How It Works

1. **User Identification**: When a chat message is sent, the system extracts the user ID from headers or request body
2. **Data Fetching**: The chatbot service fetches user data from Firebase (with caching)
3. **Context Building**: User profile, preferences, and history are formatted into the AI prompt
4. **Personalized Response**: The AI generates responses using both system context and user-specific information
5. **Memory Storage**: Conversations are stored per session with user context

## Personalization Features

The AI can now:
- Address users by their actual name
- Reference their role and department
- Consider their risk tolerance and preferences
- Mention their recent transaction reviews
- Provide role-specific advice and insights
- Remember user preferences across conversations
- Adapt communication style based on user profile

## Development Notes

- User data is cached for 5 minutes to balance performance and freshness
- The system gracefully handles missing user data
- Demo users are automatically used if no real user data exists
- Cache can be cleared via API for testing
- All Firebase operations include error handling

## Next Steps

To integrate with real user data:
1. Update the user ID generation logic in the frontend
2. Implement proper user authentication
3. Modify the Firebase data structure to match your user system
4. Add user management APIs as needed
5. Implement proper access controls for user data