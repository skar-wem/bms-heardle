let gameData = null;
let currentSong = null;
let attempts = 0;
let songList = [];
const maxAttempts = 6;
const progressDurations = [1, 2, 4, 8, 12, 16];
let isPlaying = false;
let incorrectGuesses = [];
let isGameOver = false;
let audioContext;
let analyser;
let waveCanvas;
let waveCtx;
let animationId;

function initAudioVisualizer() {
    // Create audio context and analyzer
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    // Set up canvas
    waveCanvas = document.getElementById('waveCanvas');
    waveCtx = waveCanvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        waveCanvas.width = window.innerWidth;
        waveCanvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Connect audio to analyzer
    const audioElement = document.getElementById('audio-player');
    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
}

function drawWave() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    // Clear the canvas without changing background
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    
    // Create gradient with lower opacity in the center
    const gradient = waveCtx.createLinearGradient(0, 0, waveCanvas.width, 0);
    if (isPlaying) {
        gradient.addColorStop(0, 'rgba(0, 243, 255, 0.8)');
        gradient.addColorStop(0.2, 'rgba(0, 243, 255, 0.8)');
        gradient.addColorStop(0.4, 'rgba(0, 243, 255, 0.2)');
        gradient.addColorStop(0.5, 'rgba(255, 0, 255, 0.2)');
        gradient.addColorStop(0.6, 'rgba(0, 243, 255, 0.2)');
        gradient.addColorStop(0.8, 'rgba(0, 243, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 243, 255, 0.8)');
    } else {
        gradient.addColorStop(0, 'rgba(255, 0, 255, 0.5)');
        gradient.addColorStop(0.2, 'rgba(255, 0, 255, 0.5)');
        gradient.addColorStop(0.4, 'rgba(255, 0, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(0, 243, 255, 0.1)');
        gradient.addColorStop(0.6, 'rgba(255, 0, 255, 0.1)');
        gradient.addColorStop(0.8, 'rgba(255, 0, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 0, 255, 0.5)');
    }

    // Draw main wave with glow
    waveCtx.lineWidth = 2;
    waveCtx.strokeStyle = gradient;
    waveCtx.shadowBlur = 15;
    waveCtx.shadowColor = isPlaying ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255, 0, 255, 0.3)';
    
    // Draw the wave with reduced points and controlled amplitude
    waveCtx.beginPath();
    const skipPoints = 2;
    const sliceWidth = (waveCanvas.width * skipPoints) / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i += skipPoints) {
        const v = (dataArray[i] / 128.0 - 1) * 0.5;
        const y = (v * waveCanvas.height / 4) + (waveCanvas.height / 1.6);
        
        if (i === 0) {
            waveCtx.moveTo(x, y);
        } else {
            waveCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    waveCtx.lineTo(waveCanvas.width, waveCanvas.height / 1.6);
    waveCtx.stroke();
    
    animationId = requestAnimationFrame(drawWave);
}

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
    player.src = `game_audio/${currentSong.heardle_file}`; // Use heardle file for gameplay
    
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

// Update playCurrentSegment function
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
        
        // Cancel animation when stopped
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }

    const duration = progressDurations[attempts];

    // Reset and prepare for playback
    player.currentTime = 0;
    progressFill.style.transition = 'none';
    progressFill.style.width = '0%';
    progressFill.offsetHeight;

    // Set audio duration limit
    player.addEventListener('timeupdate', function stopAtDuration() {
        if (player.currentTime >= duration) {
            player.pause();
            player.removeEventListener('timeupdate', stopAtDuration);
            playButton.textContent = 'Play';
            isPlaying = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
    });

    const playPromise = player.play();
    
    if (playPromise !== undefined) {
        playPromise.then(_ => {
            playButton.textContent = 'Stop';
            isPlaying = true;

            // Start wave animation
            if (!animationId && audioContext) {
                drawWave();
            }

            requestAnimationFrame(() => {
                progressFill.style.transition = `width ${duration}s linear`;
                progressFill.style.width = '100%';
            });
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
    const previousCount = historyDiv.childElementCount;
    
    historyDiv.innerHTML = incorrectGuesses.map((guess, index) => 
        `<div class="guess-item${index === previousCount ? ' new' : ''}">${guess}</div>`
    ).join('');
}

function showModal(message, isSuccess = false) {
    const modal = document.getElementById('gameOverModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalTitle = document.querySelector('.modal-title');
    
    modalTitle.textContent = isSuccess ? 'Congratulations!' : 'Game Over';
    modalTitle.style.color = isSuccess ? 'var(--neon-pink)' : 'var(--neon-blue)';
    
    // Split the message at "The song was"
    const [firstPart, songPart] = message.split('The song was');
    modalMessage.innerHTML = `${firstPart}The song was:<br><span class="song-reveal">${songPart}</span>`;
    
    modal.style.display = 'block';
    isGameOver = true;
    
    // Remove the click-outside-to-close behavior
    modal.onclick = null;
}

function startNewGame() {
    const modal = document.getElementById('gameOverModal');
    modal.style.display = 'none';
    isGameOver = false;
    attempts = 0;
    incorrectGuesses = [];
    isPlaying = false;
    
    const player = document.getElementById('audio-player');
    player.pause();
    const playButton = document.querySelector('.play-button');
    playButton.textContent = 'Play';
    
    // Clear input field
    const guessInput = document.getElementById('guess-input');
    guessInput.value = '';
    
    // Clear result message
    showResult('');
    
    updateProgressBar();
    updateGuessHistory();
    startGame();
    
    // Reset submit button state
    updateSubmitButtonState();
}

function updateSubmitButtonState() {
    const guessInput = document.getElementById('guess-input');
    const submitButton = document.getElementById('submit-button');
    
    // Only update the button's internal disabled state, don't change appearance
    submitButton.disabled = !guessInput.value.trim();
    
    // Remove the button-disabled class if it exists
    submitButton.classList.remove('button-disabled');
}

function submitGuess() {
    if (isGameOver) return;
    
    const guessInput = document.getElementById('guess-input');
    const guess = guessInput.value.trim();
    
    if (!guess) return; // Don't process empty guesses
    
    // Check if the guess exactly matches any song title in the list
    const isValidTitle = songList.some(song => 
        song.title.toLowerCase() === guess.toLowerCase()
    );

    if (!isValidTitle) {
        // If it's not a valid title, show a message and don't process the guess
        showResult("Please select a valid song title from the suggestions");
        guessInput.value = ''; // Clear the input
        updateSubmitButtonState();
        return;
    }
    
    const currentAliases = processTitle(currentSong.display_title);
    const guessAliases = processTitle(guess);
    
    const isCorrect = guessAliases.some(guessAlias => 
        currentAliases.some(currentAlias => 
            currentAlias === guessAlias
        )
    );
    
    if (isCorrect) {
        const segments = document.querySelectorAll('.progress-segment');
        segments[attempts].classList.add('correct');
        
        showModal(`Correct! The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`, true);
        revealFullSong();
        // Add a delay before enabling modal Enter key
        setTimeout(() => {
            setupModalEnterKey();
        }, 500);

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
    updateSubmitButtonState();
}

function setupModalEnterKey() {
    const modalHandler = (e) => {
        if (e.key === 'Enter') {
            const modal = document.getElementById('gameOverModal');
            if (modal.style.display === 'block') {
                e.preventDefault();
                e.stopPropagation();
                startNewGame();
                // Remove this listener after use
                document.removeEventListener('keydown', modalHandler);
            }
        }
    };
    document.addEventListener('keydown', modalHandler);
}



function skipGuess() {
    if (isGameOver) return;
    
    incorrectGuesses.push("⏭️ Skipped"); // Add skip to guess history with an emoji
    attempts++;
    if (attempts >= maxAttempts) {
        showModal(`Game Over! The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
        revealFullSong();
    } else {
        showResult(`Skipped! ${maxAttempts - attempts} attempts remaining`);
        updateProgressBar();
        updateGuessHistory();  // Add this line to update the display
    }
}

function revealFullSong() {
    const player = document.getElementById('audio-player');
    const playButton = document.querySelector('.play-button');
    
    // Switch to preview file for reveal
    player.src = `game_audio/${currentSong.preview_file}`;  // Use preview file for reveal
    player.currentTime = 0;
    player.play();
    playButton.textContent = 'Stop';
    isPlaying = true;

    // Start wave animation for reveal if it exists
    if (audioContext && !animationId) {
        drawWave();
    }
}

function showResult(message) {
    document.getElementById('attempts-info').textContent = message;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Play button listener with audio context initialization
    document.getElementById('playButton').addEventListener('click', async () => {
        // Initialize audio context on first play
        if (!audioContext) {
            try {
                await initAudioVisualizer();
            } catch (e) {
                console.error('Error initializing audio visualizer:', e);
            }
        }
        playCurrentSegment();
    });
    
    // Submit button listener
    const submitButton = document.getElementById('submit-button');
    submitButton.addEventListener('click', (e) => {
        const guessInput = document.getElementById('guess-input');
        if (!guessInput.value.trim()) {  // If input is empty
            e.preventDefault();
            submitButton.classList.add('nudge');
            setTimeout(() => {
                submitButton.classList.remove('nudge');
            }, 200);
        } else {
            submitGuess();
        }
    });

    // Skip button listener
    document.getElementById('skip-button').addEventListener('click', skipGuess);

    // Guess input listeners
    const guessInput = document.getElementById('guess-input');
    guessInput.addEventListener('input', updateSubmitButtonState);

    // Input-specific Enter key handler
    guessInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !isGameOver) {
            e.preventDefault();
            e.stopPropagation();
            const guess = this.value.trim();
            if (!guess) return;

            const suggestionBox = document.querySelector('.suggestion-box');
            const selectedSuggestion = suggestionBox.querySelector('.selected');
            
            if (selectedSuggestion) {
                this.value = selectedSuggestion.dataset.title;
                suggestionBox.style.display = 'none';
                submitGuess();
            } else {
                const isValidTitle = songList.some(song => 
                    song.title.toLowerCase() === guess.toLowerCase()
                );
                
                if (isValidTitle) {
                    submitGuess();
                } else {
                    showResult("Please select a valid song title from the suggestions");
                    this.value = '';
                    updateSubmitButtonState();
                }
            }
        }
    });

    // Mobile keyboard handling
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const guessInput = document.getElementById('guess-input');
        
        // When input is focused (keyboard appears)
        guessInput.addEventListener('focus', () => {
            document.body.classList.add('keyboard-open');
        });

        // When input loses focus (keyboard disappears)
        guessInput.addEventListener('blur', () => {
            document.body.classList.remove('keyboard-open');
        });

        // Remove the scroll adjustments
        window.visualViewport.addEventListener('resize', () => {
            // Don't adjust positioning when keyboard appears
        });
    }
    
    // Modal listeners
    const modal = document.getElementById('gameOverModal');
    const modalButton = document.querySelector('.modal-button');
    modalButton.addEventListener('click', startNewGame);
    
    // Prevent modal close on click outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal && !isGameOver) {
            modal.style.display = 'none';
        }
    });
    
    // Handle window resize for canvas
    window.addEventListener('resize', () => {
        if (waveCanvas) {
            waveCanvas.width = window.innerWidth;
            waveCanvas.height = window.innerHeight;
        }
    });
    
    // Initialize audio player
    const player = document.getElementById('audio-player');
    player.addEventListener('ended', () => {
        if (!isGameOver) {
            const playButton = document.querySelector('.play-button');
            playButton.textContent = 'Play';
            isPlaying = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
    });

    document.querySelector('.play-button').addEventListener('mousemove', (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.target.style.setProperty('--mouse-x', `${x}%`);
        e.target.style.setProperty('--mouse-y', `${y}%`);
    });

    // Initialize submit button state
    updateSubmitButtonState();
    
    // Load game data
    loadGameData();
});