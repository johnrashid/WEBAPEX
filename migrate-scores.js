// Quick migration script - Run this in browser console on the leaderboard page
// or copy-paste into console at http://127.0.0.1:5500/WEBAPEX/Project/leaderboard.html

(function() {
    const scores = localStorage.getItem('webapex_scores');
    if (!scores) {
        console.log('No scores found');
        return;
    }
    
    const parsed = JSON.parse(scores);
    let migrated = 0;
    
    // List of parts of speech quiz names
    const partsOfSpeechQuizzes = [
        'Noun Quiz', 'Pronoun Quiz', 'Verb Quiz', 'Adjective Quiz',
        'Adverb Quiz', 'Conjunction Quiz', 'Interjection Quiz', 'Preposition Quiz'
    ];
    
    console.log('Found', parsed.length, 'total scores');
    
    parsed.forEach(s => {
        if (s.category === 'grammar' && partsOfSpeechQuizzes.includes(s.testName)) {
            console.log('Migrating:', s.testName, 'from grammar to partsOfSpeech');
            s.category = 'partsOfSpeech';
            migrated++;
        }
    });
    
    localStorage.setItem('webapex_scores', JSON.stringify(parsed));
    console.log('✅ Migrated', migrated, 'scores from Grammar to Parts of Speech!');
    console.log('Reload the page to see changes');
})();
