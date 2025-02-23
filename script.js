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
let isSubmitting = false
let gameWon = false;
let currentTimeout = null;
let difficultyGuessed = false;
let difficultyGuessResult = false;
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
    constructor() {
        this.reset();
        // Create a subtle random color variation
        const baseHue = 185; // Cyan base
        this.hue = baseHue + (Math.random() * 20 - 10); // Vary by ±10
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 0.5;
        this.speedX = Math.random() * 0.30 - 0.15;
        this.speedY = Math.random() * 0.30 - 0.15;
        this.opacity = Math.random() * 0.8 + 0.4;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 20%, 70%, ${this.opacity})`;
        ctx.fill();
    }
}

const particles = [];
const particleCount = 200;

for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    requestAnimationFrame(animate);
}

animate();

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
        gradient.addColorStop(0.5, 'rgba(0, 243, 255, 0.2)');
        gradient.addColorStop(0.6, 'rgba(0, 243, 255, 0.2)');
        gradient.addColorStop(0.8, 'rgba(0, 243, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 243, 255, 0.8)');
    } else {
        gradient.addColorStop(0, 'rgba(0, 243, 255, 0.5)');
        gradient.addColorStop(0.2, 'rgba(0, 243, 255, 0.5)');
        gradient.addColorStop(0.4, 'rgba(0, 243, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(0, 243, 255, 0.1)');
        gradient.addColorStop(0.6, 'rgba(0, 243, 255, 0.1)');
        gradient.addColorStop(0.8, 'rgba(0, 243, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 243, 255, 0.5)');
    }

    // Draw main wave with glow
    waveCtx.lineWidth = 2;
    waveCtx.strokeStyle = gradient;
    waveCtx.shadowBlur = 15;
    waveCtx.shadowColor = 'rgba(0, 243, 255, 0.3)';
    
    // Draw the wave with reduced points and controlled amplitude
    waveCtx.beginPath();
    const skipPoints = 2;
    const sliceWidth = (waveCanvas.width * skipPoints) / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i += skipPoints) {
        const v = (dataArray[i] / 128.0 - 1) * 0.5;
        const y = (v * waveCanvas.height / 4) + (waveCanvas.height / 3);
        
        if (i === 0) {
            waveCtx.moveTo(x, y);
        } else {
            waveCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    waveCtx.lineTo(waveCanvas.width, waveCanvas.height / 3);
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
    // Encode the filename to handle special characters
    const encodedFilename = encodeURIComponent(currentSong.heardle_file)
        .replace(/%23/g, '%2523'); // Specifically handle # character

    player.src = `game_audio/${encodedFilename}`;
    
    // Reset all segments
    const segments = document.querySelectorAll('.progress-segment');
    segments.forEach(segment => {
        segment.classList.remove('played', 'current', 'correct');
    });
    
    incorrectGuesses = [];
    updateGuessHistory();
    updateProgressBar();
    updateSkipButtonText(); 
}

function setupAutocomplete() {
    const input = document.getElementById('guess-input');
    const suggestionBox = document.createElement('div');
    suggestionBox.className = 'suggestion-box';
    input.parentNode.appendChild(suggestionBox);

    let selectedIndex = -1;
    let touchStartY = 0;
    let isSwiping = false;

    function toggleMobileSuggestions(show) {
        suggestionBox.style.display = show ? 'block' : 'none';
        if (!show) {
            selectedIndex = -1;
        }
    }

    input.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        if (query.length < 2) {
            toggleMobileSuggestions(false);
            return;
        }

        const suggestions = songList.filter(song => 
            song.title.toLowerCase().includes(query) || 
            song.artist.toLowerCase().includes(query) ||
            song.aliases.some(alias => alias.includes(query))
        ).slice(0, 20);

        if (suggestions.length > 0) {
            suggestionBox.innerHTML = suggestions.map(song => 
                `<div class="suggestion-item" data-title="${song.title}">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>`
            ).join('');
            toggleMobileSuggestions(true);
            selectedIndex = -1;
        } else {
            toggleMobileSuggestions(false);
        }
    });

    input.addEventListener('keydown', function(e) {
        const suggestions = suggestionBox.getElementsByClassName('suggestion-item');
        const isExtendedUpward = suggestionBox.getBoundingClientRect().top < input.getBoundingClientRect().top;
        
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            
            if (suggestions.length === 0) return;
    
            // If no selection yet, select first or last item based on direction and layout
            if (selectedIndex === -1) {
                if (e.key === 'ArrowDown') {
                    selectedIndex = 0;
                } else { // ArrowUp
                    selectedIndex = isExtendedUpward ? suggestions.length - 1 : -1;
                }
            } else {
                if (e.key === 'ArrowDown') {
                    selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                } else { // ArrowUp
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    // Allow deselection when suggestions are below the input
                    if (selectedIndex === 0 && !isExtendedUpward) {
                        selectedIndex = -1;
                    }
                }
            }
    
            updateSelection(suggestions);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                input.value = suggestions[selectedIndex].dataset.title;
                toggleMobileSuggestions(false);
                submitGuess();
                return;
            } else if (input.value.trim()) {
                submitGuess();
            }
        } else if (e.key === 'Escape') {
            toggleMobileSuggestions(false);
            input.blur();
        }
    });
    
    function updateSelection(suggestions) {
        Array.from(suggestions).forEach((suggestion, index) => {
            suggestion.classList.toggle('selected', index === selectedIndex);
            if (index === selectedIndex) {
                input.value = suggestion.dataset.title;
                suggestion.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest'
                });
            }
        });
    }

    // Touch event handlers
    suggestionBox.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
        isSwiping = false;
    }, { passive: true });

    suggestionBox.addEventListener('touchmove', function(e) {
        const touchCurrentY = e.touches[0].clientY;
        const deltaY = Math.abs(touchCurrentY - touchStartY);
        
        if (deltaY > 10) {
            isSwiping = true;
        }
    }, { passive: true });

    suggestionBox.addEventListener('touchend', function(e) {
        if (isSwiping) {
            return;
        }

        const item = e.target.closest('.suggestion-item');
        if (item) {
            e.preventDefault();
            input.value = item.dataset.title;
            toggleMobileSuggestions(false);
            submitGuess();
        }
    });

    // Click handler
    suggestionBox.addEventListener('click', function(e) {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            input.value = item.dataset.title;
            toggleMobileSuggestions(false);
            submitGuess();
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
            toggleMobileSuggestions(false);
        }
    });

    // Handle backdrop clicks on mobile
    document.addEventListener('touchend', function(e) {
        if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
            toggleMobileSuggestions(false);
        }
    });

    // Close suggestions when input loses focus
    input.addEventListener('blur', function(e) {
        setTimeout(() => {
            if (!suggestionBox.contains(document.activeElement)) {
                toggleMobileSuggestions(false);
            }
        }, 200);
    });
}

// Update the playCurrentSegment function
function playCurrentSegment() {
    if (isGameOver && !isPlaying) return;

    const player = document.getElementById('audio-player');
    const playButton = document.querySelector('.play-button');
    const progressFill = document.querySelector('.progress-fill');

    if (isPlaying) {
        player.pause();
        player.currentTime = 0;
        playButton.textContent = 'Play';
        isPlaying = false;
        progressFill.style.width = '0%';
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }

    const duration = progressDurations[attempts];

    // Reset and prepare for playback
    player.currentTime = 0;
    progressFill.style.width = '0%';

    const playPromise = player.play();
    
    if (playPromise !== undefined) {
        playPromise.then(_ => {
            playButton.textContent = 'Stop';
            isPlaying = true;

            if (!animationId && audioContext) {
                drawWave();
            }

            // Clear any existing timeout
            if (currentTimeout) {
                clearTimeout(currentTimeout);
                currentTimeout = null;
            }

            // Only set up the timer if not in reveal mode
            if (!isGameOver) {
                currentTimeout = setTimeout(() => {
                    if (isPlaying) {
                        player.pause();
                        player.currentTime = 0;
                        playButton.textContent = 'Play';
                        isPlaying = false;
                        if (animationId) {
                            cancelAnimationFrame(animationId);
                            animationId = null;
                        }
                    }
                }, duration * 1000);
            }

            // Start time for animation
            const startTime = performance.now();
            
            // Animation function
            function updateProgress(currentTime) {
                if (!isPlaying) return;
                
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / (duration * 1000), 1);
                progressFill.style.width = `${progress * (duration / 16) * 100}%`;
                
                if (progress < 1) {
                    requestAnimationFrame(updateProgress);
                }
            }
            
            requestAnimationFrame(updateProgress);
        });
    }
}


function showSongList() {
    const modal = document.getElementById('songListModal');
    const container = modal.querySelector('.song-list-container');
    
    // Sort songs alphabetically by title
    const sortedSongs = Object.values(gameData).sort((a, b) => 
        a.display_title.localeCompare(b.display_title)
    );
    
    // Create the song list HTML
    container.innerHTML = sortedSongs.map(song => {
        // Get insane levels and format them
        const levels = song.metadata?.insane_levels || [];
        const levelsHtml = levels.length > 0 
            ? `<span class="song-list-levels">${levels.join(', ')}</span>`
            : '';
            
        return `
            <div class="song-list-item">
                <div class="song-list-details">
                    <span class="song-list-title">${song.display_title}</span>
                    ${levelsHtml}
                </div>
            </div>
        `;
    }).join('');
    
    modal.style.display = 'block';
}

function closeSongList() {
    document.getElementById('songListModal').style.display = 'none';
}

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // ... other event listeners ...
    
    // Song list button listener
    document.getElementById('songListButton').addEventListener('click', showSongList);
});

function updateProgressBar(currentTime = 0, duration = 0) {
    const progressFill = document.querySelector('.progress-fill');
    const segments = document.querySelectorAll('.progress-segment');
    
    // Get the current allowed duration based on attempts
    const allowedDuration = progressDurations[attempts];
    
    // Calculate the maximum width percentage based on current attempts
    const maxWidth = (allowedDuration / 16) * 100; // 16 seconds is full song length
    
    if (currentTime > 0 && duration > 0) {
        let percentage = (currentTime / duration) * 100;
        percentage = Math.min(percentage, maxWidth);
        progressFill.style.width = `${percentage}%`;
    } else {
        progressFill.style.width = '0%';
    }

    // Don't update segments if game is won
    if (gameWon) return;

    // Clear all segment classes first
    segments.forEach(segment => {
        segment.classList.remove('played', 'current', 'correct');
    });

    // Update segments visual
    segments.forEach((segment, index) => {
        if (index < attempts) {
            segment.classList.add('played');
        } else if (index === attempts) {
            segment.classList.add('current');
        }
    });
}

function updateGuessHistory() {
    const historyDiv = document.getElementById('guess-history');
    const previousCount = historyDiv.childElementCount;
    
    historyDiv.innerHTML = incorrectGuesses.slice().reverse().map((guess, index) => {
        // Only calculate text opacity, let CSS handle the background
        const textOpacity = Math.max(0.9 - (index * 0.15), 0.2);
        return `<div class="guess-item${index === 0 && previousCount < incorrectGuesses.length ? ' new' : ''}" 
            style="color: rgba(255, 255, 255, ${textOpacity})">${guess}</div>`;
    }).join('');
}

function showModal(message, isWin = false) {
    document.getElementById('guess-input').blur();
    document.activeElement?.blur();

    const modal = document.getElementById('gameOverModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalTitle = document.querySelector('.modal-title');
    const modalContent = document.querySelector('.modal-content');
    const difficultyContainer = document.getElementById('difficultyGuessContainer');
    
    // Get the buttons
    const playAgainButton = document.querySelector('.modal-button:not(.share-button)');
    const shareButton = document.querySelector('.share-button');
    
    // Add dimmed class initially
    playAgainButton.classList.add('dimmed');
    shareButton.classList.add('dimmed');
    
    // Close any open suggestion box
    const suggestionBox = document.querySelector('.suggestion-box');
    if (suggestionBox) {
        suggestionBox.style.display = 'none';
    }

    // Remove keyboard-open class if it exists
    document.body.classList.remove('keyboard-open');

    // Remove previous classes
    modalContent.classList.remove('win', 'lose');
    
    // Force win state if gameWon is true
    isWin = isWin || gameWon;
    
    if (isWin) {
        modalTitle.textContent = 'Congratulations!';
        modalTitle.style.color = 'var(--neon-pink)';
        modalContent.classList.add('win');
        
        // Ensure the correct segment is marked
        const segments = document.querySelectorAll('.progress-segment');
        segments[attempts - 1].classList.add('correct');

        // Win message - without "The song was:"
        let fullMessage = `You guessed correctly in <b>${attempts}</b> attempt${attempts === 1 ? '' : 's'}!`;
        fullMessage += `<br><span class="song-reveal">
            <span class="song-title">${currentSong.display_title}</span><br>
            <span class="song-artist">${currentSong.cleanArtist}</span>
        </span>`;
        
        modalMessage.innerHTML = fullMessage;
    } else {
        modalTitle.textContent = 'Game Over';
        modalTitle.style.color = 'var(--neon-blue)';
        modalContent.classList.add('lose');
        
        // Loss message - keeps "The song was:"
        let fullMessage = `The song was:<br><span class="song-reveal">
            <span class="song-title">${currentSong.display_title}</span><br>
            <span class="song-artist">${currentSong.cleanArtist}</span>
        </span>`;
        
        modalMessage.innerHTML = fullMessage;
    }

    // Reset and show difficulty guessing section
    const buttons = document.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect');
        // Remove any existing click listeners
        btn.replaceWith(btn.cloneNode(true));
    });

    // Re-add click listeners to fresh buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            handleDifficultyGuess(btn.dataset.level);
            // Enable buttons after difficulty guess
            playAgainButton.classList.remove('dimmed');
            shareButton.classList.remove('dimmed');
        });
    });

    // Reset difficulty result
    const resultDiv = document.querySelector('.difficulty-result');
    resultDiv.classList.add('hidden');
    resultDiv.textContent = '';

    // Show difficulty container
    difficultyContainer.classList.remove('hidden');
    difficultyGuessed = false;
    
    modal.style.display = 'block';
    isGameOver = true;
    
    if (isWin) {
        createWinParticles();
    }
}

// Add a function to play sound effects (optional)
function playGameOverSound(isSuccess) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (isSuccess) {
        // Win sound
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.1); // A5
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    } else {
        // Lose sound
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime + 0.1); // F4
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    }
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function startNewGame() {
    gameWon = false;
    difficultyGuessed = false; // Reset difficulty guess state
    difficultyGuessResult = false
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
    
    // Clear the wave canvas
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    
    // Cancel any ongoing animation
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Clear input field
    const guessInput = document.getElementById('guess-input');
    guessInput.value = '';
    
    // Clear result message
    showResult('');
    
    // Reset difficulty guessing interface
    const difficultyContainer = document.getElementById('difficultyGuessContainer');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const difficultyResult = document.querySelector('.difficulty-result');
    
    // Reset buttons
    difficultyButtons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect');
    });
    
    // Hide difficulty result
    difficultyResult.classList.add('hidden');
    difficultyResult.textContent = '';
    
    // Hide difficulty container
    difficultyContainer.classList.add('hidden');
    
    updateProgressBar();
    updateGuessHistory();
    updateSkipButtonText(); 
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
    if (isGameOver || isSubmitting) return;
    
    isSubmitting = true;
    
    const guessInput = document.getElementById('guess-input');
    const guess = guessInput.value.trim();
    
    if (!guess) {
        isSubmitting = false;
        return;
    }
    
    const isValidTitle = songList.some(song => 
        song.title.toLowerCase() === guess.toLowerCase()
    );

    if (!isValidTitle) {
        showResult("Please select a valid song title from the suggestions");
        guessInput.value = '';
        updateSubmitButtonState();
        isSubmitting = false;
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
        attempts++;
        gameWon = true;
        
        // Clear all segment classes first
        const segments = document.querySelectorAll('.progress-segment');
        segments.forEach(segment => {
            segment.classList.remove('played', 'current');
        });
        
        // Add correct class to the winning attempt segment
        segments[attempts - 1].classList.add('correct');
        
        showModal('', true);
        revealFullSong();
        setTimeout(() => {
            setupModalEnterKey();
        }, 500);
    } else {
        const segments = document.querySelectorAll('.progress-segment');
        segments[attempts].classList.add('played');
        incorrectGuesses.push(guess);
        attempts++;
        
        if (attempts >= maxAttempts) {
            updateProgressBar();
            updateGuessHistory();
            showModal(`The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
            revealFullSong();
        } else {
            showResult(`Try again! ${maxAttempts - attempts} attempts remaining`);
            updateProgressBar();
            updateGuessHistory();
            updateSkipButtonText();
        }
    }
    
    guessInput.value = '';
    updateSubmitButtonState();
    
    setTimeout(() => {
        isSubmitting = false;
        guessInput.value = '';
        updateSubmitButtonState();
    }, 100);
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
    
    incorrectGuesses.push("▶▶");
    const segments = document.querySelectorAll('.progress-segment');
    segments[attempts].classList.add('played');
    attempts++;

    if (attempts >= maxAttempts) {
        updateProgressBar();
        updateGuessHistory();
        showModal(`The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
        revealFullSong();
    } else {
        const remainingAttempts = maxAttempts - attempts;
        const attemptsWord = remainingAttempts === 1 ? 'attempt' : 'attempts';
        showResult(`Skipped! ${remainingAttempts} ${attemptsWord} remaining`);
        updateProgressBar();
        updateGuessHistory();
        updateSkipButtonText();
    }
}

function revealFullSong() {
    // Clear any existing timeout first
    if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
    }
    
    const player = document.getElementById('audio-player');
    const playButton = document.querySelector('.play-button');
    
    console.log('Starting reveal with file:', currentSong.preview_file);
    console.log('Audio duration:', player.duration); // Add this
    
    const encodedFilename = encodeURIComponent(currentSong.preview_file)
        .replace(/%23/g, '%2523');

    player.src = `game_audio/${encodedFilename}`;
    
    player.currentTime = 0;
    
    // Add more detailed promise handling
    const playPromise = player.play();
    playPromise.then(() => {
        console.log('Preview playback started');
        console.log('New duration:', player.duration);
    }).catch(error => {
        console.error('Error playing preview:', error);
    });
    
    playButton.textContent = 'Stop';
    isPlaying = true;

    if (audioContext && !animationId) {
        drawWave();
    }
}

function updateSkipButtonText() {
    const skipButton = document.getElementById('skip-button');
    if (attempts >= maxAttempts - 1) {
        skipButton.textContent = 'Skip';
        return;
    }
    const currentDuration = progressDurations[attempts];
    const nextDuration = progressDurations[attempts + 1];
    const increase = nextDuration - currentDuration;
    skipButton.innerHTML = `SKIP (<span>+${increase}s</span>)`; // Modified this line
}

function showResult(message) {
    document.getElementById('attempts-info').textContent = message;
}


function handleDifficultyGuess(guessedLevel) {
    const actualLevels = currentSong.metadata?.insane_levels || [];
    const isCorrect = actualLevels.includes(guessedLevel);
    
    // Play the appropriate sound
    playDifficultySound(isCorrect);
    
    const buttons = document.querySelectorAll('.difficulty-btn');
    
    // Disable all buttons
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.level === guessedLevel) {
            btn.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
        if (actualLevels.includes(btn.dataset.level)) {
            setTimeout(() => {
                btn.classList.add('correct');
            }, 500);
        }
    });

    difficultyGuessResult = isCorrect;
    difficultyGuessed = true;
}

function playDifficultySound(isCorrect) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (isCorrect) {
        // Correct guess sound: higher pitched, pleasant ding
        oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime); // C6
        oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.1); // E6
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    } else {
        // Wrong guess sound: lower pitched, descending tone
        oscillator.frequency.setValueAtTime(466.16, audioContext.currentTime); // A#4
        oscillator.frequency.setValueAtTime(369.99, audioContext.currentTime + 0.1); // F#4
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    }
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function createWinParticles() {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9998';
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.background = i % 2 ? 'var(--neon-pink)' : 'var(--neon-blue)';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        
        // Give each particle a random duration and delay
        const duration = Math.random() * 1.5 + 1.5; // 1.5 to 3 seconds duration
        particle.style.animation = `particle ${duration}s ease-out`;
        
        // Remove each particle individually after its animation
        particle.addEventListener('animationend', () => {
            particle.remove();
        });
        
        container.appendChild(particle);
    }
    
    document.body.appendChild(container);
    
    // Remove container only after all particles are definitely gone
    setTimeout(() => {
        if (container.parentElement) {
            container.remove();
        }
    }, 4000);
}

async function shareResult() {
    // Debug logging
    console.log('Current attempts:', attempts);
    console.log('Game won:', gameWon);

    // Calculate emoji squares based on attempts
    const squares = Array(6).fill('⬜'); // Start with all white squares
    
    if (gameWon) {
        console.log('Generating squares for win');
        // First, fill in the red squares for wrong guesses
        for (let i = 0; i < attempts - 1; i++) {
            console.log('Adding red square at position:', i);
            squares[i] = '🟥';
        }
        
        // Then add the green square for the winning guess
        console.log('Adding green square at position:', attempts - 1);
        squares[attempts - 1] = '🟩';
    } else {
        console.log('Generating squares for loss');
        // Fill all squares up to attempts with red
        for (let i = 0; i < attempts; i++) {
            squares[i] = '🟥';
        }
    }

    console.log('Final squares array:', squares);

    // Create share text with minimalist format
    const shareText = `▸ BMS Heardle #\n${squares.join('')} | ${
        difficultyGuessed ? (difficultyGuessResult ? '⭐' : '❌') : ''
    }\n${currentSong.display_title} - ${currentSong.cleanArtist}\nhttps://skar-wem.github.io/bms-heardle/`;

    // Fallback to clipboard
    try {
        await navigator.clipboard.writeText(shareText);
        
        // Only show custom popup on desktop
        if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            const feedback = document.createElement('div');
            feedback.className = 'share-success';
            feedback.textContent = 'Copied to clipboard!';
            document.body.appendChild(feedback);
            
            setTimeout(() => feedback.style.opacity = '1', 10);
            setTimeout(() => {
                feedback.style.opacity = '0';
                setTimeout(() => feedback.remove(), 300);
            }, 2000);
        }
    } catch (err) {
        console.log('Error copying to clipboard:', err);
    }
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

    player.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded, duration:', player.duration);
    });
    
    player.addEventListener('durationchange', () => {
        console.log('Duration changed to:', player.duration);
    });
    
    player.addEventListener('ended', () => {
        console.log('Audio ended naturally at time:', player.currentTime);
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
    
    player.addEventListener('timeupdate', () => {
        if (isPlaying) {  // Remove the !isGameOver check
            console.log('Current time:', player.currentTime);
            updateProgressBar(player.currentTime, player.duration);
        }
    });
    
    player.addEventListener('pause', () => {
        console.log('Audio paused at:', player.currentTime);
    });
    
    player.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        console.log('Audio error details:', player.error);
    });

    // Add mouse tracking to submit and skip buttons
    document.querySelector('#submit-button').addEventListener('mousemove', (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.target.style.setProperty('--mouse-x', `${x}%`);
        e.target.style.setProperty('--mouse-y', `${y}%`);
    });

    document.querySelector('#skip-button').addEventListener('mousemove', (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.target.style.setProperty('--mouse-x', `${x}%`);
        e.target.style.setProperty('--mouse-y', `${y}%`);
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