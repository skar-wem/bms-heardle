let gameData = null;
let currentSong = null;
let attempts = 0;
let songList = [];
const maxAttempts = 6;
const progressDurations = [1, 2, 4, 6, 8, 10];
let isPlaying = false;
let incorrectGuesses = [];
let isGameOver = false;

function processTitle(title) {
    let aliases = [title.toLowerCase()];
    // Remove spaces
    aliases.push(title.toLowerCase().replace(/\s+/g, ''));
    // Remove special characters
    aliases.push(title.toLowerCase().replace(/[^a-z0-9]/g, ''));
    // Handle spaced letters (e.g., "g e n g a o z o" -> "gengaozo")
    if (title.includes(' ')) {
        let spacedVersion = title.toLowerCase().replace(/\s+/g, '');
        aliases.push(spacedVersion);
    }
    return [...new Set(aliases)];
}

function cleanupText(text) {
    try {
        // Try common encodings
        if (text.includes('Š') || text.includes('ƒ') || text.includes('}')) {
            text = decodeURIComponent(escape(text));
        }
        
        // Remove any remaining strange characters
        text = text.replace(/[^\x00-\x7F\u3000-\u9FFF]/g, '');
        
        // Remove any "#ARTIST" prefix
        text = text.replace(/#ARTIST\s*/, '');
        
        // Trim any extra spaces
        text = text.trim();
        
        return text || "Unknown Artist";
    } catch (e) {
        console.log('Error cleaning up text:', text, e);
        return text;
    }
}

async function loadGameData() {
    try {
        const response = await fetch('game_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        gameData = await response.json();
        
        songList = Object.values(gameData).map(song => ({
            title: song.display_title,
            artist: cleanupText(song.artist),
            aliases: processTitle(song.display_title)
        }));
        
        document.getElementById('song-count').textContent = Object.keys(gameData).length;
        setupAutocomplete();
        startGame();
    } catch (error) {
        console.error('Error loading game data:', error);
        document.getElementById('result').textContent = 'Error loading game data: ' + error.message;
    }
}

function startGame() {
    const songs = Object.keys(gameData);
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    currentSong = gameData[randomSong];
    currentSong.cleanArtist = cleanupText(currentSong.artist);
    
    const player = document.getElementById('audio-player');
    player.src = `game_previews/${currentSong.preview_file}`;
    
    incorrectGuesses = [];
    updateGuessHistory();
    updateProgressBar();
}

function setupAutocomplete() {
    const input = document.getElementById('guess-input');
    const suggestionBox = document.createElement('div');
    suggestionBox.className = 'suggestion-box';
    input.parentNode.appendChild(suggestionBox);

    let selectedIndex = -1;

    input.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        if (query.length < 2) {
            suggestionBox.innerHTML = '';
            suggestionBox.style.display = 'none';
            return;
        }

        const suggestions = songList.filter(song => 
            song.title.toLowerCase().includes(query) || 
            song.artist.toLowerCase().includes(query) ||
            song.aliases.some(alias => alias.includes(query))
        ).slice(0, 5);

        if (suggestions.length > 0) {
            suggestionBox.innerHTML = suggestions.map(song => 
                `<div class="suggestion-item" data-title="${song.title}">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>`
            ).join('');
            suggestionBox.style.display = 'block';
            selectedIndex = -1;
        } else {
            suggestionBox.innerHTML = '';
            suggestionBox.style.display = 'none';
        }
    });

    input.addEventListener('keydown', function(e) {
        const suggestions = suggestionBox.getElementsByClassName('suggestion-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection();
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            if (suggestions[selectedIndex]) {
                input.value = suggestions[selectedIndex].dataset.title;
                suggestionBox.style.display = 'none';
                submitGuess();
            }
        }

        function updateSelection() {
            Array.from(suggestions).forEach((suggestion, index) => {
                suggestion.classList.toggle('selected', index === selectedIndex);
                if (index === selectedIndex) {
                    input.value = suggestion.dataset.title;
                }
            });
        }
    });

    suggestionBox.addEventListener('click', function(e) {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            input.value = item.dataset.title;
            suggestionBox.style.display = 'none';
            submitGuess();
        }
    });

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
            suggestionBox.style.display = 'none';
        }
    });
}

function playCurrentSegment() {
    if (isGameOver && !isPlaying) return;

    const player = document.getElementById('audio-player');
    const playButton = document.querySelector('.play-button');
    const progressFill = document.querySelector('.progress-fill');

    if (isPlaying) {
        player.pause();
        playButton.textContent = 'Play';
        isPlaying = false;
        progressFill.style.transition = 'none';
        progressFill.style.width = '0%';
        return;
    }

    const duration = progressDurations[attempts];

    // Reset and prepare for playback
    player.currentTime = 0;
    progressFill.style.transition = 'none';
    progressFill.style.width = '0%';
    
    // Force a reflow
    progressFill.offsetHeight;

    // Start playback
    const playPromise = player.play();
    
    if (playPromise !== undefined) {
        playPromise.then(_ => {
            playButton.textContent = 'Stop';
            isPlaying = true;

            // Start progress bar animation
            requestAnimationFrame(() => {
                progressFill.style.transition = `width ${duration}s linear`;
                progressFill.style.width = '100%';
            });

            // Set up the end timer
            setTimeout(() => {
                player.pause();
                playButton.textContent = 'Play';
                isPlaying = false;
            }, duration * 1000);
        });
    }
}

function updateProgressBar() {
    const segments = document.querySelectorAll('.progress-segment');
    segments.forEach((segment, index) => {
        if (index < attempts) {
            segment.className = 'progress-segment played';
        } else if (index === attempts) {
            segment.className = 'progress-segment current';
        } else {
            segment.className = 'progress-segment';
        }
    });
}

function updateGuessHistory() {
    const historyDiv = document.getElementById('guess-history');
    historyDiv.innerHTML = incorrectGuesses.map(guess => 
        `<div class="guess-item">${guess}</div>`
    ).join('');
}

function showModal(message, isSuccess = false) {
    const modal = document.getElementById('gameOverModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalTitle = document.querySelector('.modal-title');
    
    modalTitle.textContent = isSuccess ? 'Congratulations!' : 'Game Over';
    modalTitle.style.color = isSuccess ? 'var(--neon-pink)' : 'var(--neon-blue)';
    modalMessage.textContent = message;
    modal.style.display = 'block';
    isGameOver = true;
}

function startNewGame() {
    const modal = document.getElementById('gameOverModal');
    modal.style.display = 'none';
    isGameOver = false;
    attempts = 0;
    incorrectGuesses = [];
    updateProgressBar();
    updateGuessHistory();
    startGame();
}

function submitGuess() {
    if (isGameOver) return;
    
    const guessInput = document.getElementById('guess-input');
    const guess = guessInput.value.trim();
    const currentAliases = processTitle(currentSong.display_title);
    const guessAliases = processTitle(guess);
    
    const isCorrect = guessAliases.some(guessAlias => 
        currentAliases.some(currentAlias => 
            currentAlias === guessAlias
        )
    );
    
    if (isCorrect) {
        showModal(`Correct! The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`, true);
        revealFullSong();
    } else {
        incorrectGuesses.push(guess);
        attempts++;
        if (attempts >= maxAttempts) {
            showModal(`Game Over! The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
            revealFullSong();
        } else {
            showResult(`Try again! ${maxAttempts - attempts} attempts remaining`);
            updateProgressBar();
            updateGuessHistory();
        }
    }
    guessInput.value = '';
}

function skipGuess() {
    if (isGameOver) return;
    
    attempts++;
    if (attempts >= maxAttempts) {
        showModal(`Game Over! The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
        revealFullSong();
    } else {
        showResult(`Skipped! ${maxAttempts - attempts} attempts remaining`);
        updateProgressBar();
    }
}

function revealFullSong() {
    const player = document.getElementById('audio-player');
    const playButton = document.querySelector('.play-button');
    player.currentTime = 0;
    player.play();
    playButton.textContent = 'Stop';
    isPlaying = true;
}

function showResult(message) {
    document.getElementById('result').textContent = message;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('playButton').addEventListener('click', playCurrentSegment);
    document.getElementById('submit-button').addEventListener('click', submitGuess);
    document.getElementById('skip-button').addEventListener('click', skipGuess);
    document.getElementById('guess-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !document.querySelector('.suggestion-box').contains(document.activeElement)) {
            submitGuess();
        }
    });
    
    // Add modal close listener
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('gameOverModal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    loadGameData();
});