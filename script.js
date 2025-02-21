let gameData = null;
let currentSong = null;
let attempts = 0;
const maxAttempts = 6;

// Load game data
async function loadGameData() {
    const response = await fetch('game_data.json');
    gameData = await response.json();
    startGame();
}

function startGame() {
    // Pick random song
    const songs = Object.keys(gameData);
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    currentSong = gameData[randomSong];
    
    // Set up audio player
    const player = document.getElementById('audio-player');
    player.src = `game_previews/${currentSong.preview_file}`;
}

function submitGuess() {
    const guess = document.getElementById('guess-input').value.toLowerCase();
    const correctTitle = currentSong.display_title.toLowerCase();
    
    attempts++;
    
    if(guess === correctTitle) {
        showResult('Correct! The song was ' + currentSong.display_title + ' by ' + currentSong.artist);
    } else if(attempts >= maxAttempts) {
        showResult('Game Over! The song was ' + currentSong.display_title + ' by ' + currentSong.artist);
    } else {
        showResult('Try again! ' + (maxAttempts - attempts) + ' attempts remaining');
    }
}

function showResult(message) {
    document.getElementById('result').textContent = message;
}

// Start the game when page loads
loadGameData();