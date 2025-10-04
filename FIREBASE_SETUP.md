# Firebase Workflow Setup Guide

## Overview
The workflow system now uses Firebase Realtime Database to store and retrieve the active fraud detection workflow. This allows the workflow to persist across server restarts and be easily managed through Firebase.

## Firebase Database Structure

Your Firebase Realtime Database should have the following structure:

```json
{
  "workflow": {
    "id": "unique-workflow-id",
    "name": "Default Risk Flow",
    "version": 1,
    "nodes": [
      {
        "id": "input-node",
        "label": "Input",
        "type": "INPUT",
        "config": {
          "validateTransaction": true,
          "logEntry": true
        },
        "position": { "x": 0, "y": 0 }
      },
      {
        "id": "geo-check",
        "label": "Geo Check",
        "type": "GEO_CHECK",
        "config": {
          "allowedCountries": ["US", "CA", "GB", "DE", "FR"],
          "action": "FLAG"
        },
        "position": { "x": 250, "y": 0 }
      }
      // ... more nodes
    ],
    "edges": [
      { "id": "e1", "source": "input-node", "target": "geo-check" }
      // ... more edges
    ]
  }
}
```

## Setup Instructions

### 1. Environment Variables
Make sure your `.env` file in the backend directory has:
```
FIREBASE_REALTIME_DB=https://your-project.firebaseio.com
```

### 2. Firebase Security Rules (Optional)
Set appropriate security rules in Firebase Console:

```json
{
  "rules": {
    "workflow": {
      ".read": true,
      ".write": true
    }
  }
}
```

⚠️ **Note**: These rules allow public read/write. In production, implement proper authentication.

### 3. How It Works

**On Server Startup:**
1. The server attempts to load the workflow from Firebase at `/workflow`
2. If a workflow exists, it's loaded and used
3. If no workflow exists, the default workflow is created and saved to Firebase

**When Saving a Workflow:**
1. User edits workflow in the frontend
2. Clicks "Save Workflow" button
3. Frontend sends POST request to `/api/workflows/active`
4. Backend validates the workflow
5. Backend saves to both memory (activeWorkflow) and Firebase (`/workflow` path)
6. All connected clients receive the update via Socket.io

**Benefits:**
- ✅ Workflow persists across server restarts
- ✅ Easy to inspect/modify via Firebase Console
- ✅ Can manually update workflow in Firebase and restart server
- ✅ Version tracking included
- ✅ Automatic fallback to default if Firebase is unavailable

## Testing the Setup

### Check if workflow is in Firebase:
1. Go to Firebase Console
2. Navigate to Realtime Database
3. Look for `/workflow` node

### Manual workflow update:
You can manually edit the workflow in Firebase Console, then restart your backend server to load the changes.

### API Testing:
```bash
# Get current workflow
curl http://localhost:4000/api/workflows/active

# Update workflow (example)
curl -X POST http://localhost:4000/api/workflows/active \
  -H "Content-Type: application/json" \
  -d @workflow.json
```

## Troubleshooting

**Workflow not loading:**
- Check that `FIREBASE_REALTIME_DB` is set correctly
- Verify Firebase security rules allow read access
- Check server logs for Firebase connection errors

**Workflow not saving:**
- Verify Firebase security rules allow write access
- Check server logs for save errors
- Ensure workflow data passes validation schema

**Using default workflow:**
- This is normal if Firebase is empty on first run
- The default workflow will be automatically saved to Firebase
- Check Firebase Console to confirm it was saved
