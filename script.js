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
    const encodedFilename = encodeURIComponent(currentSong.heardle_file);
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

    function toggleMobileSuggestions(show) {
        // Remove the suggestions-active class handling
        // document.body.classList.toggle('suggestions-active', show);
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
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            updateSelection(suggestions);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(suggestions);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                input.value = suggestions[selectedIndex].dataset.title;
                toggleMobileSuggestions(false);
                submitGuess(); // This will be the only submission
                return; // Add this to prevent further processing
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
                // Ensure selected item is visible in scroll view
                suggestion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    suggestionBox.addEventListener('click', function(e) {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            input.value = item.dataset.title;
            toggleMobileSuggestions(false);
            submitGuess();
        }
    });

    // Handle touches on mobile
    suggestionBox.addEventListener('touchend', function(e) {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            e.preventDefault(); // Prevent any ghost clicks
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
        if (document.body.classList.contains('suggestions-active') && 
            !input.contains(e.target) && 
            !suggestionBox.contains(e.target)) {
            e.preventDefault();
            toggleMobileSuggestions(false);
        }
    });

    // Close suggestions when input loses focus
    input.addEventListener('blur', function(e) {
        // Small delay to allow for suggestion clicks
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


function updateProgressBar(currentTime = 0, duration = 0) {
    const progressFill = document.querySelector('.progress-fill');
    const segments = document.querySelectorAll('.progress-segment');
    
    // Get the current allowed duration based on attempts
    const allowedDuration = progressDurations[attempts];
    
    // Calculate the maximum width percentage based on current attempts
    const maxWidth = (allowedDuration / 16) * 100; // 16 seconds is full song length
    
    if (currentTime > 0 && duration > 0) {
        // During playback
        let percentage = (currentTime / duration) * 100;
        // Limit the percentage to the allowed duration
        percentage = Math.min(percentage, maxWidth);
        progressFill.style.width = `${percentage}%`;
    } else {
        // When not playing
        progressFill.style.width = '0%';
    }

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
    
    historyDiv.innerHTML = incorrectGuesses.map((guess, index) => 
        `<div class="guess-item${index === previousCount ? ' new' : ''}">${guess}</div>`
    ).join('');
}

function showModal(message, isSuccess = false) {
    const modal = document.getElementById('gameOverModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalTitle = document.querySelector('.modal-title');
    const modalContent = document.querySelector('.modal-content');
    
    // Debug log
    console.log('Current song metadata:', currentSong.metadata);
    
    // Remove previous classes
    modalContent.classList.remove('win', 'lose');
    
    modalTitle.textContent = isSuccess ? 'Congratulations!' : 'Game Over';
    modalTitle.style.color = isSuccess ? 'var(--neon-pink)' : 'var(--neon-blue)';
    
    // Create the message with song info and insane levels
    let fullMessage = `${message.split('The song was')[0]}`;  // Get the first part
    fullMessage += `The song was:<br><span class="song-reveal">
        <span class="song-title">${currentSong.display_title}</span>
        <span class="song-artist">${currentSong.cleanArtist}</span>
    </span>`;
    
    // Add insane levels if they exist (with debug)
    if (currentSong.metadata?.insane_levels) {
        console.log('Found insane levels:', currentSong.metadata.insane_levels);
        fullMessage += `<span class="insane-levels">${currentSong.metadata.insane_levels.join(', ')}</span>`;
    } else {
        console.log('No insane levels found');
    }
    
    // Debug log the final message
    console.log('Final modal message:', fullMessage);
    
    modalMessage.innerHTML = fullMessage;
    
    // Add animation class based on win/lose
    modalContent.classList.add(isSuccess ? 'win' : 'lose');
    
    modal.style.display = 'block';
    isGameOver = true;
    
    if (isSuccess) {
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
        return; // Don't process empty guesses
    }
    
    // Check if the guess exactly matches any song title in the list
    const isValidTitle = songList.some(song => 
        song.title.toLowerCase() === guess.toLowerCase()
    );

    if (!isValidTitle) {
        // If it's not a valid title, show a message and don't process the guess
        showResult("Please select a valid song title from the suggestions");
        guessInput.value = ''; // Clear the input
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
        attempts++; // Increment attempts first
        gameWon = true;
        const segments = document.querySelectorAll('.progress-segment');
        segments[attempts - 1].classList.add('correct'); // Use attempts - 1 here
        
        showModal(`The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`, true);
        revealFullSong();
        setTimeout(() => {
            setupModalEnterKey();
        }, 500);
    } else {
        const segments = document.querySelectorAll('.progress-segment');
        segments[attempts].classList.add('played'); // Add red color for current segment
        incorrectGuesses.push(guess);
        attempts++;
        
        if (attempts >= maxAttempts) {
            updateProgressBar(); // Add this line to update the visual state
            updateGuessHistory(); // Add this line to update history
            showModal(`The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
            revealFullSong();
        } else {
            showResult(`Try again! ${maxAttempts - attempts} attempts remaining`);
            updateProgressBar();
            updateGuessHistory();
            updateSkipButtonText();
        }
    }
    
    // Clear input and update button state immediately
    guessInput.value = '';
    updateSubmitButtonState();
    
    // Reset the submitting flag and ensure input is cleared after a short delay
    setTimeout(() => {
        isSubmitting = false;
        guessInput.value = ''; // Add another clear here to ensure it's cleared
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
    segments[attempts].classList.add('played'); // Add red color for current segment
    attempts++;

    if (attempts >= maxAttempts) {
        updateProgressBar(); // Add this line to update the visual state
        updateGuessHistory();
        showModal(`The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
        revealFullSong();
    } else {
        showResult(`Skipped! ${maxAttempts - attempts} attempts remaining`);
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
    
    const encodedFilename = encodeURIComponent(currentSong.preview_file);
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
    if (attempts >= maxAttempts - 1) { // Change to maxAttempts - 1
        skipButton.textContent = 'Skip';
        return;
    }
    const currentDuration = progressDurations[attempts];
    const nextDuration = progressDurations[attempts + 1];
    const increase = nextDuration - currentDuration;
    skipButton.textContent = `Skip (+${increase}s)`;
}

function showResult(message) {
    document.getElementById('attempts-info').textContent = message;
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
        particle.style.animation = `particle ${Math.random() * 2 + 1}s ease-out`;
        container.appendChild(particle);
    }
    
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 3000);
}

async function shareResult() {
    // Debug logging
    console.log('Current attempts:', attempts);
    console.log('Game won:', gameWon);

    // Calculate emoji squares based on attempts
    const squares = Array(6).fill('⬜'); // Start with all white squares
    
    if (gameWon) {
        console.log('Generating squares for win');
        // On second attempt: attempts would be 2
        // We want: 🟥🟩⬜⬜⬜⬜
        
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

    // Create share text
    const shareText = `BMS Heardle\n${squares.join('')}\n${currentSong.display_title} - ${currentSong.cleanArtist}\nhttps://skar-wem.github.io/bms-heardle/`;



    // Fallback to clipboard
    try {
        await navigator.clipboard.writeText(shareText);
        
        // Show feedback
        const feedback = document.createElement('div');
        feedback.className = 'share-success';
        feedback.textContent = 'Copied to clipboard!';
        document.body.appendChild(feedback);
        
        // Show and remove feedback
        setTimeout(() => feedback.style.opacity = '1', 10);
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => feedback.remove(), 300);
        }, 2000);
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