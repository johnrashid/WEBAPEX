// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRyode_fKxiB11wnYraCdVU-1hY6C6bIg",
  authDomain: "webapex-ff5d0.firebaseapp.com",
  projectId: "webapex-ff5d0",
  storageBucket: "webapex-ff5d0.firebasestorage.app",
  messagingSenderId: "740172740236",
  appId: "1:740172740236:web:072dbcb83aded57654eda9",
  measurementId: "G-DR0EX5Q6G0",
  databaseURL: "https://webapex-ff5d0-default-rtdb.firebaseio.com"
};

// Initialize Firebase
let app, database;

try {
  app = firebase.initializeApp(firebaseConfig);
  database = firebase.database();
  console.log('Firebase Realtime Database initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

// Helper function to save score to Realtime Database
async function saveScoreToFirebase(scoreData) {
  try {
    // Get current user (anonymous if not logged in)
    let userId = localStorage.getItem('webapex_userId');
    let userName = localStorage.getItem('webapex_userName') || 'Anonymous';
    
    // If no userId, create one
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem('webapex_userId', userId);
    }
    
    // Add score to Realtime Database
    const scoresRef = database.ref('leaderboard');
    const newScoreRef = scoresRef.push();
    
    await newScoreRef.set({
      userId: userId,
      userName: userName,
      category: scoreData.category,
      testName: scoreData.testName,
      score: scoreData.score,
      total: scoreData.total,
      percentage: scoreData.percentage,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      date: scoreData.date || new Date().toISOString()
    });
    
    console.log('Score saved to Firebase Realtime Database successfully');
    return true;
  } catch (error) {
    console.error('Error saving score to Firebase:', error);
    return false;
  }
}

// Helper function to get leaderboard data from Realtime Database
async function getLeaderboardFromFirebase(category = 'all', limit = 100) {
  try {
    const scoresRef = database.ref('leaderboard');
    let query = scoresRef.orderByChild('score').limitToLast(limit);
    
    const snapshot = await query.once('value');
    const scores = [];
    
    snapshot.forEach((childSnapshot) => {
      const score = childSnapshot.val();
      // Filter by category if not 'all'
      if (category === 'all' || score.category === category) {
        scores.push({
          id: childSnapshot.key,
          ...score
        });
      }
    });
    
    // Sort by score descending (since orderByChild is ascending)
    scores.sort((a, b) => b.score - a.score);
    
    // Limit results
    return scores.slice(0, limit);
  } catch (error) {
    console.error('Error getting leaderboard from Firebase:', error);
    return [];
  }
}

// Helper function to save score to both localStorage and Firebase
async function saveScore(scoreData) {
  // Save to localStorage first (always works, even offline)
  try {
    const existingScores = JSON.parse(localStorage.getItem('webapex_scores') || '[]');
    existingScores.push(scoreData);
    localStorage.setItem('webapex_scores', JSON.stringify(existingScores));
    console.log('Score saved to localStorage');
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
  
  // Then try to save to Firebase (may fail if offline or not configured)
  try {
    await saveScoreToFirebase(scoreData);
  } catch (e) {
    console.warn('Could not save to Firebase, but localStorage save succeeded');
  }
}

// Helper function to get leaderboard data from Realtime Database
async function getLeaderboardFromFirestore(category = 'all', limit = 100) {
  // Alias for compatibility - now uses Realtime Database instead
  return await getLeaderboardFromFirebase(category, limit);
}

// Helper function to save score to Firestore
async function saveScoreToFirestore(scoreData) {
  // Alias for compatibility - now uses Realtime Database instead
  return await saveScoreToFirebase(scoreData);
}

// Export functions for use in other files
if (typeof window !== 'undefined') {
  window.saveScoreToFirestore = saveScoreToFirestore;
  window.getLeaderboardFromFirestore = getLeaderboardFromFirestore;
  window.saveScore = saveScore;
  window.saveScoreToFirebase = saveScoreToFirebase;
  window.getLeaderboardFromFirebase = getLeaderboardFromFirebase;
}
