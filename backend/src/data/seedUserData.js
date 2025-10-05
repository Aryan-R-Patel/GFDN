import { writeData } from '../../firebase.js';
import { fileURLToPath } from 'url';

// Sample user data structure for testing Firebase integration
const sampleUsers = {
  // Demo user data that the frontend will use
  "user_demo_001": {
    profile: {
      name: "Sarah Chen",
      role: "Senior Fraud Analyst",
      department: "Risk Management",
      location: "New York, NY",
      joinDate: "2023-01-15",
      email: "sarah.chen@company.com",
      lastLogin: new Date().toISOString()
    },
    preferences: {
      alertThreshold: 75,
      notificationTypes: ["high_risk", "velocity_alerts", "geo_alerts"],
      dashboard: "detailed",
      riskTolerance: "medium",
      autoApprove: false,
      workflowPreference: "comprehensive"
    }
  },
  "user_demo_002": {
    profile: {
      name: "Marcus Rodriguez",
      role: "Fraud Investigator",
      department: "Security Operations",
      location: "Austin, TX",
      joinDate: "2022-08-20",
      email: "marcus.rodriguez@company.com",
      lastLogin: new Date().toISOString()
    },
    preferences: {
      alertThreshold: 65,
      notificationTypes: ["all_alerts", "escalations"],
      dashboard: "summary",
      riskTolerance: "low",
      autoApprove: true,
      workflowPreference: "quick_review"
    }
  }
};

// Sample user transactions
const sampleUserTransactions = {
  "user_demo_001": {
    "txn_001": {
      id: "txn_001",
      amount: 2500,
      currency: "USD",
      status: "APPROVED",
      timestamp: "2024-01-15T10:30:00Z",
      reviewedBy: "user_demo_001",
      notes: "Manual review - legitimate business transaction"
    },
    "txn_002": {
      id: "txn_002",
      amount: 850,
      currency: "EUR",
      status: "FLAGGED",
      timestamp: "2024-01-14T15:45:00Z",
      reviewedBy: "user_demo_001",
      notes: "Velocity check triggered - needs follow up"
    }
  },
  "user_demo_002": {
    "txn_003": {
      id: "txn_003",
      amount: 15000,
      currency: "USD",
      status: "BLOCKED",
      timestamp: "2024-01-15T09:15:00Z",
      reviewedBy: "user_demo_002",
      notes: "High-risk geographic location - confirmed fraudulent"
    }
  }
};

// Sample user interactions with the system
const sampleUserInteractions = {
  "user_demo_001": {
    "int_001": {
      action: "workflow_modified",
      description: "Adjusted velocity check threshold from 5 to 6",
      timestamp: "2024-01-15T11:20:00Z",
      impact: "Reduced false positives by 15%"
    },
    "int_002": {
      action: "alert_investigated",
      description: "Reviewed high-risk transaction from Europe",
      timestamp: "2024-01-15T09:45:00Z",
      outcome: "Approved after manual verification"
    },
    "int_003": {
      action: "chat_session",
      description: "Asked about anomaly detection tuning",
      timestamp: "2024-01-14T16:30:00Z",
      topics: ["machine_learning", "threshold_optimization"]
    }
  },
  "user_demo_002": {
    "int_004": {
      action: "case_escalated",
      description: "Escalated suspicious crypto transaction to legal team",
      timestamp: "2024-01-15T08:30:00Z",
      priority: "urgent"
    },
    "int_005": {
      action: "report_generated",
      description: "Created weekly fraud summary report",
      timestamp: "2024-01-14T17:00:00Z",
      reportType: "weekly_summary"
    }
  }
};

async function seedUserData() {
  try {
    console.log('Seeding sample user data to Firebase...');
    
    // Write user profiles
    for (const [userId, userData] of Object.entries(sampleUsers)) {
      await writeData(`/users/${userId}`, userData);
      console.log(`✓ Created user profile for ${userId} (${userData.profile.name})`);
    }
    
    // Write user transactions
    for (const [userId, transactions] of Object.entries(sampleUserTransactions)) {
      await writeData(`/user_transactions/${userId}`, transactions);
      console.log(`✓ Created transaction history for ${userId}`);
    }
    
    // Write user interactions
    for (const [userId, interactions] of Object.entries(sampleUserInteractions)) {
      await writeData(`/user_interactions/${userId}`, interactions);
      console.log(`✓ Created interaction history for ${userId}`);
    }
    
    console.log('\n🎉 Sample user data seeded successfully!');
    console.log('\nTo test personalization:');
    console.log('1. Open the frontend application');
    console.log('2. The AI will automatically use demo user data');
    console.log('3. Try asking: "What\'s my role?" or "Show me my recent activity"');
    console.log('4. The AI should respond with personalized information');
    
  } catch (error) {
    console.error('Error seeding user data:', error);
  }
}

// ESM-compatible direct-run check
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  seedUserData().then(() => {
    console.log('Seeding complete');
    process.exit(0);
  }).catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

export { seedUserData, sampleUsers, sampleUserTransactions, sampleUserInteractions };