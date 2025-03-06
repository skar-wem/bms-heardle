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

function getDailySong() {
  // Create a deterministic random number based on the date
  const dateStr = dailySeed;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  // Use the hash to select a song
  const songs = Object.keys(gameData);
  const index = Math.abs(hash) % songs.length;
  return songs[index];
}

function startGame() {
  if (isDaily) {
    // Check if already played today
    const lastPlayed = localStorage.getItem('lastDailyPlayed');
    dailyAttempted = lastPlayed === dailySeed;
    
    // Get the daily song
    const dailySongKey = getDailySong();
    currentSong = gameData[dailySongKey];
  } else {
    // Existing random selection for unlimited mode
    const songs = Object.keys(gameData);
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    currentSong = gameData[randomSong];
  }
  
  currentSong.cleanArtist = cleanupText(currentSong.artist);



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
    // Use the new encodeFilename function
    player.src = `game_audio/${encodeFilename(currentSong.heardle_file)}`;
    
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

function encodeFilename(filename) {
    return encodeURIComponent(filename)
        .replace(/%23/g, '%2523') // Handle # character
        .replace(/\+/g, '%2B')    // Handle + character
        .replace(/\-/g, '%2D');   // Handle - character
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

function showSongList() {
    const modal = document.getElementById('songListModal');
    const container = modal.querySelector('.song-list-container');
    const searchInput = document.getElementById('songSearchInput');
    const difficultyFilter = document.getElementById('difficultyFilter');

    // Create a new audio element for previews if it doesn't exist
    if (!previewPlayer) {
        previewPlayer = new Audio();
    }

    function handleSongItemClick(item) {
        // Remove playing class from all items
        container.querySelectorAll('.song-list-item').forEach(i => {
            i.classList.remove('playing');
        });

        // Stop any currently playing preview
        if (!previewPlayer.paused) {
            previewPlayer.pause();
            previewPlayer.currentTime = 0;
            
            // If clicking the same song that's playing, just stop it
            if (previewPlayer.dataset.currentSong === item.dataset.preview) {
                previewPlayer.dataset.currentSong = '';
                return;
            }
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

        previewPlayer.play();
    }

    function filterSongs() {
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

    function updateSongList() {
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
                
            return `
                <div class="song-list-item ${playingClass}" data-preview="${song.preview_file}">
                    <div class="song-list-details">
                        <span class="song-list-title">${song.display_title}</span>
                        ${levelsHtml}
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners to all song items
        container.querySelectorAll('.song-list-item').forEach(item => {
            item.addEventListener('click', () => handleSongItemClick(item));
        });
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

    // Stop preview playback when closing modal
    const closeButton = modal.querySelector('.modal-button');
    closeButton.addEventListener('click', () => {
        if (previewPlayer && !previewPlayer.paused) {
            previewPlayer.pause();
            previewPlayer.currentTime = 0;
            previewPlayer.dataset.currentSong = '';
            container.querySelectorAll('.song-list-item').forEach(i => {
                i.classList.remove('playing');
            });
        }
    });
}

function closeSongList() {
    document.getElementById('songListModal').style.display = 'none';
    
    // Stop preview playback
    if (previewPlayer && !previewPlayer.paused) {
        previewPlayer.pause();
        previewPlayer.currentTime = 0;
        previewPlayer.dataset.currentSong = '';
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
        const modalTitle = document.querySelector('.modal-title');
        const modalContent = document.querySelector('.modal-content');
        const difficultyContainer = document.getElementById('difficultyGuessContainer');
        
        // Get the buttons
        const playAgainButton = document.querySelector('.modal-button:not(.share-button)');
        const shareButton = document.querySelector('.share-button');
        
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
            const startDate = new Date('2023-10-15'); // Adjust this to your actual start date
            const currentDate = new Date(dailySeed);
            const dayDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            
            dailyHeader = `<div class="daily-header">Daily Challenge #${dayDiff}</div>`;
        }
        
        if (isWin) {
            modalTitle.textContent = 'Congratulations!';
            modalTitle.style.color = 'var(--neon-pink)';
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
            modalTitle.textContent = 'Game Over';
            modalTitle.style.color = 'var(--neon-blue)';
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
        difficultyGuessed = false;
        
        modal.style.display = 'block';
        isGameOver = true;
        
        if (isWin) {
            createWinParticles();
        }
        
        // If in daily mode, update the Play Again button text to reflect mode
        if (isDaily) {
            playAgainButton.textContent = "Play Unlimited";
            playAgainButton.onclick = function() {
                isDaily = false;
                document.getElementById('dailyModeBtn').classList.remove('active');
                document.getElementById('unlimitedModeBtn').classList.add('active');
                startNewGame();
            };
        } else {
            playAgainButton.textContent = "Play Again";
            playAgainButton.onclick = startNewGame;
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
    // Only add divider and difficulty result if difficulty was guessed
    const difficultyPart = difficultyGuessed ? ` | ${difficultyGuessResult ? '⭐' : '❌'}` : '';
    const shareText = `▸ BMS Heardle #\n${squares.join('')}${difficultyPart}\n${currentSong.display_title} - ${currentSong.cleanArtist}\nhttps://skar.fun/bms/`;

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
    // Initialize volume control
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

    // Game mode toggle listeners
    document.getElementById('dailyModeBtn').addEventListener('click', () => {
        if (!isDaily) {
            isDaily = true;
            document.getElementById('dailyModeBtn').classList.add('active');
            document.getElementById('unlimitedModeBtn').classList.remove('active');
            startNewGame();
        }
    });

    document.getElementById('unlimitedModeBtn').addEventListener('click', () => {
        if (isDaily) {
            isDaily = false;
            document.getElementById('dailyModeBtn').classList.remove('active');
            document.getElementById('unlimitedModeBtn').classList.add('active');
            startNewGame();
        }
    });

    // Song list button listener - modified for daily mode
    document.getElementById('songListButton').addEventListener('click', () => {
        if (isDaily && !isGameOver) {
            alert("Song list will be available after you complete today's challenge.");
        } else {
            showSongList();
        }
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