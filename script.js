let gameData = null;
let currentSong = null;
let previewPlayer = null;
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
let isSelectingFromSuggestions = false;
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let isDaily = true; // Default to daily mode
let dailySeed = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
let dailyAttempted = false;
let peekedAtSongList = false;
let pendingChallenge = null;
let playedSongs = [];

// Function to load played songs from localStorage
function loadPlayedSongs() {
    const storedSongs = localStorage.getItem('playedSongs');
    if (storedSongs) {
        playedSongs = JSON.parse(storedSongs);
    }
}

// Add this function to update the filtered song count
function updateFilteredSongCount() {
    const selectedLevels = JSON.parse(localStorage.getItem('selectedDifficultyLevels') || '[]');
    const hidePlayedSongs = localStorage.getItem('filterHidePlayed') === 'true';
    
    // Get language filter selections
    const allLanguagesSelected = localStorage.getItem('allLanguagesSelected') === 'true';
    const selectedLanguages = allLanguagesSelected ? [] : 
                             JSON.parse(localStorage.getItem('languageFilters') || '[]');
    
    // Count eligible songs
    let eligibleSongsCount = Object.keys(gameData).filter(songKey => {
        const song = gameData[songKey];
        const songLevels = song.metadata?.insane_levels || [];
        
        // Check if song has been played before
        const hasBeenPlayed = playedSongs.includes(songKey);
        if (hidePlayedSongs && hasBeenPlayed) {
            return false;
        }
        
        // Apply difficulty filter if any selected
        if (selectedLevels.length > 0) {
            const matchesDifficulty = songLevels.some(level => selectedLevels.includes(level));
            if (!matchesDifficulty) {
                return false;
            }
        }
        
        // Apply language filter(s)
        if (!allLanguagesSelected && selectedLanguages.length > 0) {
            const titleLanguage = detectTitleLanguage(song.display_title);
            if (!selectedLanguages.includes(titleLanguage)) {
                return false;
            }
        }
        
        return true;
    }).length;
    
    // Update the counter
    const countElement = document.getElementById('filteredSongCount');
    if (countElement) {
        countElement.textContent = `Songs: ${eligibleSongsCount}`;
        
        // Visually highlight if count is low
        if (eligibleSongsCount === 0) {
            countElement.style.color = 'var(--neon-pink)';
        } else if (eligibleSongsCount < 10) {
            countElement.style.color = '#FFAE00'; // Orange/yellow warning color
        } else {
            countElement.style.color = 'var(--text-secondary)';
        }
    }
}

// Language detection function
function detectTitleLanguage(title) {
    // Check for Japanese characters (hiragana, katakana, kanji)
    // Exclude full-width punctuation and symbols
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(title);
    
    // Check for English/Latin characters
    const hasEnglish = /[a-zA-Z]/.test(title);
    
    if (hasJapanese && hasEnglish) {
        return 'mixed';
    } else if (hasJapanese) {
        return 'japanese';
    } else if (hasEnglish) {
        return 'english';
    } else {
        // Default for titles with only numbers/symbols
        return 'other';
    }
}

// Function to save a song to played history
function saveToPlayHistory(songKey) {
    if (!playedSongs.includes(songKey)) {
        playedSongs.push(songKey);
        // Limit history to 100 songs to prevent localStorage overflow
        if (playedSongs.length > 100) {
            playedSongs = playedSongs.slice(-100);
        }
        localStorage.setItem('playedSongs', JSON.stringify(playedSongs));
    }
}

// Apply filters to get a filtered song
function getFilteredRandomSong() {
    console.log("getFilteredRandomSong called");
    
    // Get selected difficulty levels
    const selectedLevels = JSON.parse(localStorage.getItem('selectedDifficultyLevels') || '[]');
    const hidePlayedSongs = localStorage.getItem('filterHidePlayed') === 'true';
    
    // Get language filter selections
    const allLanguagesSelected = localStorage.getItem('allLanguagesSelected') === 'true';
    const selectedLanguages = allLanguagesSelected ? [] : 
                             JSON.parse(localStorage.getItem('languageFilters') || '[]');
    
    console.log("Filter values:", { selectedLevels, hidePlayedSongs, allLanguagesSelected, selectedLanguages });
    
    // Filter songs based on criteria
    let eligibleSongs = Object.keys(gameData).filter(songKey => {
        const song = gameData[songKey];
        const songLevels = song.metadata?.insane_levels || [];
        
        // Check if song has been played before
        const hasBeenPlayed = playedSongs.includes(songKey);
        if (hidePlayedSongs && hasBeenPlayed) {
            return false;
        }
        
        // Apply difficulty filter if any selected
        if (selectedLevels.length > 0) {
            const matchesDifficulty = songLevels.some(level => selectedLevels.includes(level));
            if (!matchesDifficulty) {
                return false;
            }
        }
        
        // Apply language filter(s)
        if (!allLanguagesSelected && selectedLanguages.length > 0) {
            const titleLanguage = detectTitleLanguage(song.display_title);
            if (!selectedLanguages.includes(titleLanguage)) {
                return false;
            }
        }
        
        return true;
    });
    
    console.log("Eligible songs count:", eligibleSongs.length);
    
    // If no songs match the criteria, show a message and return null
    if (eligibleSongs.length === 0) {
        console.log("No eligible songs found");
        showResult("No songs match your filters. Try different criteria.");
        return null;
    }
    
    // Select a random song from the filtered list
    const randomIndex = Math.floor(Math.random() * eligibleSongs.length);
    const selectedSong = eligibleSongs[randomIndex];
    console.log("Selected song:", selectedSong);
    return selectedSong;
}

// Add a function to check if there are active filters and update the button appearance
function updateFilterButtonAppearance() {
    const filterButton = document.getElementById('filterButton');
    if (!filterButton) return;
    
    // Get selected difficulty levels
    const difficultyButtons = document.querySelectorAll('.difficulty-filter-btn.selected');
    const selectedLevels = Array.from(difficultyButtons).map(btn => btn.dataset.level);
    
    // Get hide played state
    const hidePlayedSongs = document.getElementById('hidePlayedFilter')?.checked || false;
    
    // Get selected language filters (multiple now possible)
    const selectedLanguages = [];
    const allLanguagesSelected = document.getElementById('languageFilterAll')?.checked || false;
    
    if (!allLanguagesSelected) {
        if (document.getElementById('languageFilterEnglish')?.checked) selectedLanguages.push('english');
        if (document.getElementById('languageFilterJapanese')?.checked) selectedLanguages.push('japanese');
        if (document.getElementById('languageFilterMixed')?.checked) selectedLanguages.push('mixed');
    }
    
    // Save filter values to localStorage
    localStorage.setItem('selectedDifficultyLevels', JSON.stringify(selectedLevels));
    localStorage.setItem('filterHidePlayed', hidePlayedSongs.toString());
    
    // Save multiple language selections
    localStorage.setItem('languageFilters', JSON.stringify(selectedLanguages));
    localStorage.setItem('allLanguagesSelected', allLanguagesSelected.toString());
    
    // Check if any filters are active
    const hasActiveFilters = selectedLevels.length > 0 || 
                            hidePlayedSongs || 
                            (!allLanguagesSelected && selectedLanguages.length > 0);
    
    if (hasActiveFilters) {
        filterButton.classList.add('has-active-filters');
    } else {
        filterButton.classList.remove('has-active-filters');
    }
    updateFilteredSongCount();
}





// Apply filters and start a new game
function applyFiltersAndStart() {
    const songKey = getFilteredRandomSong();
    if (songKey) {
        // Save the new song key
        localStorage.setItem('unlimitedSongKey', songKey);
        
        // Reset game state
        attempts = 0;
        incorrectGuesses = [];
        isGameOver = false;
        gameWon = false;
        
        // Set current song
        currentSong = gameData[songKey];
        currentSong.cleanArtist = cleanupText(currentSong.artist);
        
        // Set up the audio player
        const player = document.getElementById('audio-player');
        player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
        
        // Reset the UI
        const segments = document.querySelectorAll('.progress-segment');
        segments.forEach(segment => {
            segment.classList.remove('played', 'current', 'correct');
        });
        
        updateGuessHistory();
        updateProgressBar();
        updateSkipButtonText();
        
        // Update filter button appearance
        updateFilterButtonAppearance();
        
        // Close the filter modal
        closeFilterModal();
        
        // Add song to played songs if not already there
        if (!playedSongs.includes(songKey)) {
            playedSongs.push(songKey);
            localStorage.setItem('playedSongs', JSON.stringify(playedSongs));
        }
        
        showResult("Filters applied. New song loaded!");
    }
}

// Reset all filters to default
function resetFilters() {
    console.log("resetFilters called");
    
    // Deselect all difficulty buttons
    const difficultyButtons = document.querySelectorAll('.difficulty-filter-btn');
    difficultyButtons.forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Set hide played checkbox to true (default)
    const hidePlayedFilter = document.getElementById('hidePlayedFilter');
    hidePlayedFilter.checked = true;
    
    // Reset language filter to "all"
    document.getElementById('languageFilterAll').checked = true;
    document.getElementById('languageFilterEnglish').checked = false;
    document.getElementById('languageFilterJapanese').checked = false;
    document.getElementById('languageFilterMixed').checked = false;
    
    // Save reset state to localStorage
    localStorage.setItem('selectedDifficultyLevels', '[]');
    localStorage.setItem('filterHidePlayed', 'true');
    localStorage.setItem('allLanguagesSelected', 'true');
    localStorage.setItem('languageFilters', '[]');
    
    // Update filter button appearance
    updateFilterButtonAppearance();
    
    // Update the count after reset
    updateFilteredSongCount();
    
    showResult("Filters reset");
}

// Add language checkbox event handlers
function initializeLanguageFilters() {
    // Handle language filter checkboxes special behavior
    const allLanguageCheckbox = document.getElementById('languageFilterAll');
    const languageCheckboxes = document.querySelectorAll('input[name="languageFilter"]:not(#languageFilterAll)');
    
    // When "All" is clicked
    allLanguageCheckbox.addEventListener('change', function() {
        if (this.checked) {
            // Uncheck all other language options
            languageCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        } else {
            // If unchecking "All" with nothing else selected, re-check it
            const anyOtherChecked = Array.from(languageCheckboxes).some(checkbox => checkbox.checked);
            if (!anyOtherChecked) {
                this.checked = true;
            }
        }
        updateFilterButtonAppearance();
    });
    
    // When any other language option is clicked
    languageCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                // If checking a specific language, uncheck "All"
                allLanguageCheckbox.checked = false;
            } else {
                // If unchecking and no other specific languages are checked, check "All"
                const anyOtherChecked = Array.from(languageCheckboxes).some(cb => cb.checked && cb !== this);
                if (!anyOtherChecked) {
                    allLanguageCheckbox.checked = true;
                }
            }
            updateFilterButtonAppearance();
        });
    });
}

// Load saved language filters
function loadSavedLanguageFilters() {
    const allLanguagesSelected = localStorage.getItem('allLanguagesSelected') === 'true';
    const selectedLanguages = JSON.parse(localStorage.getItem('languageFilters') || '[]');
    
    // Set checkbox states based on saved values
    document.getElementById('languageFilterAll').checked = allLanguagesSelected;
    document.getElementById('languageFilterEnglish').checked = selectedLanguages.includes('english');
    document.getElementById('languageFilterJapanese').checked = selectedLanguages.includes('japanese');
    document.getElementById('languageFilterMixed').checked = selectedLanguages.includes('mixed');
}


// Show play history modal
function showPlayHistory() {
    const modal = document.getElementById('playHistoryModal');
    const container = document.querySelector('.play-history-container');
    const modalContent = modal.querySelector('.modal-content');
    
    // Clear previous content
    container.innerHTML = '';
    
    // Add Clear History button in the top left
    const clearHistoryBtn = document.createElement('button');
    clearHistoryBtn.className = 'clear-history-btn';
    clearHistoryBtn.innerHTML = '<i class="fas fa-trash"></i> Clear History';
    clearHistoryBtn.addEventListener('click', clearPlayHistory);
    
    // Add X close button in the top right
    let closeBtn = modalContent.querySelector('.modal-close-x');
    if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close-x';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = function(e) { 
            closePlayHistory(e); 
        };
        modalContent.appendChild(closeBtn);
    }
    
    // Add clear history button to the top left
    let headerContainer = modalContent.querySelector('.history-header');
    if (!headerContainer) {
        // Create header container if it doesn't exist
        headerContainer = document.createElement('div');
        headerContainer.className = 'history-header';
        
        // Get the modal title
        const modalTitle = modalContent.querySelector('.modal-title');
        
        // Insert header before the title
        modalContent.insertBefore(headerContainer, modalTitle);
    } else {
        // Clear existing header
        headerContainer.innerHTML = '';
    }
    
    // Add clear button to header
    headerContainer.appendChild(clearHistoryBtn);
    
    // If no played songs, show message
    if (playedSongs.length === 0) {
        container.innerHTML = '<div class="empty-history-message">No play history yet</div>';
        modal.style.display = 'block';
        return;
    }
    
    // Populate with played songs (most recent first)
    const historyHTML = playedSongs.slice().reverse().map(songKey => {
        if (!gameData[songKey]) return ''; // Skip if song doesn't exist
        
        const song = gameData[songKey];
        const levels = song.metadata?.insane_levels || [];
        const levelsHtml = levels.length > 0 
            ? `<span class="play-history-difficulty">${levels.join(', ')}</span>`
            : '';
        
        return `
            <div class="play-history-item" data-song-key="${songKey}">
                <div class="play-history-details">
                    <div class="play-history-title">${song.display_title}</div>
                    <div class="play-history-artist">${cleanupText(song.artist)}${levelsHtml}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = historyHTML;
    modal.style.display = 'block';
}

function clearPlayHistory(e) {
    e.stopPropagation();
    
    if (confirm('Are you sure you want to clear your play history?')) {
        // Clear the played songs array
        playedSongs = [];
        
        // Save the empty array to localStorage
        localStorage.setItem('playedSongs', JSON.stringify(playedSongs));
        
        // Refresh the play history display
        showPlayHistory();
        
        // Show confirmation message
        showResult("Play history has been cleared");
    }
}

// Close play history modal
function closePlayHistory() {
    console.log("closePlayHistory called");
    const modal = document.getElementById('playHistoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.closeSongList = closeSongList;
window.closePlayHistory = closePlayHistory;

// Play a song again from history
function playAgainFromHistory(songKey) {
    if (!gameData[songKey]) {
        showResult("Song not found");
        return;
    }
    
    // Switch to unlimited mode if in daily mode
    if (isDaily) {
        isDaily = false;
        document.getElementById('dailyModeBtn').classList.remove('active');
        document.getElementById('unlimitedModeBtn').classList.add('active');
        updateFilterVisibility();
    }
    
    // Save the song key
    localStorage.setItem('unlimitedSongKey', songKey);
    
    // Reset game state
    attempts = 0;
    incorrectGuesses = [];
    isGameOver = false;
    gameWon = false;
    
    // Set current song
    currentSong = gameData[songKey];
    currentSong.cleanArtist = cleanupText(currentSong.artist);
    
    // Set up the audio player
    const player = document.getElementById('audio-player');
    player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
    
    // Reset the UI
    const segments = document.querySelectorAll('.progress-segment');
    segments.forEach(segment => {
        segment.classList.remove('played', 'current', 'correct');
    });
    
    updateGuessHistory();
    updateProgressBar();
    updateSkipButtonText();
    
    showResult("Playing selected song");
}

function getDailySong() {
    // Create a deterministic random number based on the date
    const dateStr = dailySeed;
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }

    hash -= 287;
    
    // Use the hash to select a song
    const songs = Object.keys(gameData);
    const index = Math.abs(hash) % songs.length;
    return songs[index];
  }
  
// Add this function to save the current game state
function saveGameState() {
    if (!isGameOver) {
        const gameState = {
            attempts: attempts,
            incorrectGuesses: incorrectGuesses,
            isDaily: isDaily,
            dailySeed: dailySeed,
            dailyAttempted: dailyAttempted,
            peekedAtSongList: peekedAtSongList
        };
        
        // For daily mode, save to a specific key
        if (isDaily) {
            localStorage.setItem('dailyGameState', JSON.stringify(gameState));
        } else {
            // For unlimited mode, save to a different key
            localStorage.setItem('unlimitedGameState', JSON.stringify(gameState));
            
            // Also save the current song key for unlimited mode
            // Find the key for the current song
            const songKey = Object.keys(gameData).find(key => 
                gameData[key].display_title === currentSong.display_title);
                
            if (songKey) {
                localStorage.setItem('unlimitedSongKey', songKey);
            }
        }
    }
}

// Add this function to load saved game state
function loadGameState() {
    // Determine which state to load based on current mode
    const savedStateKey = isDaily ? 'dailyGameState' : 'unlimitedGameState';
    const savedState = localStorage.getItem(savedStateKey);
    
    if (savedState) {
        const gameState = JSON.parse(savedState);
        
        // Only restore state if it matches the current game mode
        if (gameState.isDaily === isDaily) {
            console.log(`Loading saved ${isDaily ? 'daily' : 'unlimited'} game state:`, gameState);
            attempts = gameState.attempts || 0;
            incorrectGuesses = gameState.incorrectGuesses || [];
            dailySeed = gameState.dailySeed || new Date().toISOString().slice(0, 10);
            dailyAttempted = gameState.dailyAttempted || false;
            peekedAtSongList = gameState.peekedAtSongList || false;
            
            // Debug logging
            console.log(`Loaded state - attempts: ${attempts}, guesses: ${incorrectGuesses.length}`);
            
            // Update UI to reflect loaded state
            updateGuessHistory();
            updateProgressBar();
            updateSkipButtonText();
            return true; // Return true to indicate state was loaded
        }
    }
    return false; // Return false to indicate no state was loaded
}



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
        // Initialize with a random hue
        this.hue = Math.random() * 10;
        this.hueChange = (Math.random() * 2 - 1) * 0.2; // Subtle color change speed
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1 + 0.5; // Keeping your original size
        this.speedX = Math.random() * 0.30 - 0.15;
        this.speedY = Math.random() * 0.30 - 0.15;
        this.opacity = Math.random() * 1 + 0.8; // Keeping your original opacity
        this.saturation = Math.random() * 30 + 50; // 50-80% saturation
        this.lightness = Math.random() * 20 + 60; // 60-80% lightness
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Update the hue for color changing effect
        this.hue += this.hueChange;
        if (this.hue > 360) this.hue = 0;
        if (this.hue < 0) this.hue = 360;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.opacity})`;
        ctx.fill();
    }
}

const particles = [];
const particleCount = 300; // Keeping your particle count

for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Keeping your background fade
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


function generateChallengeLink(songKey) {
    try {
        // Find the index of the song in the gameData object
        const songKeys = Object.keys(gameData);
        const songIndex = songKeys.indexOf(songKey);
        
        if (songIndex === -1) {
            throw new Error('Song not found');
        }
        
        // Create data with the index instead of the full key
        const timestamp = Date.now();
        const challengeData = {
            i: songIndex, // Using 'i' instead of 'songKey' - much shorter
            t: timestamp  // Using 't' instead of 'timestamp' - shorter
        };
        
        // Encode the data
        const jsonString = JSON.stringify(challengeData);
        const encodedData = btoa(jsonString);
        
        // Generate the full URL
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?c=${encodedData}`; // Using 'c' instead of 'challenge'
    } catch (error) {
        console.error('Error generating challenge link:', error);
        throw new Error('Failed to generate challenge link');
    }
}

// Function to handle incoming challenge
function handleChallenge(songKey) {
    console.log("Handling challenge for song key:", songKey);
    
    // Switch to challenge mode
    isDaily = false;
    
    // Get the center controls container where mode buttons are
    const centerControls = document.querySelector('.center-controls');
    if (centerControls) {
        // Store the original content so we can restore it later
        if (!centerControls.hasAttribute('data-original-content')) {
            centerControls.setAttribute('data-original-content', centerControls.innerHTML);
        }
        
        // Replace mode buttons with challenge banner
        centerControls.innerHTML = '<div class="challenge-banner"><span>👑 Friend Challenge Mode 👑</span></div>';
    }
    
    // Override the normal song selection and load the challenge song
    if (gameData[songKey]) {
        console.log("Setting current song to:", gameData[songKey].display_title);
        currentSong = gameData[songKey];
        currentSong.cleanArtist = cleanupText(currentSong.artist);
        
        // Set up the audio player
        const player = document.getElementById('audio-player');
        player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
        
        // Reset game state
        attempts = 0;
        incorrectGuesses = [];
        isGameOver = false;
        gameWon = false;
        
        // Update UI
        updateGuessHistory();
        updateProgressBar();
        updateSkipButtonText();
        
        // Show confirmation message in the attempts info area instead of a popup
        showResult("Challenge loaded: Can you guess this song?");
    } else {
        console.error('Challenge song not found:', songKey);
        showResult("Challenge song not found. Starting a random game instead.");
        startNewGame();
    }
}
  
// Helper function to show messages
function showMessage(message) {
    console.log("Showing message:", message);
    
    // Remove any existing messages first
    const existingMessages = document.querySelectorAll('.game-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageEl = document.createElement('div');
    messageEl.className = 'game-message';
    messageEl.textContent = message;
    document.querySelector('.container').prepend(messageEl);
    
    // Make sure the message is visible
    messageEl.style.opacity = '1';
    
    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 500);
    }, 3000);
}

function processTitle(title) {
    let aliases = [title.toLowerCase()];
    
    // Create a direct mapping for special characters
    const specialCharMap = {
        'Δ': 'delta',
        'ΔΔ': 'deltadelta',
        '△': 'triangle',
        '○': 'circle',
        '□': 'square',
        'ω': 'omega'
    };

    // Special handling for specific titles
    if (title === "-+") {
        aliases.push("minus plus", "minusplus", "-plus", "minus+");
    }
    else if (title === "ΔΔ") {
        aliases.push("deltadelta", "aa", "triangles");
    }
    else if (title.startsWith("#")) {
        // Handle titles starting with #
        const numberPart = title.substring(1);
        aliases.push(numberPart);
        aliases.push("number " + numberPart);
        aliases.push("no " + numberPart);
        aliases.push("no" + numberPart);
    }
    else if (title.includes("Act #")) {
        // Handle "Act #" format
        const numberPart = title.split("#")[1];
        aliases.push("act" + numberPart);
        aliases.push("act " + numberPart);
    }

    // Handle special character replacement
    let normalizedTitle = title;
    Object.entries(specialCharMap).forEach(([special, normal]) => {
        if (title.includes(special)) {
            normalizedTitle = title.replace(new RegExp(special, 'g'), normal);
            aliases.push(normalizedTitle.toLowerCase());
        }
    });

    // Remove spaces
    aliases.push(title.toLowerCase().replace(/\s+/g, ''));
    
    // Remove special characters (but keep letters and numbers)
    const alphanumeric = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (alphanumeric) {
        aliases.push(alphanumeric);
    }
    
    // Handle spaced letters (e.g., "g e n g a o z o" -> "gengaozo")
    if (title.includes(' ')) {
        let spacedVersion = title.toLowerCase().replace(/\s+/g, '');
        if (spacedVersion) {
            aliases.push(spacedVersion);
        }
    }
    
    // Remove duplicates and empty strings
    return [...new Set(aliases)].filter(alias => alias && alias.trim());
}

// When handling file paths, modify the encoding:
function encodeFilename(filename) {
    return encodeURIComponent(filename)
        .replace(/%23/g, '%2523') // Handle # character
        .replace(/\+/g, '%2B')    // Handle + character
        .replace(/\-/g, '%2D');   // Handle - character
}


function cleanupText(text) {
    try {
        // Try common encodings
        if (text.includes('Š') || text.includes('ƒ') || text.includes('}')) {
            text = decodeURIComponent(escape(text));
        }
        
        // Define allowed special characters
        const allowedChars = ['○', '△', '□', 'ω'];
        const allowedCharsRegex = new RegExp(`[^\\x00-\\x7F\\u3000-\\u9FFF${allowedChars.join('')}]`, 'g');
        
        // Remove any characters except:
        // - Basic ASCII (\x00-\x7F)
        // - Japanese characters (\u3000-\u9FFF)
        // - Specifically allowed characters
        text = text.replace(allowedCharsRegex, '');
        
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

        // Load played songs history
        loadPlayedSongs();
        
        songList = Object.values(gameData).map(song => ({
            title: song.display_title,
            artist: cleanupText(song.artist),
            aliases: [
                ...processTitle(song.display_title),
                ...(song.alias || []).flatMap(alias => processTitle(alias))
            ]
        }));
        
        document.getElementById('song-count').textContent = Object.keys(gameData).length;
        setupAutocomplete();
        
        // Process any pending challenge after game data is loaded
        if (pendingChallenge) {
            console.log("Processing pending challenge...");
            try {
                // Now it's safe to decode and process the challenge
                // Use a try-catch block specifically for the decoding step
                let decodedData;
                try {
                    // First try regular decoding
                    decodedData = atob(pendingChallenge);
                    // If successful, try to parse JSON
                    JSON.parse(decodedData);
                } catch (decodeError) {
                    // If regular decoding fails, try with URI decoding
                    console.log("Standard decoding failed, trying URI decoding");
                    decodedData = decodeURIComponent(atob(pendingChallenge));
                }
                
                // Now parse the JSON data
                const challengeData = JSON.parse(decodedData);
                console.log("Challenge data:", challengeData);
                
                // Check if this is the new format (with index) or old format (with songKey)
                let songKey;
                
                if ('i' in challengeData) {
                    // New format with song index
                    const songKeys = Object.keys(gameData);
                    songKey = songKeys[challengeData.i];
                    console.log("Using new format challenge with index:", challengeData.i);
                } else if ('songKey' in challengeData) {
                    // Old format with explicit song key
                    songKey = challengeData.songKey;
                    console.log("Using old format challenge with songKey");
                } else {
                    throw new Error('Challenge data missing song information');
                }
                
                // Get timestamp (supports both t and timestamp fields)
                const challengeTime = challengeData.t || challengeData.timestamp;
                if (!challengeTime) {
                    throw new Error('Challenge data missing timestamp');
                }
                
                // Validate timestamp
                const now = Date.now();
                const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
                
                if (now - challengeTime > expirationTime) {
                    showResult("This challenge has expired. Try a new one!");
                } else if (songKey && gameData[songKey]) {
                    console.log("Found challenge song:", gameData[songKey].display_title);
                    // Now it's safe to handle the challenge
                    handleChallenge(songKey);
                    pendingChallenge = null; // Clear the challenge after handling it
                    return; // Don't start a normal game if we're handling a challenge
                } else {
                    console.error("Challenge song not found for key:", songKey);
                    showResult("Challenge song not found. Starting a new game.");
                }
            } catch (error) {
                console.error('Invalid challenge link:', error);
                showResult("Invalid challenge link. Starting a new game.");
            }
            
            // Clear the pending challenge
            pendingChallenge = null;
        }
        
        // Only start a normal game if we're not handling a challenge
        startGame();
    } catch (error) {
        console.error('Error loading game data:', error);
        document.getElementById('result').textContent = 'Error loading game data: ' + error.message;
    }
}

// Modify startGame function to load saved state
function startGame() {
    // First, check if we're in daily mode
    if (isDaily) {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().slice(0, 10);
        
        // Set the dailySeed to today's date
        dailySeed = today;
        
        // Check if user has played today's challenge
        const lastPlayed = localStorage.getItem('lastDailyPlayed');
        dailyAttempted = lastPlayed === dailySeed;
        
        // If they've already completed today's challenge, show message and switch to unlimited mode
        if (dailyAttempted) {
            // Show their previous result instead of an alert
            showDailyResultModal();
            return; // Exit the function to prevent starting a new game
        } else {
            // Check if we have a saved state for today's game
            const savedSongKey = localStorage.getItem('dailySongKey');
            const savedDate = localStorage.getItem('dailySongDate');
            
            // If we have a saved song for today, use it
            if (savedSongKey && savedDate === dailySeed) {
                currentSong = gameData[savedSongKey];
            } else {
                // Otherwise, get today's song and save it
                const dailySongKey = getDailySong();
                currentSong = gameData[dailySongKey];
                
                // Save today's song key and date
                localStorage.setItem('dailySongKey', dailySongKey);
                localStorage.setItem('dailySongDate', dailySeed);
                
                // Reset game state when starting with a new song
                attempts = 0;
                incorrectGuesses = [];
            }
            
            // Set the clean artist name
            currentSong.cleanArtist = cleanupText(currentSong.artist);
            
            // Set up the audio player
            const player = document.getElementById('audio-player');
            player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
            
            // Try to load saved game state
            const stateLoaded = loadGameState();
            
            // If no state was loaded, we need to initialize a fresh state
            if (!stateLoaded) {
                // Reset all segments
                const segments = document.querySelectorAll('.progress-segment');
                segments.forEach(segment => {
                    segment.classList.remove('played', 'current', 'correct');
                });
                
                // Update UI with initial state
                updateGuessHistory();
                updateProgressBar();
                updateSkipButtonText();
                
                // Save initial state to ensure we have something to load next time
                saveGameState();
            }
        }
    } else {
        // In unlimited mode, check if we have a saved song
        const unlimitedSongKey = localStorage.getItem('unlimitedSongKey');
        
        if (unlimitedSongKey && gameData[unlimitedSongKey]) {
            currentSong = gameData[unlimitedSongKey];
        } else {
            // Generate a new random song
            const songs = Object.keys(gameData);
            const randomSong = songs[Math.floor(Math.random() * songs.length)];
            currentSong = gameData[randomSong];
            
            // Save the new song key
            localStorage.setItem('unlimitedSongKey', randomSong);
            
            // Reset game state when starting with a new song
            attempts = 0;
            incorrectGuesses = [];
        }
        
        // Set the clean artist name
        currentSong.cleanArtist = cleanupText(currentSong.artist);
        
        // Set up the audio player
        const player = document.getElementById('audio-player');
        player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
        
        // Try to load saved game state
        const stateLoaded = loadGameState();
        
        // If no state was loaded, we need to initialize a fresh state
        if (!stateLoaded) {
            // Reset all segments
            const segments = document.querySelectorAll('.progress-segment');
            segments.forEach(segment => {
                segment.classList.remove('played', 'current', 'correct');
            });
            
            // Update UI with initial state
            updateGuessHistory();
            updateProgressBar();
            updateSkipButtonText();
            
            // Save initial state to ensure we have something to load next time
            saveGameState();
        }
    }
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
        
        // No suggestions for empty input
        if (!query) {
            toggleMobileSuggestions(false);
            return;
        }
    
        let suggestions;
        
        // Special handling for single character input
        if (query.length === 1) {
            // Check for exact single-character matches first
            const exactMatches = songList.filter(song => 
                song.title.toLowerCase() === query ||   // For Latin characters like "Q"
                song.title === this.value              // For exact kanji matches like "天"
            );
            
            if (exactMatches.length > 0) {
                suggestions = exactMatches;
            } else if (query.length < 2) {
                toggleMobileSuggestions(false);
                return;
            } else {
                // Regular filtering for non-exact matches
                suggestions = songList.filter(song => 
                    song.title.toLowerCase().includes(query) || 
                    song.artist.toLowerCase().includes(query) ||
                    song.aliases.some(alias => alias.includes(query))
                );
            }
        } else {
            // Regular behavior for 2+ characters
            suggestions = songList.filter(song => 
                song.title.toLowerCase().includes(query) || 
                song.artist.toLowerCase().includes(query) ||
                song.aliases.some(alias => alias.includes(query))
            );
        }
    
        // Limit suggestions and update display
        suggestions = suggestions.slice(0, 20);
    
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
                isSelectingFromSuggestions = true;
                input.value = suggestions[selectedIndex].dataset.title;
                toggleMobileSuggestions(false);
                // Reset the flag after a short delay
                setTimeout(() => {
                    isSelectingFromSuggestions = false;
                }, 100);
                return;
            } else if (input.value.trim() && !isSelectingFromSuggestions) {
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
            input.focus(); // Keep focus on input
            updateSubmitButtonState(); // Update submit button state
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

// Handle song item click in the song list
function handleSongItemClick(item) {
    const container = document.querySelector('.song-list-container');
    
    // Check if this is the currently playing song
    const isSameSong = previewPlayer.dataset.currentSong === item.dataset.preview;
    
    // If the same song is currently playing, just stop it
    if (!previewPlayer.paused && isSameSong) {
        previewPlayer.pause();
        previewPlayer.currentTime = 0;
        previewPlayer.dataset.currentSong = '';
        item.classList.remove('playing');
        return;
    }
    
    // Remove playing class from all items
    container.querySelectorAll('.song-list-item').forEach(i => {
        i.classList.remove('playing');
    });

    // Stop any currently playing preview
    if (!previewPlayer.paused) {
        previewPlayer.pause();
        previewPlayer.currentTime = 0;
    }

    // Add playing class to clicked item
    item.classList.add('playing');

    // Play new preview
    const encodedFilename = encodeURIComponent(item.dataset.preview)
        .replace(/%23/g, '%2523');
    
    previewPlayer.src = `game_audio/${encodedFilename}`;
    previewPlayer.dataset.currentSong = item.dataset.preview;

    // Remove playing class when audio ends
    previewPlayer.onended = () => {
        item.classList.remove('playing');
        previewPlayer.dataset.currentSong = '';
    };

    // Also remove playing class if audio is stopped
    previewPlayer.onpause = () => {
        item.classList.remove('playing');
    };

    // Play the audio with better error handling
    const playPromise = previewPlayer.play();
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error("Error playing audio:", error);
            item.classList.remove('playing');
        });
    }
}

// Filter songs based on search and difficulty inputs
function filterSongs() {
    const searchInput = document.getElementById('songSearchInput');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const searchTerm = searchInput.value;
    const difficultyLevel = difficultyFilter.value;

    // Only process search term if it exists
    const searchAliases = searchTerm ? processTitle(searchTerm) : [''];

    return Object.values(gameData).filter(song => {
        // Get all possible matches for the song title and aliases
        const titleAliases = processTitle(song.display_title);
        const songAliases = song.alias ? song.alias.flatMap(alias => processTitle(alias)) : [];
        const artistAliases = song.artist ? processTitle(song.artist) : [];
        
        // Check if any search term matches any of the song's variations
        const matchesSearch = searchAliases.some(searchAlias =>
            titleAliases.some(titleAlias => titleAlias.includes(searchAlias)) ||
            songAliases.some(songAlias => songAlias.includes(searchAlias)) ||
            artistAliases.some(artistAlias => artistAlias.includes(searchAlias))
        );

        // Apply difficulty filter if selected
        if (!difficultyLevel || !song.metadata?.insane_levels) {
            return matchesSearch;
        }

        return matchesSearch && song.metadata.insane_levels.includes(difficultyLevel);
    });
}

// Update the song list display based on filters
// Update the song list display based on filters
function updateSongList() {
    const container = document.querySelector('.song-list-container');
    // Store currently playing song info
    const currentlyPlaying = previewPlayer?.dataset.currentSong;

    const filteredSongs = filterSongs().sort((a, b) => 
        a.display_title.localeCompare(b.display_title));

    container.innerHTML = filteredSongs.map(song => {
        const levels = song.metadata?.insane_levels || [];
        const levelsHtml = levels.length > 0 
            ? `<span class="song-list-levels">${levels.join(', ')}</span>`
            : '';
        
        // Add playing class if this song is currently playing
        const isPlaying = song.preview_file === currentlyPlaying;
        const playingClass = isPlaying ? 'playing' : '';
        
        // Find song key for challenge link generation
        const songKey = Object.keys(gameData).find(key => gameData[key].display_title === song.display_title);
            
        return `
            <div class="song-list-item ${playingClass}" data-preview="${song.preview_file}">
                <div class="song-list-details">
                    <span class="song-list-title">${song.display_title}</span>
                    ${levelsHtml}
                </div>
                <div class="song-list-actions">
                    <button class="challenge-icon" data-song-key="${songKey}" title="Challenge a friend with this song">
                        <i class="fas fa-crown"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add click event listeners to all song items
    container.querySelectorAll('.song-list-item').forEach(item => {
        // Make the entire item clickable for song playback
        item.addEventListener('click', (e) => {
            // Don't handle click if it was on the challenge button
            if (!e.target.closest('.challenge-icon')) {
                handleSongItemClick(item);
            }
        });
        
        // Handle challenge button click
        const challengeBtn = item.querySelector('.challenge-icon');
        if (challengeBtn) {
            challengeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the song play
                const songKey = challengeBtn.dataset.songKey;
                if (songKey) {
                    createSongChallenge(songKey);
                }
            });
        }
    });
}

// Create a challenge from a selected song
function createSongChallenge(songKey) {
    if (!songKey || !gameData[songKey]) {
        console.error('Invalid song key for challenge:', songKey);
        return;
    }
    
    try {
        // Generate the challenge link
        const challengeLink = generateChallengeLink(songKey);
        
        // Get song title and safely encode it for display
        const songTitle = gameData[songKey].display_title;
        const safeTitle = document.createElement('div');
        safeTitle.textContent = songTitle; // This safely encodes HTML entities
        
        // Create a mini modal to show the challenge options
        const challengeModal = document.createElement('div');
        challengeModal.className = 'challenge-mini-modal';
        challengeModal.innerHTML = `
            <div class="challenge-mini-content">
                <h3>Challenge a Friend</h3>
                <p>Send this link to challenge someone to guess this song:</p>
                <div class="song-title-preview">${safeTitle.innerHTML}</div>
                <div class="challenge-link-container">
                    <input type="text" class="challenge-link-input" value="${challengeLink}" readonly>
                    <button class="copy-link-btn"><i class="fas fa-copy"></i> Copy</button>
                </div>
                <button class="close-mini-modal"><i class="fas fa-times"></i></button>
            </div>
        `;
        
        document.body.appendChild(challengeModal);
        
        // Select the link input for easy copying
        const linkInput = challengeModal.querySelector('.challenge-link-input');
        linkInput.select();
        
        // Add event listener for the copy button
        challengeModal.querySelector('.copy-link-btn').addEventListener('click', () => {
            linkInput.select();
            document.execCommand('copy');
            
            // Show success message
            const copyBtn = challengeModal.querySelector('.copy-link-btn');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            
            // Show message in the game area too
            showResult("Challenge link copied to clipboard!");
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        });
        
        // Close button
        challengeModal.querySelector('.close-mini-modal').addEventListener('click', () => {
            challengeModal.remove();
        });
        
        // Close when clicking outside
        challengeModal.addEventListener('click', (e) => {
            if (e.target === challengeModal) {
                challengeModal.remove();
            }
        });
    } catch (error) {
        console.error('Error creating challenge:', error);
        showResult("Couldn't create challenge. Please try another song.");
    }
}

// Show filter modal
function showFilterModal() {
    const modal = document.getElementById('filterModal');
    if (modal) {
        // Add X close button if it doesn't exist
        let closeBtn = modal.querySelector('.modal-close-x');
        if (!closeBtn) {
            const modalContent = modal.querySelector('.modal-content');
            closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close-x';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = function(e) { 
                closeFilterModal(e); 
            };
            modalContent.appendChild(closeBtn);
        }
        
        // Load selected difficulty levels from localStorage
        const selectedLevels = JSON.parse(localStorage.getItem('selectedDifficultyLevels') || '[]');
        
        // Load language filter selections
        loadSavedLanguageFilters();

        // Update button states based on selected levels
        const difficultyButtons = document.querySelectorAll('.difficulty-filter-btn');
        difficultyButtons.forEach(btn => {
            btn.classList.toggle('selected', selectedLevels.includes(btn.dataset.level));
        });
        
        // Load hide played filter state
        const hidePlayedFilter = document.getElementById('hidePlayedFilter');
        hidePlayedFilter.checked = localStorage.getItem('filterHidePlayed') === 'true';
        
        // Initialize language filter event handlers if not already done
        initializeLanguageFilters();

        // Add click handlers for difficulty buttons if not already added
        difficultyButtons.forEach(btn => {
            // Remove existing listeners by cloning and replacing
            const newBtn = btn.cloneNode(true);
            newBtn.addEventListener('click', function() {
                this.classList.toggle('selected');
                updateFilterButtonAppearance();
            });
            btn.parentNode.replaceChild(newBtn, btn);
        });
        
        // Update the song count when the modal opens
        updateFilteredSongCount();
        
        // Make the modal visible
        modal.style.display = 'block';
    }
}

// Close filter modal
function closeFilterModal(event) {
    if (event) {
        event.stopPropagation();
    }
    const modal = document.getElementById('filterModal');
    if (modal) {
        modal.style.display = 'none';
    }
}


// Make these functions available globally
window.closeFilterModal = closeFilterModal;
window.showFilterModal = showFilterModal;
window.applyFiltersAndStart = applyFiltersAndStart;
window.resetFilters = resetFilters;


// Main function to show the song list modal
function showSongList() {
    // Set the peeked flag if in daily mode and game is not over
    if (isDaily && !isGameOver) {
        peekedAtSongList = true;
        console.log('User peeked at song list during daily challenge');
    }
    
    const modal = document.getElementById('songListModal');
    const modalContent = modal.querySelector('.modal-content');
    const searchInput = document.getElementById('songSearchInput');
    const difficultyFilter = document.getElementById('difficultyFilter');

    // Add X close button in the top right
    let closeBtn = modalContent.querySelector('.modal-close-x');
    if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close-x';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = function(e) { 
            closeSongList(e); 
        };
        modalContent.appendChild(closeBtn);
    }

    // Create a new audio element for previews if it doesn't exist
    if (!previewPlayer) {
        previewPlayer = new Audio();
    }
    
    // Add event listeners for filters
    searchInput.addEventListener('input', updateSongList);
    difficultyFilter.addEventListener('change', updateSongList);
    
    // Clear any existing filter values
    searchInput.value = '';
    difficultyFilter.value = '';
    
    // Initial song list display
    updateSongList();
    modal.style.display = 'block';
    
    // Hide the original close button
    const originalCloseButton = modal.querySelector('.modal-button');
    if (originalCloseButton) {
        originalCloseButton.style.display = 'none';
    }
}

// Close the song list modal
function closeSongList() {
    console.log("closeSongList called");
    const modal = document.getElementById('songListModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Stop preview playback
        if (previewPlayer && !previewPlayer.paused) {
            previewPlayer.pause();
            previewPlayer.currentTime = 0;
            previewPlayer.dataset.currentSong = '';
            
            // Remove playing class from all items
            const container = modal.querySelector('.song-list-container');
            if (container) {
                container.querySelectorAll('.song-list-item').forEach(i => {
                    i.classList.remove('playing');
                });
            }
        }
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
    const modalTitle = modal.querySelector('.modal-title'); // Now specific to game over modal
    const modalContent = modal.querySelector('.modal-content'); // Now specific to game over modal
    const difficultyContainer = document.getElementById('difficultyGuessContainer');
    
    // Check if this was a challenge and restore mode buttons (using centerControls approach)
    const centerControls = document.querySelector('.center-controls');
    if (centerControls && centerControls.querySelector('.challenge-banner')) {
        // Restore the original mode buttons
        if (centerControls.hasAttribute('data-original-content')) {
            centerControls.innerHTML = centerControls.getAttribute('data-original-content');
        }
        
        // Update the active mode button
        document.getElementById('dailyModeBtn').classList.remove('active');
        document.getElementById('unlimitedModeBtn').classList.add('active');
    }

    // Also check for any standalone challenge banner (fallback)
    const challengeBanner = document.querySelector('.challenge-banner:not(.center-controls .challenge-banner)');
    if (challengeBanner) {
        // Remove the standalone challenge banner
        challengeBanner.remove();
        
        // Show the mode buttons if they were hidden
        const modeButtons = document.querySelector('.center-controls');
        if (modeButtons) {
            modeButtons.style.display = 'flex';
        }
        
        // Update the active mode button
        document.getElementById('dailyModeBtn').classList.remove('active');
        document.getElementById('unlimitedModeBtn').classList.add('active');
    }

    // If in unlimited mode, save the song to play history
    if (!isDaily) {
        // Find the key for the current song
        const songKey = Object.keys(gameData).find(key => 
            gameData[key].display_title === currentSong.display_title);
            
        if (songKey) {
            saveToPlayHistory(songKey);
        }
    }
    
    // Get the buttons
    const playAgainButton = document.getElementById('playAgainButton');
    const shareButton = document.getElementById('shareButton');
    
    // Show or hide share button based on game mode
    if (isDaily) {
        shareButton.style.display = 'inline-block'; // Show for daily mode
    } else {
        shareButton.style.display = 'none'; // Hide for unlimited mode
    }
    
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
    
    // Calculate daily challenge number if in daily mode
    let dailyHeader = '';
    if (isDaily) {
        // Record daily play if this is the first attempt today
        if (!dailyAttempted) {
            localStorage.setItem('lastDailyPlayed', dailySeed);
            localStorage.setItem('dailyResult', isWin ? attempts : 'X');
            dailyAttempted = true;
        }
        
        // Calculate the challenge number
        const startDate = new Date('2025-03-06'); // Adjust this to your actual start date
        const currentDate = new Date(dailySeed);
        const dayDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        dailyHeader = `<div class="daily-header">Daily Challenge #${dayDiff}</div>`;
    }
    
    if (isWin) {
        // Set the title for win condition
        modalTitle.textContent = 'Congratulations!';
        modalTitle.style.color = '#00ffb3'; // Green color for win
        modalContent.classList.add('win');
        
        // Ensure the correct segment is marked
        const segments = document.querySelectorAll('.progress-segment');
        segments[attempts - 1].classList.add('correct');

        // Win message - without "The song was:"
        let fullMessage = `${dailyHeader}You guessed correctly in <b>${attempts}</b> attempt${attempts === 1 ? '' : 's'}!`;
        fullMessage += `<br><span class="song-reveal">
            <span class="song-title">${currentSong.display_title}</span><br>
            <span class="song-artist">${currentSong.cleanArtist}</span>
        </span>`;
        
        // Add stats if in daily mode
        if (isDaily) {
            const stats = getDailyStats();
            fullMessage += `<div class="daily-stats">
                <div class="stat-item">
                    <span class="stat-label">Played</span>
                    <span class="stat-value">${stats.played}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Win %</span>
                    <span class="stat-value">${stats.winPercentage}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Streak</span>
                    <span class="stat-value">${stats.currentStreak}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Max Streak</span>
                    <span class="stat-value">${stats.maxStreak}</span>
                </div>
            </div>`;
        }
        
        modalMessage.innerHTML = fullMessage;
    } else {
        // Set the title for loss condition
        modalTitle.textContent = 'Game Over';
        modalTitle.style.color = '#ff0055'; // Red color for loss
        modalContent.classList.add('lose');
        
        // Loss message - keeps "The song was:"
        let fullMessage = `${dailyHeader}The song was:<br><span class="song-reveal">
            <span class="song-title">${currentSong.display_title}</span><br>
            <span class="song-artist">${currentSong.cleanArtist}</span>
        </span>`;
        
        // Add stats if in daily mode
        if (isDaily) {
            const stats = getDailyStats();
            fullMessage += `<div class="daily-stats">
                <div class="stat-item">
                    <span class="stat-label">Played</span>
                    <span class="stat-value">${stats.played}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Win %</span>
                    <span class="stat-value">${stats.winPercentage}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Streak</span>
                    <span class="stat-value">${stats.currentStreak}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Max Streak</span>
                    <span class="stat-value">${stats.maxStreak}</span>
                </div>
            </div>`;
        }
        
        modalMessage.innerHTML = fullMessage;
    }

    // Check if the user has already guessed the difficulty
    // For daily mode, we check localStorage, for unlimited we use the difficultyGuessed variable
    let hasGuessedDifficulty = false;
    if (isDaily) {
        hasGuessedDifficulty = localStorage.getItem('difficultyGuessResult_' + dailySeed) !== null;
        
        // If they've guessed before, update our local state
        if (hasGuessedDifficulty) {
            difficultyGuessed = true;
            difficultyGuessResult = localStorage.getItem('difficultyGuessResult_' + dailySeed) === 'true';
        }
    } else {
        hasGuessedDifficulty = difficultyGuessed;
    }

    // Only show difficulty guessing if they haven't guessed yet
    if (!hasGuessedDifficulty) {
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
            });
        });

        // Reset difficulty result
        const resultDiv = document.querySelector('.difficulty-result');
        resultDiv.classList.add('hidden');
        resultDiv.textContent = '';

        // Show difficulty container
        difficultyContainer.classList.remove('hidden');
    } else {
        // They've already guessed, hide the container
        difficultyContainer.classList.add('hidden');
    }
    
    // Display the modal
    modal.style.display = 'block';
    isGameOver = true;
    
    if (isWin) {
        createWinParticles();
    }
    
    // If in daily mode, update the Play Again button text to reflect mode
    if (playAgainButton) {
        if (isDaily) {
            playAgainButton.textContent = "Play Unlimited";
            playAgainButton.onclick = function() {
                isDaily = false;
                document.getElementById('dailyModeBtn').classList.remove('active');
                document.getElementById('unlimitedModeBtn').classList.add('active');
                updateFilterVisibility(); // Add this to update filter visibility
                startNewGame();
            };
        } else {
            playAgainButton.textContent = "Play Again";
            playAgainButton.onclick = startNewGame;
        }
    }
    
    // Set up share button
    if (shareButton) {
        shareButton.onclick = shareResult;
    }
}


    // Add this helper function to calculate and update daily stats
    function getDailyStats() {
        // Get stored stats or initialize defaults
        const statsJson = localStorage.getItem('dailyStats') || '{}';
        let stats = JSON.parse(statsJson);
        
        if (!stats.played) {
            stats = {
                played: 0,
                wins: 0,
                currentStreak: 0,
                maxStreak: 0,
                lastPlayed: null,
                history: []
            };
        }
        
        // Get today's result
        const todayResult = localStorage.getItem('dailyResult');
        const isWin = todayResult && todayResult !== 'X';
        
        // Only update stats if this is a new play (not just viewing results again)
        if (dailySeed !== stats.lastPlayed) {
            stats.played++;
            stats.lastPlayed = dailySeed;
            
            // Check if consecutive day
            const yesterday = new Date(dailySeed);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);
            const isConsecutiveDay = stats.lastPlayed === yesterdayStr;
            
            if (isWin) {
                stats.wins++;
                if (isConsecutiveDay || stats.currentStreak === 0) {
                    stats.currentStreak++;
                } else {
                    stats.currentStreak = 1; // Reset streak if not consecutive
                }
                
                stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
            } else {
                stats.currentStreak = 0; // Reset streak on loss
            }
            
            // Add to history
            stats.history.push({
                date: dailySeed,
                result: todayResult
            });
            
            // Save updated stats
            localStorage.setItem('dailyStats', JSON.stringify(stats));
        }
        
        // Calculate win percentage
        const winPercentage = stats.played > 0 
            ? Math.round((stats.wins / stats.played) * 100) 
            : 0;
        
        return {
            played: stats.played,
            wins: stats.wins,
            winPercentage: winPercentage,
            currentStreak: stats.currentStreak,
            maxStreak: stats.maxStreak,
            history: stats.history
        };
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

    // Remove any challenge banner and restore mode buttons
    const challengeBanner = document.querySelector('.challenge-banner');
    if (challengeBanner) {
        challengeBanner.remove();
        
        // Show the mode buttons again
        const modeButtons = document.querySelector('.center-controls');
        if (modeButtons) {
            modeButtons.style.display = 'flex';
        }
    }

    // If there was a current song and game is over, save it to history
    if (currentSong && !isDaily) {
        // Find the key for the current song
        const songKey = Object.keys(gameData).find(key => 
            gameData[key].display_title === currentSong.display_title);
            
        if (songKey) {
            saveToPlayHistory(songKey);
        }
    }
    // Reset all game state variables
    gameWon = false;
    difficultyGuessed = false;
    difficultyGuessResult = false;
    isGameOver = false;
    attempts = 0;
    incorrectGuesses = [];
    isPlaying = false;
    isSubmitting = false; // Add this to reset submission state
    
    // Reset audio player
    const player = document.getElementById('audio-player');
    player.pause();
    player.currentTime = 0;
    const playButton = document.querySelector('.play-button');
    playButton.textContent = 'Play';
    
    // Clear any ongoing timeouts
    if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
    }
    
    // Clear the wave canvas
    if (waveCtx) {
        waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    }
    
    // Cancel any ongoing animation
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Reset input and suggestions
    const guessInput = document.getElementById('guess-input');
    guessInput.value = '';
    const suggestionBox = document.querySelector('.suggestion-box');
    if (suggestionBox) {
        suggestionBox.style.display = 'none';
    }
    
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
    if (difficultyResult) {
        difficultyResult.classList.add('hidden');
        difficultyResult.textContent = '';
    }
    
    // Hide difficulty container
    if (difficultyContainer) {
        difficultyContainer.classList.add('hidden');
    }
    
    // Reset progress segments
    const segments = document.querySelectorAll('.progress-segment');
    segments.forEach(segment => {
        segment.classList.remove('played', 'current', 'correct');
    });
    
    // Reset progress bar
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = '0%';
    }
    
    // Reset modal
    const modal = document.getElementById('gameOverModal');
    modal.style.display = 'none';
    
    // Reset guess history
    updateGuessHistory();
    
    // Reset progress bar and skip button
    updateProgressBar();
    updateSkipButtonText();
    
    // Reset submit button state
    updateSubmitButtonState();
    
    // Clear saved game state
    if (isDaily) {
        localStorage.removeItem('dailyGameState');
    } else {
        localStorage.removeItem('unlimitedGameState');
        localStorage.removeItem('unlimitedSongKey');
    }
    
    // For unlimited mode, use the filtered song selection
    if (!isDaily) {
        const songKey = getFilteredRandomSong();
        if (songKey) {
            localStorage.setItem('unlimitedSongKey', songKey);
            currentSong = gameData[songKey];
            currentSong.cleanArtist = cleanupText(currentSong.artist);
            
            // Set up the audio player
            const player = document.getElementById('audio-player');
            player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
            
            // Update UI
            updateGuessHistory();
            updateProgressBar();
            updateSkipButtonText();
            return; // Exit the function since we've set up everything
        }
    }
    // Start new game
    startGame();
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
    
    const isValidTitle = songList.some(song => {
        // Check against the main title
        if (song.title.toLowerCase() === guess.toLowerCase()) {
            return true;
        }
        
        // Check against aliases if they exist in the song data
        const songData = Object.values(gameData).find(data => 
            data.display_title.toLowerCase() === song.title.toLowerCase()
        );
        
        if (songData?.alias) {
            return songData.alias.some(alias => 
                alias.toLowerCase() === guess.toLowerCase()
            );
        }
        
        return false;
    });

    if (!isValidTitle) {
        showResult("Please select a valid song title from the suggestions");
        guessInput.value = '';
        updateSubmitButtonState();
        isSubmitting = false;
        return;
    }
    
    const currentAliases = [
        ...processTitle(currentSong.display_title),
        ...(currentSong.alias || []).map(alias => alias.toLowerCase())
    ];
    const guessAliases = processTitle(guess);
    
    // Debug logging
    console.log('Current song:', currentSong.display_title);
    console.log('Current aliases:', currentAliases);
    console.log('Guess:', guess);
    console.log('Guess aliases:', guessAliases);
    
    const isCorrect = guessAliases.some(guessAlias => 
        currentAliases.some(currentAlias => 
            currentAlias === guessAlias ||
            (currentSong.alias && 
             currentSong.alias.some(alias => 
                 alias.toLowerCase() === guessAlias
             ))
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
        
        // Clear saved game state since game is over
        if (isDaily) {
            localStorage.removeItem('dailyGameState');
        } else {
            localStorage.removeItem('unlimitedGameState');
        }
        
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
            
            // Clear saved game state since game is over
            if (isDaily) {
                localStorage.removeItem('dailyGameState');
            } else {
                localStorage.removeItem('unlimitedGameState');
            }
            
            showModal(`The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
            revealFullSong();
        } else {
            showResult(`Try again! ${maxAttempts - attempts} attempts remaining`);
            updateProgressBar();
            updateGuessHistory();
            updateSkipButtonText();
            
            // Save game state after changes
            saveGameState();
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
        
        // Clear saved game state since game is over
        if (isDaily) {
            localStorage.removeItem('dailyGameState');
        } else {
            localStorage.removeItem('unlimitedGameState');
        }
        
        showModal(`The song was "${currentSong.display_title}" by ${currentSong.cleanArtist}`);
        revealFullSong();
    } else {
        const remainingAttempts = maxAttempts - attempts;
        const attemptsWord = remainingAttempts === 1 ? 'attempt' : 'attempts';
        showResult(`Skipped! ${remainingAttempts} ${attemptsWord} remaining`);
        updateProgressBar();
        updateGuessHistory();
        updateSkipButtonText();
        
        // Save game state after changes
        saveGameState();
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
    console.log('Audio duration:', player.duration);
    
    player.src = `game_audio/${encodeFilename(currentSong.preview_file)}`;
    
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
    const isMystery = actualLevels.includes("★???");
    
    // For regular songs, check if guess matches actual level
    // For mystery songs (★???), any guess is considered "correct" for stats
    const isCorrect = isMystery ? true : actualLevels.includes(guessedLevel);
    
    if (isDaily) {
        localStorage.setItem('difficultyGuessResult_' + dailySeed, isCorrect.toString());
    }

    // If it's a mystery song, handle the special reveal
    if (isMystery) {
        handleMysteryDifficultyReveal(guessedLevel);
    } else {
        // Regular handling for normal difficulty songs
        
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
    }

    difficultyGuessResult = isCorrect;
    difficultyGuessed = true;
}

// Add this function to handle the special case for ★??? songs
function handleMysteryDifficultyReveal(guessedLevel) {
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const difficultyResult = document.querySelector('.difficulty-result');
    
    // First, show the user's selection
    difficultyButtons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.level === guessedLevel) {
            btn.classList.add('selected');
        }
    });
    
    // Play a special "mystery" sound if available, otherwise use the "correct" sound
    playDifficultySound(true);
    
    // Wait a moment, then do the special reveal animation
    setTimeout(() => {
        // Flash all buttons with question marks
        difficultyButtons.forEach(btn => {
            // Store original text
            btn.setAttribute('data-original-text', btn.textContent);
            
            // Add the flashing class
            btn.classList.add('mystery-flash');
            
            // Change text to question marks
            btn.textContent = '???';
        });
        
        // After the flash animation, reveal the mystery status
        setTimeout(() => {
            // Remove flashing class and restore original text
            difficultyButtons.forEach(btn => {
                btn.classList.remove('mystery-flash');
                btn.classList.remove('selected');
                btn.textContent = btn.getAttribute('data-original-text');
            });
            
            // Show the special message
            difficultyResult.classList.remove('hidden');
            difficultyResult.innerHTML = `
                <div class="mystery-result">
                    <p><span class="mystery-rating">★???</span></p>
                    <p class="mystery-explanation">These special songs don't fit into the standard difficulty scale.</p>
                </div>
            `;
            
            // Add special visual to the result
            difficultyResult.classList.add('mystery-result-container');
            
        }, 1500); // Duration of question mark display
    }, 800); // Delay before starting the animation
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

function showDailyResultModal() {
    // Get the stored result
    const result = localStorage.getItem('dailyResult');
    const isWin = result && result !== 'X';
    const attemptCount = isWin ? parseInt(result) : 6;
    
    // Check if the user peeked at song list during their play
    const didPeek = localStorage.getItem('peekedAtSongList_' + dailySeed) === 'true';
    peekedAtSongList = didPeek;

    // Get the difficulty guess result if it exists
    const difficultyResult = localStorage.getItem('difficultyGuessResult_' + dailySeed);
    const hasGuessedDifficulty = difficultyResult !== null;
    
    if (hasGuessedDifficulty) {
        difficultyGuessed = true;
        difficultyGuessResult = difficultyResult === 'true';
    } else {
        difficultyGuessed = false;
    }

    // Store the attempt count globally for sharing
    attempts = attemptCount;
    gameWon = isWin;
    
    // Get the daily song information
    const dailySongKey = localStorage.getItem('dailySongKey');
    if (!dailySongKey || !gameData[dailySongKey]) {
        console.error('Could not find daily song information');
        return;
    }
    
    const dailySong = gameData[dailySongKey];
    
    // Set up the current song for the modal to use
    currentSong = dailySong;
    currentSong.cleanArtist = cleanupText(currentSong.artist);
    
    // Display the modal with the previous result
    const modal = document.getElementById('gameOverModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalTitle = modal.querySelector('.modal-title'); // Specific to game over modal
    const modalContent = modal.querySelector('.modal-content'); // Specific to game over modal
    const difficultyContainer = document.getElementById('difficultyGuessContainer');
    
    // Get the buttons
    const playAgainButton = modal.querySelector('.modal-button:not(.share-button)');
    const shareButton = modal.querySelector('.share-button');
    
    // Make sure modal is in the DOM before proceeding
    if (!modal || !modalContent) {
        console.error('Game over modal elements not found');
        return;
    }
    
    // Remove previous classes
    modalContent.classList.remove('win', 'lose');
    
    // Add the appropriate class
    modalContent.classList.add(isWin ? 'win' : 'lose');
    
    // Calculate the challenge number
    const startDate = new Date('2025-03-06');
    const currentDate = new Date(dailySeed);
    const dayDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Store the day number in the global dailySeed variable
    // This ensures shareResult() will use the correct day number
    dailySeed = currentDate.toISOString().slice(0, 10);
    
    const dailyHeader = `<div class="daily-header">Daily Challenge #${dayDiff}</div>`;
    
    // Set the title
    if (isWin) {
        modalTitle.textContent = 'Congratulations!';
        modalTitle.style.color = 'var(--neon-pink)';
        
        // Win message
        let fullMessage = `${dailyHeader}You guessed correctly in <b>${attempts}</b> attempt${attempts === 1 ? '' : 's'}!`;
        fullMessage += `<br><span class="song-reveal">
            <span class="song-title">${currentSong.display_title}</span><br>
            <span class="song-artist">${currentSong.cleanArtist}</span>
        </span>`;
        
        // Add stats
        const stats = getDailyStats();
        fullMessage += `<div class="daily-stats">
            <div class="stat-item">
                <span class="stat-label">Played</span>
                <span class="stat-value">${stats.played}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Win %</span>
                <span class="stat-value">${stats.winPercentage}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Streak</span>
                <span class="stat-value">${stats.currentStreak}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Max Streak</span>
                <span class="stat-value">${stats.maxStreak}</span>
            </div>
        </div>`;
        
        modalMessage.innerHTML = fullMessage;
    } else {
        modalTitle.textContent = 'Game Over';
        modalTitle.style.color = 'var(--neon-blue)';
        
        // Loss message
        let fullMessage = `${dailyHeader}The song was:<br><span class="song-reveal">
            <span class="song-title">${currentSong.display_title}</span><br>
            <span class="song-artist">${currentSong.cleanArtist}</span>
        </span>`;
        
        // Add stats
        const stats = getDailyStats();
        fullMessage += `<div class="daily-stats">
            <div class="stat-item">
                <span class="stat-label">Played</span>
                <span class="stat-value">${stats.played}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Win %</span>
                <span class="stat-value">${stats.winPercentage}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Streak</span>
                <span class="stat-value">${stats.currentStreak}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Max Streak</span>
                <span class="stat-value">${stats.maxStreak}</span>
            </div>
        </div>`;
        
        modalMessage.innerHTML = fullMessage;
    }
    
    // Only show difficulty container if they haven't guessed yet
    if (!hasGuessedDifficulty) {
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
            });
        });

        // Reset difficulty result
        const resultDiv = document.querySelector('.difficulty-result');
        resultDiv.classList.add('hidden');
        resultDiv.textContent = '';

        // Show difficulty container
        difficultyContainer.classList.remove('hidden');
    } else {
        // They've already guessed, hide the container
        difficultyContainer.classList.add('hidden');
    }
    
    // Display the modal before updating buttons to ensure they exist in the DOM
    modal.style.display = 'block';
    isGameOver = true;
    
    
    // Make sure share button is visible
    if (shareButton) {
        shareButton.style.display = 'inline-block';
        shareButton.onclick = shareResult;
    }
    
    // Update the Play Again button
    if (playAgainButton) {
        console.log('Setting daily modal button to "Play Unlimited" by ID');
        
        // Create a new button element to replace the old one (to remove any existing listeners)
        const newButton = document.createElement('button');
        newButton.id = 'playAgainButton';
        newButton.className = 'modal-button';
        newButton.innerHTML = 'Play Unlimited';
        
        // Add the click event to the new button
        newButton.addEventListener('click', function() {
            isDaily = false;
            document.getElementById('dailyModeBtn').classList.remove('active');
            document.getElementById('unlimitedModeBtn').classList.add('active');
            updateFilterVisibility();
            startNewGame();
        });
        
        // Replace the old button with the new one
        playAgainButton.parentNode.replaceChild(newButton, playAgainButton);
    } else {
        // Fallback to querySelector if ID selector fails
        console.log('Play Again button not found by ID, trying class selector');
        const fallbackButton = document.querySelector('.modal-button:not(.share-button)');
        
        if (fallbackButton) {
            // Create a new button to replace the old one
            const newButton = document.createElement('button');
            newButton.className = 'modal-button';
            newButton.innerHTML = 'Play Unlimited';
            
            // Add the click event to the new button
            newButton.addEventListener('click', function() {
                isDaily = false;
                document.getElementById('dailyModeBtn').classList.remove('active');
                document.getElementById('unlimitedModeBtn').classList.add('active');
                updateFilterVisibility();
                startNewGame();
            });
            
            // Replace the old button with the new one
            fallbackButton.parentNode.replaceChild(newButton, fallbackButton);
        } else {
            console.error('Could not find Play Again button by any selector');
        }
    }
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


window.closeSongList = function(event) {
    // Stop event propagation
    if (event) {
        event.stopPropagation();
    }
    
    console.log('closeSongList called');
    const modal = document.getElementById('songListModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Stop preview playback
        if (previewPlayer && !previewPlayer.paused) {
            previewPlayer.pause();
            previewPlayer.currentTime = 0;
            previewPlayer.dataset.currentSong = '';
        }
    }
};

window.closePlayHistory = function(event) {
    // Stop event propagation
    if (event) {
        event.stopPropagation();
    }
    
    console.log('closePlayHistory called');
    const modal = document.getElementById('playHistoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

async function shareResult() {
    // Debug logging
    console.log('Current attempts:', attempts);
    console.log('Game won:', gameWon);

    // Store the peeking state if this is a daily challenge
    if (isDaily && peekedAtSongList) {
        localStorage.setItem('peekedAtSongList_' + dailySeed, 'true');
    }

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

    // Calculate daily challenge number if in daily mode
    let dailyNumber = '';
    if (isDaily) {
        const startDate = new Date('2025-03-06'); // Use the same start date as in showModal
        const currentDate = new Date(dailySeed);
        const dayDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        dailyNumber = dayDiff.toString();
    }

    // Create share text with minimalist format
    // Only add divider and difficulty result if difficulty was guessed
    const difficultyPart = difficultyGuessed ? ` | ${difficultyGuessResult ? '⭐' : '❌'}` : '';
    const peekedEmoji = (isDaily && peekedAtSongList) ? '🤓 ' : '';
    const shareText = `▸ BMS Heardle #${dailyNumber}\n${squares.join('')}${difficultyPart} ${peekedEmoji}\nhttps://skar.fun/bms/`;

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

function setupModalOutsideClicks() {
    // For Song List Modal
    const songListModal = document.getElementById('songListModal');
    if (songListModal) {
        songListModal.addEventListener('click', function(e) {
            // Check if the click is on the modal background (not the content)
            if (e.target === songListModal) {
                window.closeSongList();
            }
        });
    }
    
    // For Play History Modal
    const playHistoryModal = document.getElementById('playHistoryModal');
    if (playHistoryModal) {
        playHistoryModal.addEventListener('click', function(e) {
            // Check if the click is on the modal background (not the content)
            if (e.target === playHistoryModal) {
                window.closePlayHistory();
            }
        });
    }

    const filterModal = document.getElementById('filterModal');
    if (filterModal) {
        filterModal.addEventListener('click', function(e) {
            // Check if the click is on the modal background (not the content)
            if (e.target === filterModal) {
                window.closeFilterModal();
            }
        });
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupModalOutsideClicks();
    // Check for challenge parameter in URL - Store it for processing after data loads
    const urlParams = new URLSearchParams(window.location.search);
    const challengeParam = urlParams.get('c'); // Changed from 'challenge' to 'c'
    
    if (challengeParam) {
        // Store the challenge parameter in a global variable for later processing
        pendingChallenge = challengeParam;
        
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Add listeners for filter changes
    const minDifficultyFilter = document.getElementById('minDifficultyFilter');
    const maxDifficultyFilter = document.getElementById('maxDifficultyFilter');
    const hidePlayedFilter = document.getElementById('hidePlayedFilter');
    
    if (minDifficultyFilter) {
        minDifficultyFilter.addEventListener('change', updateFilterButtonAppearance);
    }
    
    if (maxDifficultyFilter) {
        maxDifficultyFilter.addEventListener('change', updateFilterButtonAppearance);
    }
    
    if (hidePlayedFilter) {
        hidePlayedFilter.addEventListener('change', updateFilterButtonAppearance);
    }


    // Initialize volume control - YOUR EXISTING CODE STARTS HERE
    const volumeIcon = document.querySelector('.volume-control i');
    const volumeSlider = document.querySelector('.volume-slider');
    const previewPlayer = document.querySelector('#previewPlayer');
    
    function updateVolume(value) {
        if (previewPlayer) previewPlayer.volume = value / 100;
        
        if (value === 0) {
            volumeIcon.className = 'fas fa-volume-mute';
        } else if (value < 50) {
            volumeIcon.className = 'fas fa-volume-down';
        } else {
            volumeIcon.className = 'fas fa-volume-up';
        }
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            updateVolume(e.target.value);
        });

        let previousVolume = 100;
        volumeIcon.addEventListener('click', () => {
            if (volumeSlider.value > 0) {
                previousVolume = volumeSlider.value;
                volumeSlider.value = 0;
            } else {
                volumeSlider.value = previousVolume;
            }
            updateVolume(volumeSlider.value);
        });

        updateVolume(volumeSlider.value);
    }

    // Filter button event listener
    const filterButton = document.getElementById('filterButton');
    if (filterButton) {
        // Initial state - disabled if in daily mode
        if (isDaily) {
            filterButton.classList.add('disabled');
        } else {
            filterButton.classList.remove('disabled');
            filterButton.classList.add('active');
            // Initialize filter button appearance
            updateFilterButtonAppearance();
        }
        
        filterButton.addEventListener('click', function() {
            // This will only execute in unlimited mode due to pointer-events: none in disabled state
            showFilterModal();
        });
    }
    
    // Filter modal outside click
    const filterModal = document.getElementById('filterModal');
    if (filterModal) {
        filterModal.addEventListener('click', function(e) {
            if (e.target === filterModal) {
                closeFilterModal();
            }
        });
    }
    
    // Apply and reset filter buttons
    const applyFiltersBtn = document.getElementById('applyFilters');
    const resetFiltersBtn = document.getElementById('resetFilters');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFiltersAndStart);
    }
    
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetFilters);
    }

    // DEVELOPMENT ONLY - Remove before production
    document.getElementById('devResetBtn')?.addEventListener('click', () => {
        localStorage.removeItem('lastDailyPlayed');
        localStorage.removeItem('dailyResult');
        localStorage.removeItem('dailySongKey');
        localStorage.removeItem('dailySongDate');
        alert("Daily challenge reset");
        location.reload();
    });

    // Game mode toggle listeners
    document.getElementById('dailyModeBtn').addEventListener('click', () => {
        if (!isDaily) {
            // Stop any currently playing audio
            const player = document.getElementById('audio-player');
            const playButton = document.querySelector('.play-button');
            
            if (isPlaying) {
                player.pause();
                player.currentTime = 0;
                playButton.textContent = 'Play';
                isPlaying = false;
                
                // Reset progress bar
                const progressFill = document.querySelector('.progress-fill');
                progressFill.style.width = '0%';
                                
                // Stop wave animation if it's running
                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
            }
            
            const filterBtn = document.getElementById('filterButton');
            if (filterBtn) {
                filterBtn.classList.add('disabled');
                filterBtn.classList.remove('active');
                filterBtn.classList.remove('has-active-filters');
            }
    
            // First save the current unlimited mode state if not completed
            if (!isGameOver) {
                // Save the current state to unlimited storage
                const unlimitedGameState = {
                    attempts: attempts,
                    incorrectGuesses: incorrectGuesses,
                    isDaily: false,
                    dailySeed: dailySeed,
                    peekedAtSongList: peekedAtSongList
                };
                localStorage.setItem('unlimitedGameState', JSON.stringify(unlimitedGameState));
                console.log('Saved unlimited game state before switching to daily');
            }
            
            // Switch to daily mode
            isDaily = true;
            document.getElementById('dailyModeBtn').classList.add('active');
            document.getElementById('unlimitedModeBtn').classList.remove('active');
            
            // Reset game state variables for the new mode
            attempts = 0;
            incorrectGuesses = [];
            isGameOver = false;
            gameWon = false;
            
            // Check if there's a completed daily challenge for today
            const today = new Date().toISOString().slice(0, 10);
            const lastPlayed = localStorage.getItem('lastDailyPlayed');
            
            if (lastPlayed === today) {
                // Show completed daily challenge
                dailyAttempted = true;
                dailySeed = today;
                showDailyResultModal();
            } else {
                // Check if we have a saved daily game state
                const savedDailyState = localStorage.getItem('dailyGameState');
                
                if (savedDailyState) {
                    // Parse the saved state
                    const gameState = JSON.parse(savedDailyState);
                    
                    // Make sure it's for today (in case it's an old state)
                    if (gameState.dailySeed === today) {
                        console.log('Found saved daily game state for today:', gameState);
                        
                        // Restore the state
                        attempts = gameState.attempts;
                        incorrectGuesses = gameState.incorrectGuesses;
                        dailySeed = gameState.dailySeed;
                        peekedAtSongList = gameState.peekedAtSongList;
                        
                        // Load the daily song
                        const savedSongKey = localStorage.getItem('dailySongKey');
                        if (savedSongKey && gameData[savedSongKey]) {
                            currentSong = gameData[savedSongKey];
                            currentSong.cleanArtist = cleanupText(currentSong.artist);
                            
                            // Set up the audio player
                            const player = document.getElementById('audio-player');
                            player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
                            
                            // Update UI to reflect loaded state
                            console.log('Restoring daily game with attempts:', attempts);
                            updateGuessHistory();
                            updateProgressBar();
                            updateSkipButtonText();
                        } else {
                            console.log('Could not find saved song, starting new game');
                            startNewGame();
                        }
                    } else {
                        console.log('Saved daily state is for a different day, starting new game');
                        startNewGame();
                    }
                } else {
                    console.log('No saved daily game state, starting new game');
                    startNewGame();
                }
            }
        }
    });

// Update the unlimited mode button click handler
document.getElementById('unlimitedModeBtn').addEventListener('click', () => {
    if (isDaily) {
        // Stop any currently playing audio
        const player = document.getElementById('audio-player');
        const playButton = document.querySelector('.play-button');
        
        if (isPlaying) {
            player.pause();
            player.currentTime = 0;
            playButton.textContent = 'Play';
            isPlaying = false;
            
            // Reset progress bar
            const progressFill = document.querySelector('.progress-fill');
            progressFill.style.width = '0%';
            
            // Stop wave animation if it's running
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
        
        // Enable the filter button - moved outside the isPlaying check
        const filterBtn = document.getElementById('filterButton');
        if (filterBtn) {
            filterBtn.classList.remove('disabled');
            filterBtn.classList.add('active');
            // Also update the appearance based on current filters
            updateFilterButtonAppearance();
        }
        
        // First save the current daily mode state if not completed
        if (!isGameOver) {
            // Save the current state to daily storage
            const dailyGameState = {
                attempts: attempts,
                incorrectGuesses: incorrectGuesses,
                isDaily: true,
                dailySeed: dailySeed,
                peekedAtSongList: peekedAtSongList
            };
            localStorage.setItem('dailyGameState', JSON.stringify(dailyGameState));
            console.log('Saved daily game state before switching to unlimited');
        }
        
        // Switch to unlimited mode
        isDaily = false;
        document.getElementById('dailyModeBtn').classList.remove('active');
        document.getElementById('unlimitedModeBtn').classList.add('active');
        
        // Reset game state variables for the new mode
        attempts = 0;
        incorrectGuesses = [];
        isGameOver = false;
        gameWon = false;
        
        // Check if we have saved state for unlimited mode
        const savedUnlimitedState = localStorage.getItem('unlimitedGameState');
        
        if (savedUnlimitedState) {
            // We have a saved unlimited game, restore it
            const gameState = JSON.parse(savedUnlimitedState);
            console.log('Found saved unlimited game state:', gameState);
            
            attempts = gameState.attempts;
            incorrectGuesses = gameState.incorrectGuesses;
            peekedAtSongList = gameState.peekedAtSongList;
            
            // Load the unlimited song
            const unlimitedSongKey = localStorage.getItem('unlimitedSongKey');
            if (unlimitedSongKey && gameData[unlimitedSongKey]) {
                currentSong = gameData[unlimitedSongKey];
                currentSong.cleanArtist = cleanupText(currentSong.artist);
                
                // Set up the audio player
                const player = document.getElementById('audio-player');
                player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
                
                // Update UI to reflect loaded state
                console.log('Restoring unlimited game with attempts:', attempts);
                updateGuessHistory();
                updateProgressBar();
                updateSkipButtonText();
            } else {
                console.log('Could not find saved song, starting new game');
                startNewGame();
            }
        } else {
            console.log('No saved unlimited game state, starting new game');
            startNewGame();
        }
    }
});



    
    // Add event listener for beforeunload to save state when closing/refreshing
    window.addEventListener('beforeunload', () => {
        if (!isGameOver) {
            saveGameState();
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        // Add event listeners to close buttons
        document.querySelectorAll('.modal-close-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                
                const modal = this.closest('.modal');
                if (modal) {
                    if (modal.id === 'songListModal') {
                        window.closeSongList(e);
                    } else if (modal.id === 'playHistoryModal') {
                        window.closePlayHistory(e);
                    }
                }
            });
        });
    });

    // Add a direct event listener for the Play Again button
    document.addEventListener('click', function(e) {
        // Check if the clicked element is the play again button
        if (e.target && (e.target.id === 'playAgainButton' || 
                        (e.target.classList.contains('modal-button') && 
                        !e.target.classList.contains('share-button') && 
                        !e.target.closest('#songListModal') && 
                        !e.target.closest('#playHistoryModal')))) {
            console.log('Play button clicked, isDaily =', isDaily);
            
            // If we're in daily mode, switch to unlimited mode
            if (isDaily) {
                isDaily = false;
                document.getElementById('dailyModeBtn').classList.remove('active');
                document.getElementById('unlimitedModeBtn').classList.add('active');
                updateFilterVisibility();
            }
            
            // Start a new game
            startNewGame();
            e.stopPropagation();
        }
    }, true);

    // Set up a MutationObserver to ensure modal buttons have correct text
    const gameOverModal = document.getElementById('gameOverModal');
    if (gameOverModal) {
        const modalObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'style' && 
                    gameOverModal.style.display === 'block') {
                    
                    console.log('Modal displayed - ensuring correct button text and styles');
                    
                    // Make sure the button text is correct based on the game mode
                    setTimeout(() => {
                        // Direct approach using ID
                        const playAgainButton = document.getElementById('playAgainButton');
                        if (playAgainButton) {
                            // Set button text based on game mode
                            if (isDaily) {
                                console.log('Setting button to "Play Unlimited" for daily mode');
                                playAgainButton.innerHTML = "Play Unlimited";
                                
                                // Make sure it has the correct event handler
                                const newButton = playAgainButton.cloneNode(true);
                                newButton.addEventListener('click', function() {
                                    isDaily = false;
                                    document.getElementById('dailyModeBtn').classList.remove('active');
                                    document.getElementById('unlimitedModeBtn').classList.add('active');
                                    updateFilterVisibility();
                                    startNewGame();
                                });
                                
                                // Replace the button to ensure clean event handlers
                                if (playAgainButton.parentNode) {
                                    playAgainButton.parentNode.replaceChild(newButton, playAgainButton);
                                }
                            } else {
                                console.log('Setting button to "Play Again" for unlimited mode');
                                playAgainButton.innerHTML = "Play Again";
                                
                                // Make sure it has the correct event handler
                                const newButton = playAgainButton.cloneNode(true);
                                newButton.addEventListener('click', function() {
                                    startNewGame();
                                });
                                
                                // Replace the button to ensure clean event handlers
                                if (playAgainButton.parentNode) {
                                    playAgainButton.parentNode.replaceChild(newButton, playAgainButton);
                                }
                            }
                        }
                        
                        // Fallback approach using class selector
                        else {
                            const fallbackButton = document.querySelector('.modal-content .modal-button:not(.share-button)');
                            if (fallbackButton) {
                                // Set button text based on game mode
                                if (isDaily) {
                                    fallbackButton.innerHTML = "Play Unlimited";
                                    
                                    // Make sure it has the correct event handler
                                    const newButton = fallbackButton.cloneNode(true);
                                    newButton.addEventListener('click', function() {
                                        isDaily = false;
                                        document.getElementById('dailyModeBtn').classList.remove('active');
                                        document.getElementById('unlimitedModeBtn').classList.add('active');
                                        updateFilterVisibility();
                                        startNewGame();
                                    });
                                    
                                    // Replace the button to ensure clean event handlers
                                    if (fallbackButton.parentNode) {
                                        fallbackButton.parentNode.replaceChild(newButton, fallbackButton);
                                    }
                                } else {
                                    fallbackButton.innerHTML = "Play Again";
                                    
                                    // Make sure it has the correct event handler
                                    const newButton = fallbackButton.cloneNode(true);
                                    newButton.addEventListener('click', function() {
                                        startNewGame();
                                    });
                                    
                                    // Replace the button to ensure clean event handlers
                                    if (fallbackButton.parentNode) {
                                        fallbackButton.parentNode.replaceChild(newButton, fallbackButton);
                                    }
                                }
                            }
                        }
                    }, 10); // Small delay to ensure the DOM is ready
                }
            });
        });
        
        modalObserver.observe(gameOverModal, { attributes: true });
    }


// Update button event listeners to add emergency close buttons
document.getElementById('songListButton').addEventListener('click', function() {
    showSongList();
    setTimeout(addEmergencyCloseButtons, 100); // Small delay to ensure modal is visible
});

// History Button
document.getElementById('playHistoryButton').addEventListener('click', function() {
    console.log('Play history button clicked');
    showPlayHistory();
    setTimeout(addEmergencyCloseButtons, 100); // Small delay to ensure modal is visible
});

    // Play button listener with audio context initialization
    document.getElementById('playButton').addEventListener('click', async () => {
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
            
            // If we're actively selecting a suggestion
            if (selectedSuggestion && suggestionBox.style.display !== 'none') {
                this.value = selectedSuggestion.dataset.title;
                suggestionBox.style.display = 'none';
                return;
            }
            
            // For any other Enter press, check if the current value is valid
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
    });

    // Mobile keyboard handling
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const guessInput = document.getElementById('guess-input');
        
        guessInput.addEventListener('focus', () => {
            document.body.classList.add('keyboard-open');
        });

        guessInput.addEventListener('blur', () => {
            document.body.classList.remove('keyboard-open');
        });

        window.visualViewport.addEventListener('resize', () => {
            // Don't adjust positioning when keyboard appears
        });
    }
    
    // Modal listeners
    const modal = document.getElementById('gameOverModal');
    const modalButton = document.querySelector('.modal-button');
    modalButton.addEventListener('click', startNewGame);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal && !isGameOver) {
            modal.style.display = 'none';
        }
    });
    
    // Add these new event listeners for the other modals
    document.getElementById('songListModal')?.querySelector('.modal-button')?.addEventListener('click', function() {
        console.log('Song list close button clicked');
        document.getElementById('songListModal').style.display = 'none';
        
        // Stop preview playback
        if (previewPlayer && !previewPlayer.paused) {
            previewPlayer.pause();
            previewPlayer.currentTime = 0;
            previewPlayer.dataset.currentSong = '';
        }
    });
    
    document.getElementById('playHistoryModal')?.querySelector('.modal-button')?.addEventListener('click', function() {
        console.log('History close button clicked');
        document.getElementById('playHistoryModal').style.display = 'none';
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
        if (isPlaying) {
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

    // Add mouse tracking to buttons
    const buttons = ['#submit-button', '#skip-button', '.play-button'];
    buttons.forEach(buttonSelector => {
        document.querySelector(buttonSelector).addEventListener('mousemove', (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            e.target.style.setProperty('--mouse-x', `${x}%`);
            e.target.style.setProperty('--mouse-y', `${y}%`);
        });
    });

    // Initialize submit button state
    updateSubmitButtonState();

    document.querySelectorAll('.modal-button').forEach(button => {
        button.addEventListener('mouseenter', () => {
            if (!difficultyGuessed) {
                document.querySelectorAll('.difficulty-btn:not(.correct):not(.incorrect)').forEach(btn => {
                    btn.style.borderColor = '#FFFFFF';
                    btn.style.color = '#FFFFFF';
                    btn.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.3)';
                });
            }
        });
    
        button.addEventListener('mouseleave', () => {
            if (!difficultyGuessed) {
                document.querySelectorAll('.difficulty-btn:not(.correct):not(.incorrect)').forEach(btn => {
                    btn.style.removeProperty('border-color');
                    btn.style.removeProperty('color');
                    btn.style.removeProperty('box-shadow');
                });
            }
        });
    });

    // Add auto-focus for desktop
    if (window.innerWidth > 768) {
        document.getElementById('guess-input').focus();
        document.getElementById('guess-input').classList.add('auto-focus');
    }
    
    // Load game data
    loadGameData();
});