let gameData = null;
let currentSong = null;
let attempts = 0;
let songList = [];
const maxAttempts = 6;
const progressDurations = [1, 2, 4, 6, 8, 10];
let isPlaying = false;
let incorrectGuesses = [];

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

async function loadGameData() {
    try {
        const response = await fetch('game_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        gameData = await response.json();
        
        // Build song list with aliases
        songList = Object.values(gameData).map(song => ({
            title: song.display_title,
            artist: song.artist,
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
    
    const player = document.getElementById('audio-player');
    player.src = `game_previews/${currentSong.preview_file}`;
    
    player.addEventListener('timeupdate', updateProgressFill);
    incorrectGuesses = [];
    updateGuessHistory();
    updateProgressBar();
}

function updateProgressFill() {
    if (isPlaying) {
        const player = document.getElementById('audio-player');
        const duration = progressDurations[attempts];
        const percentage = (player.currentTime / duration) * 100;
        document.querySelector('.progress-fill').style.width = `${Math.min(percentage, 100)}%`;
    }
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
    const player = document.getElementById('audio-player');
    const playButton = document.querySelector('.play-button');

    if (isPlaying) {
        player.pause();
        playButton.textContent = 'Play';
        isPlaying = false;
        return;
    }

    player.currentTime = 0;
    document.querySelector('.progress-fill').style.width = '0%';
    const playPromise = player.play();
    
    if (playPromise !== undefined) {
        playPromise.then(_ => {
            playButton.textContent = 'Stop';
            isPlaying = true;

            setTimeout(() => {
                player.pause();
                playButton.textContent = 'Play';
                isPlaying = false;
            }, progressDurations[attempts] * 1000);
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

function submitGuess() {
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
        showResult('Correct! The song was ' + currentSong.display_title + ' by ' + currentSong.artist);
        revealFullSong();
    } else {
        incorrectGuesses.push(guess);
        attempts++;
        if (attempts >= maxAttempts) {
            showResult('Game Over! The song was ' + currentSong.display_title + ' by ' + currentSong.artist);
            revealFullSong();
        } else {
            showResult('Try again! ' + (maxAttempts - attempts) + ' attempts remaining');
            updateProgressBar();
            updateGuessHistory();
        }
    }
    guessInput.value = '';
}

function skipGuess() {
    attempts++;
    if (attempts >= maxAttempts) {
        showResult('Game Over! The song was ' + currentSong.display_title + ' by ' + currentSong.artist);
        revealFullSong();
    } else {
        showResult('Skipped! ' + (maxAttempts - attempts) + ' attempts remaining');
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
    loadGameData();
});