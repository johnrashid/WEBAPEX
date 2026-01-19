# Firestore Leaderboard Setup Guide

## What I've Implemented

I've integrated Firestore database for the WEBAPEX leaderboard system so multiple users can compete on the same leaderboard.

### Files Created/Modified:
1. **firebase-config.js** - Firebase initialization and helper functions
2. **leaderboard.html** - Updated to load scores from Firestore
3. **grammartest-noun.html** - Example of Firestore integration (saves to both localStorage and Firestore)

### How It Works:
- **Dual Storage**: Scores are saved to BOTH localStorage (for offline/backup) AND Firestore (for global leaderboard)
- **Anonymous Users**: Each user gets a unique ID stored in localStorage
- **Fallback**: If Firestore is unavailable, the system falls back to localStorage
- **Real-time**: Leaderboard loads from Firestore showing all users' scores

## Setup Required

To enable Firestore, you need to:

### 1. Enable Firestore Database
1. Go to Firebase Console: https://console.firebase.google.com/project/webapex-ff5d0
2. Click on "Firestore Database" in the left menu
3. Click "Create database"
4. Choose "Start in production mode" (we'll set rules next)
5. Select a location (choose closest to your users, e.g., "asia-southeast1")
6. Click "Enable"

### 2. Set Security Rules
Once Firestore is created, go to the "Rules" tab and update the rules to:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read leaderboard scores
    match /leaderboard/{scoreId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
  }
}
```

This allows:
- ✅ Anyone can read leaderboard scores
- ✅ Anyone can add new scores
- ❌ No one can modify or delete existing scores (prevents cheating)

### 3. Test the Integration
1. Open your app: https://webapex-ff5d0.web.app
2. Complete a grammar test (Noun Quiz is already integrated)
3. Check browser console for "Score saved to Firestore successfully"
4. Go to leaderboard - you should see scores from all users

## Next Steps

### To integrate Firestore in ALL tests:

I've already integrated it in `grammartest-noun.html` as an example. For the remaining tests, you need to:

1. **Add Firebase SDKs to the `<head>` section:**
```html
<!-- Firebase SDKs -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
```

2. **Update the score saving code:**
Replace the localStorage-only save with:
```javascript
// Save score to localStorage and Firestore
(async () => {
  try {
    const percentage = Math.round((score / questions.length) * 100);
    const scoreData = {
      category: 'grammar', // or 'vocabulary', 'reading', etc.
      testName: 'Test Name',
      score: score,
      total: questions.length,
      percentage: percentage,
      date: new Date().toISOString()
    };
    
    // Use the combined save function if available
    if (typeof window.saveScore === 'function') {
      await window.saveScore(scoreData);
    } else {
      // Fallback to localStorage only
      const existingScores = JSON.parse(localStorage.getItem('webapex_scores') || '[]');
      existingScores.push(scoreData);
      localStorage.setItem('webapex_scores', JSON.stringify(existingScores));
    }
  } catch (e) {
    console.error('Error saving score:', e);
  }
})();
```

### Files that need this update:
- [x] grammartest-noun.html ✅ (already done)
- [ ] grammartest-pronoun.html
- [ ] grammartest-verb.html
- [ ] grammartest-adjective.html
- [ ] grammartest-adverb.html
- [ ] grammartest-conjunction.html
- [ ] grammartest-interjection.html
- [ ] grammartest-preposition.html
- [ ] vocabulary-synonyms.html
- [ ] vocabulary-antonyms.html
- [ ] vocabulary-missingword.html
- [ ] questions.html (reading comprehension)
- [ ] textsglossary-learn.html
- [ ] pretest.html
- [ ] posttest.html

## Optional Enhancements

### User Name Input
Add a simple name input modal on first visit:
```javascript
// Check if user has a name
let userName = localStorage.getItem('webapex_userName');
if (!userName) {
  userName = prompt('Enter your name for the leaderboard:', 'Anonymous');
  if (userName) {
    localStorage.setItem('webapex_userName', userName);
  }
}
```

### Real-time Updates
Add real-time listener to leaderboard:
```javascript
db.collection('leaderboard')
  .orderBy('score', 'desc')
  .limit(100)
  .onSnapshot((snapshot) => {
    // Update leaderboard in real-time when new scores are added
    loadScoresFromFirestore();
    displayLeaderboard(currentCategory);
  });
```

## Troubleshooting

### If Firestore isn't working:
1. Check browser console for errors
2. Verify Firestore is enabled in Firebase Console
3. Check security rules allow read/create
4. Make sure firebase-config.js is loaded before other scripts

### If scores aren't showing:
1. Complete a test to add a score
2. Check Firebase Console > Firestore Database > Data tab
3. Look for "leaderboard" collection
4. Verify scores are being added

## Benefits

✅ **Multi-user leaderboard**: Students can compete with each other
✅ **Persistent scores**: Scores are saved in the cloud
✅ **Offline support**: Falls back to localStorage if offline
✅ **Scalable**: Firestore can handle many users
✅ **Real-time**: Can add live updates if needed
