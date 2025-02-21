let gameData = null;
let currentSong = null;
let attempts = 0;
const maxAttempts = 6;
const progressDurations = [1, 2, 4, 6, 8, 10]; // Updated durations
let isPlaying = false;
let incorrectGuesses = [];

async function loadGameData() {
    try {
        const response = await fetch('game_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        gameData = await response.json();
        document.getElementById('song-count').textContent = Object.keys(gameData).length;
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
    const correctTitle = currentSong.display_title.toLowerCase();
    
    if (guess.toLowerCase() === correctTitle) {
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
        if (e.key === 'Enter') {
            submitGuess();
        }
    });
    loadGameData();
});