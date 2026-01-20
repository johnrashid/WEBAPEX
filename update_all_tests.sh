#!/bin/bash

# Script to add Firebase SDKs and saveScore() to all test files

cd /home/markjustine/Documents/webapex/WEBAPEX/Project

echo "Updating Grammar Tests..."

# List of files with category and test name
declare -A FILES
FILES["grammartest-pronoun.html"]="grammar:Pronoun Quiz"
FILES["grammartest-verb.html"]="grammar:Verb Quiz"
FILES["grammartest-adjective.html"]="grammar:Adjective Quiz"
FILES["grammartest-adverb.html"]="grammar:Adverb Quiz"
FILES["grammartest-conjunction.html"]="grammar:Conjunction Quiz"
FILES["grammartest-interjection.html"]="grammar:Interjection Quiz"
FILES["grammartest-preposition.html"]="grammar:Preposition Quiz"
FILES["vocabulary-synonyms.html"]="vocabulary:Synonyms Quiz"
FILES["vocabulary-antonyms.html"]="vocabulary:Antonyms Quiz"
FILES["vocabulary-missingword.html"]="vocabulary:Missing Word Quiz"
FILES["questions.html"]="reading:Reading Comprehension"
FILES["posttest.html"]="posttest:Post Test"

for file in "${!FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "Skipping $file - not found"
        continue
    fi
    
    IFS=: read category testname <<< "${FILES[$file]}"
    echo "Processing: $file ($category - $testname)"
    
    # Check if Firebase SDKs are present
    if ! grep -q "firebase-config.js" "$file"; then
        # Add Firebase SDKs before </head>
        sed -i 's|</head>|  <!-- Firebase SDKs -->\n  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>\n  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>\n  <script src="firebase-config.js"></script>\n</head>|' "$file"
        echo "  ✓ Added Firebase SDKs"
    else
        echo "  - Firebase SDKs already present"
    fi
done

echo ""
echo "✅ All files processed!"
echo "Please manually update the score save logic in each file to use saveScore()"
