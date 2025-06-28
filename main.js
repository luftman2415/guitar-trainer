// =================================================================================
// DEFINICIÓN DE TODOS LOS MÓDULOS DE LA APLICACIÓN
// =================================================================================

class ThemeManager {
    constructor(app) { this.app = app; this.setup(); }
    setup() { document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', () => this.setTheme(btn.dataset.theme))); }
    setTheme(theme) { document.body.setAttribute('data-theme', theme); this.app.appData.settings.theme = theme; this.app.saveData(); }
    loadSavedTheme() { this.setTheme(this.app.appData.settings.theme || 'light'); }
}

class Metronome {
    constructor(app) {
        this.app = app;
        this.isPlaying = false;
        this.bpm = 120;
        this.subdivision = 1;
        this.audioContext = app.sharedAudioContext; // Usar AudioContext compartido
        this.nextNoteTime = 0;
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25.0;
        this.scheduler = null;
        this.speedTrainer = null;
        
        this.dom = {
            bpmDisplay: document.getElementById('bpmDisplay'),
            bpmSlider: document.getElementById('bpmSlider'),
            subdivisionSelect: document.getElementById('subdivision'), // ID correcto
            playBtn: document.getElementById('playBtn'),
            tapBtn: document.getElementById('tapTempoBtn'), // ID correcto
            startSpeedTrainerBtn: document.getElementById('startSpeedTrainerBtn'),
            stopSpeedTrainerBtn: document.getElementById('stopSpeedTrainerBtn'),
            speedTrainerDisplay: document.getElementById('speedTrainerDisplay') // Puede ser null
        };
        
        this.tapTimestamps = [];
        this.loadSettings();
        this.setupControls();
        this.setupSpeedTrainer();
    }
    initAudio() {
        if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
    }
    createClick(level) {
        if (!this.audioContext) return;
        const time = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator(); const gain = this.audioContext.createGain();
        osc.connect(gain); gain.connect(this.audioContext.destination);
        osc.type = this.app.appData.settings.metronome.sound;
        const freq = [880, 440, 300][level]; const gainVal = [0.4, 0.3, 0.15][level];
        const duration = 0.05;
        osc.frequency.setValueAtTime(freq, time); gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(gainVal, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.start(time); osc.stop(time + duration);
    }
    setupControls() {
        // Verificar que los elementos existan antes de agregar event listeners
        if (this.dom.playBtn) {
            this.dom.playBtn.addEventListener('click', () => this.togglePlay());
        }
        
        // Buscar el botón tap con el ID correcto
        const tapBtn = document.getElementById('tapTempoBtn');
        if (tapBtn) {
            tapBtn.addEventListener('click', () => this.handleTap());
        }
        
        const restartIfPlaying = () => { if (this.isPlaying) { this.stop(); this.start(); } };
        
        if (this.dom.bpmSlider) {
            this.dom.bpmSlider.addEventListener('input', e => {
                this.setBpm(parseInt(e.target.value));
                restartIfPlaying();
            });
        }
        
        // Buscar el selector de subdivisiones con el ID correcto
        const subdivisionSelect = document.getElementById('subdivision');
        if (subdivisionSelect) {
            subdivisionSelect.addEventListener('change', e => {
                this.subdivision = parseInt(e.target.value);
                this.app.appData.settings.metronome.subdivision = this.subdivision;
                this.app.saveData(); // Guardar configuración
                restartIfPlaying();
            });
        }
    }
    
    setupSpeedTrainer() {
        const startBtn = document.getElementById('startSpeedTrainerBtn');
        const stopBtn = document.getElementById('stopSpeedTrainerBtn');
        
        if (startBtn && stopBtn) {
            startBtn.addEventListener('click', () => this.startSpeedTrainer());
            stopBtn.addEventListener('click', () => this.stopSpeedTrainer());
        }
        
        // Guardar configuración del Speed Trainer
        const speedTrainerInputs = ['startBpm', 'endBpm', 'increment', 'stepDuration'];
        speedTrainerInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', () => {
                    this.app.appData.settings.speedTrainer = this.app.appData.settings.speedTrainer || {};
                    this.app.appData.settings.speedTrainer[inputId] = input.value;
                    this.app.saveData(); // Guardar configuración
                });
            }
        });
    }
    loadSettings() {
        this.bpm = this.app.appData.settings.metronome.bpm || 120;
        this.subdivision = this.app.appData.settings.metronome.subdivision || 1;
        if (this.dom.bpmDisplay) this.dom.bpmDisplay.textContent = this.bpm;
        if (this.dom.bpmSlider) this.dom.bpmSlider.value = this.bpm;
        if (this.dom.subdivisionSelect) this.dom.subdivisionSelect.value = this.subdivision;
        this.app.saveData(); // Asegurar que la configuración se guarde
    }
    setBpm(newBpm) { 
        this.bpm = Math.max(40, Math.min(240, newBpm)); 
        this.app.appData.settings.metronome.bpm = this.bpm;
        this.app.saveData(); // Guardar configuración
        if (this.dom.bpmDisplay) this.dom.bpmDisplay.textContent = this.bpm; 
        if (this.dom.bpmSlider) this.dom.bpmSlider.value = this.bpm; 
    }
    togglePlay() { this.isPlaying ? this.stop() : this.start(); }
    start() {
        this.initAudio(); this.isPlaying = true; this.beat = 0;
        if (this.dom.playBtn) this.dom.playBtn.innerHTML = '⏸️ Pausar';
        const { bpm, timeSignature, subdivision, accent } = this.app.appData.settings.metronome;
        const beatsPerMeasure = timeSignature === '6/8' ? 6 : parseInt(timeSignature.split('/')[0]);
        const intervalMs = (60 / bpm / subdivision) * 1000;
        
        this.metronomeInterval = setInterval(() => {
            const mainBeatIndex = Math.floor(this.beat / subdivision);
            const subBeatIndex = this.beat % subdivision;
            let clickLevel = 2;
            if (subBeatIndex === 0) { clickLevel = (mainBeatIndex === 0 && accent) ? 0 : 1; }
            this.createClick(clickLevel);
            // Buscar el indicador visual si existe
            const visualIndicator = document.querySelector('.visual-indicator');
            if (clickLevel < 2 && visualIndicator) { 
                visualIndicator.classList.add('beat'); 
                setTimeout(() => visualIndicator.classList.remove('beat'), 100); 
            }
            this.beat = (this.beat + 1) % (beatsPerMeasure * subdivision);
        }, intervalMs);
    }
    stop() {
        this.isPlaying = false; 
        if (this.dom.playBtn) this.dom.playBtn.innerHTML = '▶️ Iniciar';
        clearInterval(this.metronomeInterval); this.metronomeInterval = null;
        if (this.audioContext && this.audioContext.state === 'running') this.audioContext.suspend();
    }
    handleTap() {
        const now = Date.now(); this.tapTimestamps.push(now);
        if (this.tapTimestamps.length > 4) this.tapTimestamps.shift();
        if (this.tapTimestamps.length > 1) {
            const intervals = [];
            for (let i = 1; i < this.tapTimestamps.length; i++) intervals.push(this.tapTimestamps[i] - this.tapTimestamps[i-1]);
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const newBpm = Math.round(60000 / avg);
            if (newBpm >= 40 && newBpm <= 240) {
                this.setBpm(newBpm);
                if (this.dom.bpmDisplay) {
                    this.dom.bpmDisplay.classList.add('bpm-flash'); 
                    setTimeout(() => this.dom.bpmDisplay.classList.remove('bpm-flash'), 500);
                }
            }
        }
        setTimeout(() => { if (this.tapTimestamps.length > 0 && Date.now() - this.tapTimestamps[this.tapTimestamps.length - 1] > 2000) this.tapTimestamps = []; }, 2100);
    }

    startSpeedTrainer() {
        const startBpm = parseInt(document.getElementById('startBpm').value);
        const endBpm = parseInt(document.getElementById('endBpm').value);
        const increment = parseInt(document.getElementById('increment').value);
        const stepDuration = parseInt(document.getElementById('stepDuration').value);

        // Validaciones estrictas
        if (isNaN(startBpm) || isNaN(endBpm) || isNaN(increment) || isNaN(stepDuration)) {
            alert('Por favor, ingresa valores numéricos válidos en todos los campos.');
            return;
        }

        if (startBpm < 40 || startBpm > 240) {
            alert('El BPM debe estar entre 40 y 240.');
            return;
        }

        if (startBpm >= endBpm) {
            alert('El BPM inicial debe ser menor que el BPM final.');
            return;
        }

        if (increment < 1 || increment > 50) {
            alert('El incremento debe estar entre 1 y 50 BPM.');
            return;
        }

        if (stepDuration < 10 || stepDuration > 600) {
            alert('La duración del paso debe estar entre 10 y 600 segundos.');
            return;
        }

        this.speedTrainer = {
            isActive: true,
            currentBpm: startBpm,
            startBpm: startBpm,
            endBpm: endBpm,
            increment: increment,
            stepDuration: stepDuration * 1000, // Convertir a milisegundos
            stepTimer: null,
            startTime: Date.now()
        };

        this.setBpm(startBpm);
        this.updateSpeedTrainerDisplay();
        
        // Iniciar el primer paso
        this.speedTrainer.stepTimer = setTimeout(() => {
            this.nextSpeedTrainerStep();
        }, this.speedTrainer.stepDuration);
    }

    stopSpeedTrainer() {
        if (!this.speedTrainer.isActive) return;

        // Limpiar timer
        if (this.speedTrainer.stepTimer) {
            clearTimeout(this.speedTrainer.stepTimer);
        }

        // Resetear estado
        this.speedTrainer.isActive = false;
        this.speedTrainer.currentStep = 0;

        // Actualizar UI
        const startBtn = document.getElementById('startSpeedTrainerBtn');
        const stopBtn = document.getElementById('stopSpeedTrainerBtn');
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;

        // Limpiar display del Speed Trainer
        this.clearSpeedTrainerDisplay();
    }

    nextSpeedTrainerStep() {
        if (!this.speedTrainer.isActive) return;

        this.speedTrainer.currentStep++;
        
        // Calcular el nuevo BPM
        const newBpm = this.speedTrainer.startBpm + (this.speedTrainer.currentStep * this.speedTrainer.increment);
        
        // Verificar si hemos llegado al BPM final
        if (newBpm > this.speedTrainer.endBpm) {
            // Speed Trainer completado
            this.stopSpeedTrainer();
            alert('¡Entrenamiento de velocidad completado! 🎉');
            return;
        }

        // Actualizar BPM
        this.setBpm(newBpm);
        
        // Actualizar display
        this.updateSpeedTrainerDisplay();

        // Programar el siguiente paso
        this.speedTrainer.stepTimer = setTimeout(() => {
            this.nextSpeedTrainerStep();
        }, this.speedTrainer.stepDuration);
    }

    updateSpeedTrainerDisplay() {
        if (!this.speedTrainer.isActive) return;

        const currentBpm = this.speedTrainer.startBpm + (this.speedTrainer.currentStep * this.speedTrainer.increment);
        const totalSteps = Math.ceil((this.speedTrainer.endBpm - this.speedTrainer.startBpm) / this.speedTrainer.increment);
        const progress = ((this.speedTrainer.currentStep + 1) / totalSteps) * 100;

        // Crear o actualizar el display del Speed Trainer
        let display = document.getElementById('speedTrainerDisplay');
        if (!display) {
            display = document.createElement('div');
            display.id = 'speedTrainerDisplay';
            display.className = 'speed-trainer-display';
            const speedTrainerSection = document.querySelector('.speed-trainer-section');
            if (speedTrainerSection) {
                speedTrainerSection.appendChild(display);
            }
        }

        display.innerHTML = `
            <div class="speed-trainer-info">
                <h4>🏃 Entrenamiento Activo</h4>
                <p><strong>Paso ${this.speedTrainer.currentStep + 1}/${totalSteps}</strong></p>
                <p>BPM Actual: <span class="current-bpm">${currentBpm}</span></p>
                <p>Próximo BPM: ${currentBpm + this.speedTrainer.increment}</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
        `;
    }

    clearSpeedTrainerDisplay() {
        const display = document.getElementById('speedTrainerDisplay');
        if (display) {
            display.remove();
        }
    }
}

class Tuner {
    constructor(app) { 
        this.app = app; 
        this.isTunerOn = false; 
        this.audioContext = app.sharedAudioContext; // Usar AudioContext compartido
        this.analyser = null; 
        this.source = null; 
        this.animationFrameId = null; 
        this.noteStrings = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]; 
        this.dom = { 
            note: document.getElementById('tunerNote'), 
            sharp: document.getElementById('tunerSharp'), 
            flat: document.getElementById('tunerFlat'), 
            needle: document.getElementById('tunerNeedle'), 
            cents: document.getElementById('centsDisplay'), 
            startBtn: document.getElementById('tunerStartBtn'), 
            status: document.getElementById('tunerStatus') 
        }; 
        if (this.dom.startBtn) {
            this.dom.startBtn.addEventListener('click', () => this.toggleTuner()); 
        }
    }
    toggleTuner() { this.isTunerOn ? this.stop() : this.start(); }
    start() { 
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => { 
            this.isTunerOn = true; 
            if (this.dom.startBtn) this.dom.startBtn.textContent = 'Desactivar Afinador'; 
            if (this.dom.status) this.dom.status.style.display = 'none'; 
            
            // Usar el AudioContext compartido en lugar de crear uno nuevo
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.source = this.audioContext.createMediaStreamSource(stream); 
            this.analyser = this.audioContext.createAnalyser(); 
            this.analyser.fftSize = 2048; 
            this.source.connect(this.analyser); 
            this.updatePitch(); 
        }).catch(() => { 
            if (this.dom.status) this.dom.status.textContent = 'Error: Permiso para micrófono denegado.'; 
        }); 
    }
    stop() { 
        this.isTunerOn = false; 
        if (this.source) this.source.mediaStream.getTracks().forEach(track => track.stop()); 
        // No cerrar el AudioContext compartido
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId); 
        if (this.dom.startBtn) this.dom.startBtn.textContent = 'Activar Afinador'; 
        this.resetUI(); 
    }
    updatePitch() { const buffer = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(buffer); const pitch = this.autoCorrelate(buffer, this.audioContext.sampleRate); if (pitch !== -1) { this.updateUI(this.noteFromPitch(pitch)); } if (this.isTunerOn) this.animationFrameId = requestAnimationFrame(() => this.updatePitch()); }
    updateUI({ noteName, detune }) { 
        if (this.dom.note) this.dom.note.textContent = noteName.charAt(0); 
        if (this.dom.sharp) this.dom.sharp.style.opacity = noteName.includes('♯') ? 1 : 0; 
        if (this.dom.flat) this.dom.flat.style.opacity = noteName.includes('♭') ? 1 : 0; 
        if (this.dom.cents) this.dom.cents.textContent = `${detune.toFixed(0)} cents`; 
        const rotation = Math.max(-90, Math.min(90, detune * 1.8)); 
        if (this.dom.needle) {
            this.dom.needle.style.transform = `rotate(${rotation}deg)`; 
            this.dom.needle.style.backgroundColor = Math.abs(detune) < 5 ? 'var(--success-color)' : 'var(--text-primary)'; 
        }
    }
    resetUI() { 
        if (this.dom.note) this.dom.note.textContent = '--'; 
        if (this.dom.sharp) this.dom.sharp.style.opacity = 0; 
        if (this.dom.flat) this.dom.flat.style.opacity = 0; 
        if (this.dom.cents) this.dom.cents.textContent = '- cents'; 
        if (this.dom.needle) this.dom.needle.style.transform = 'rotate(0deg)'; 
    }
    noteFromPitch(frequency) { const noteNum = 12 * (Math.log(frequency / this.app.appData.settings.tuner.a4) / Math.log(2)); const roundedNote = Math.round(noteNum) + 69; const noteName = this.noteStrings[roundedNote % 12]; const expectedFrequency = this.app.appData.settings.tuner.a4 * Math.pow(2, (roundedNote - 69) / 12); const detune = 1200 * Math.log2(frequency / expectedFrequency); return { noteName, detune }; }
    autoCorrelate(buf, sampleRate) { let size = buf.length, rms = 0; for (let i = 0; i < size; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / size); if (rms < 0.01) return -1; let r1 = 0, r2 = size - 1, thres = 0.2; for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; } for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; } buf = buf.slice(r1, r2); size = buf.length; let c = new Float32Array(size).fill(0); for (let i = 0; i < size; i++) for (let j = 0; j < size - i; j++) c[i] = c[i] + buf[j] * buf[j + i]; let d = 0; while (c[d] > c[d + 1]) d++; let maxval = -1, maxpos = -1; for (let i = d; i < size; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } } let T0 = maxpos; let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]; let a = (x1 + x3 - 2 * x2) / 2; let b = (x3 - x1) / 2; if (a) T0 = T0 - b / (2 * a); return sampleRate / T0; }
}

class SongManager {
    constructor(app) { 
        this.app = app; 
        this.setupModal(); 
        this.setupFilters();
    }
    setupModal() { this.modalOverlay = document.getElementById('songModalOverlay'); this.modalForm = document.getElementById('songForm'); this.closeBtn = document.getElementById('closeSongModalBtn'); this.cancelBtn = document.getElementById('cancelSongModalBtn'); this.editingSongId = null; document.getElementById('addSongBtn').addEventListener('click', () => this.showSongModal()); this.closeBtn.addEventListener('click', () => this.closeSongModal()); this.cancelBtn.addEventListener('click', () => this.closeSongModal()); this.modalOverlay.addEventListener('click', e => { if (e.target === this.modalOverlay) this.closeSongModal(); }); this.modalForm.addEventListener('submit', e => this.handleFormSubmit(e)); }
    showSongModal(songId = null) { 
        this.app.openModal(); 
        this.editingSongId = songId; 
        if (songId) { 
            const song = this.app.findSongById(songId); 
            if (!song) return; 
            document.getElementById('songModalTitle').textContent = 'Editar Canción'; 
            document.getElementById('songTitleInput').value = song.title; 
            document.getElementById('songArtistInput').value = song.artist || ''; 
            document.getElementById('songDefaultKeyInput').value = song.defaultKey; 
            document.getElementById('songDefaultBpmInput').value = song.defaultBpm || ''; 
            document.getElementById('songTagsInput').value = song.tags ? song.tags.join(', ') : ''; 
            document.getElementById('songArchivedInput').checked = song.archived || false; 
            document.getElementById('songLyricsInput').value = song.lyrics; 
        } else { 
            document.getElementById('songModalTitle').textContent = 'Nueva Canción'; 
            this.modalForm.reset(); 
        } 
        this.modalOverlay.style.display = 'flex'; 
    }
    closeSongModal() { this.modalOverlay.style.display = 'none'; this.editingSongId = null; this.app.closeModal(); }
    handleFormSubmit(e) { 
        e.preventDefault(); 
        const formData = new FormData(this.modalForm); 
        const tagsString = formData.get('tags') || '';
        const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        
        const songData = { 
            id: this.editingSongId || `song_${Date.now()}`, 
            title: formData.get('title'), 
            artist: formData.get('artist'), 
            defaultKey: formData.get('defaultKey'), 
            defaultBpm: parseInt(formData.get('defaultBpm')) || null, 
            tags: tags,
            archived: formData.get('archived') === 'on',
            lyrics: formData.get('lyrics') 
        }; 
        if (this.editingSongId) { 
            const index = this.app.appData.songs.findIndex(s => s.id === this.editingSongId); 
            this.app.appData.songs[index] = songData; 
        } else { 
            this.app.appData.songs.push(songData); 
        } 
        this.app.saveData(); 
        this.renderSongList(); 
        this.closeSongModal(); 
    }
    
    parseSongSections(lyrics) {
        const sections = [];
        const lines = lyrics.split('\n');
        let currentSection = null;
        let currentContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Buscar etiquetas de sección como [Verse], [Chorus], [Bridge], etc.
            const sectionMatch = line.match(/^\[([^\]]+)\]/);
            
            if (sectionMatch) {
                // Guardar la sección anterior si existe
                if (currentSection) {
                    sections.push({
                        name: currentSection,
                        content: currentContent.join('\n').trim(),
                        startLine: i - currentContent.length
                    });
                }
                
                // Iniciar nueva sección
                currentSection = sectionMatch[1];
                currentContent = [];
            } else if (line && currentSection) {
                // Añadir línea al contenido de la sección actual
                currentContent.push(line);
            }
        }
        
        // Añadir la última sección
        if (currentSection && currentContent.length > 0) {
            sections.push({
                name: currentSection,
                content: currentContent.join('\n').trim(),
                startLine: lines.length - currentContent.length
            });
        }
        
        return sections;
    }

    renderSongList() { 
        const container = document.getElementById('songListContainer'); 
        container.innerHTML = ''; 
        
        // Obtener filtros
        const tagFilter = document.getElementById('songTagFilter').value;
        const showArchived = document.getElementById('songArchiveFilter').checked;
        
        // Filtrar canciones
        let filteredSongs = this.app.appData.songs.filter(song => {
            // Filtrar por archivo
            if (!showArchived && song.archived) return false;
            
            // Filtrar por tag
            if (tagFilter && (!song.tags || !song.tags.includes(tagFilter))) return false;
            
            return true;
        });
        
        if (filteredSongs.length === 0) { 
            container.innerHTML = `<div class="empty-state"><h3>No hay canciones que coincidan con los filtros.</h3><p>¡Añade tu primera canción o ajusta los filtros!</p></div>`; 
            return; 
        } 
        
        filteredSongs.forEach(song => { 
            const tagsHtml = song.tags && song.tags.length > 0 
                ? `<div class="song-tags">${song.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` 
                : '';
            
            const archivedBadge = song.archived ? '<span class="archived-badge">📦 Archivada</span>' : '';
            
            const songCard = document.createElement('div'); 
            songCard.className = `item-card ${song.archived ? 'archived' : ''}`; 
            songCard.innerHTML = `
                <div class="item-card-main">
                    <h3>${song.title} ${archivedBadge}</h3>
                    <p>${song.artist || 'Artista desconocido'} • Tono: ${song.defaultKey} • BPM: ${song.defaultBpm || 'N/A'}</p>
                    ${tagsHtml}
                </div>
                <div class="item-card-actions">
                    <button class="button small-btn practice-song" data-id="${song.id}">🎯 Practicar</button>
                    <button class="button small-btn edit-song" data-id="${song.id}">✏️ Editar</button>
                    <button class="button small-btn-danger delete-song" data-id="${song.id}">🗑️ Borrar</button>
                </div>
            `; 
            container.appendChild(songCard); 
        }); 
        
        container.querySelectorAll('.edit-song').forEach(btn => btn.addEventListener('click', e => this.showSongModal(e.target.dataset.id))); 
        container.querySelectorAll('.delete-song').forEach(btn => btn.addEventListener('click', e => this.deleteSong(e.target.dataset.id))); 
        container.querySelectorAll('.practice-song').forEach(btn => btn.addEventListener('click', e => this.showSongPracticeModal(e.target.dataset.id))); 
        
        this.updateTagFilter();
        this.app.filterGlobalSearch(); 
    }

    updateTagFilter() {
        const tagFilter = document.getElementById('songTagFilter');
        const allTags = new Set();
        
        this.app.appData.songs.forEach(song => {
            if (song.tags) {
                song.tags.forEach(tag => allTags.add(tag));
            }
        });
        
        // Mantener la opción seleccionada actual
        const currentValue = tagFilter.value;
        
        // Limpiar y repoblar
        tagFilter.innerHTML = '<option value="">Todos los tags</option>';
        Array.from(allTags).sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
        
        // Restaurar valor seleccionado
        tagFilter.value = currentValue;
    }

    setupFilters() {
        const tagFilter = document.getElementById('songTagFilter');
        const archiveFilter = document.getElementById('songArchiveFilter');
        
        if (tagFilter) {
            tagFilter.addEventListener('change', () => this.renderSongList());
        }
        
        if (archiveFilter) {
            archiveFilter.addEventListener('change', () => this.renderSongList());
        }
    }

    showSongPracticeModal(songId) {
        const song = this.app.findSongById(songId);
        if (!song) return;

        const sections = this.parseSongSections(song.lyrics);
        
        const modalHtml = `
            <div class="modal-overlay" id="songPracticeModalOverlay" style="display:flex;">
                <div class="modal large-modal">
                    <button class="close-modal" id="closeSongPracticeModalBtn" title="Cerrar">×</button>
                    <h2>🎯 Practicar: ${song.title}</h2>
                    <div class="song-practice-container">
                        <div class="song-info">
                            <p><strong>Artista:</strong> ${song.artist || 'N/A'}</p>
                            <p><strong>Tonalidad:</strong> ${song.defaultKey}</p>
                            <p><strong>BPM:</strong> ${song.defaultBpm || 'N/A'}</p>
                        </div>
                        
                        ${sections.length > 0 ? `
                            <div class="section-practice">
                                <h3>Práctica por Secciones</h3>
                                <div class="section-buttons">
                                    ${sections.map((section, index) => `
                                        <button class="button section-btn" data-section="${index}">
                                            ${section.name}
                                        </button>
                                    `).join('')}
                                </div>
                                <div class="section-content" id="sectionContent">
                                    <p>Selecciona una sección para practicar</p>
                                </div>
                                <div class="section-controls" style="display:none;">
                                    <button class="button btn-primary" id="startSectionLoop">🔄 Iniciar Bucle</button>
                                    <button class="button btn-secondary" id="stopSectionLoop" style="display:none;">⏹️ Detener</button>
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="autoScroll" checked> Auto-scroll
                                    </label>
                                </div>
                            </div>
                        ` : `
                            <div class="full-song-practice">
                                <h3>Práctica Completa</h3>
                                <div class="song-lyrics">
                                    <pre>${song.lyrics}</pre>
                                </div>
                            </div>
                        `}
                        
                        <div class="practice-actions">
                            <button class="button btn-primary" id="setMetronomeBtn">🥁 Configurar Metrónomo</button>
                            <button class="button btn-secondary" id="addToRoutineBtn">🗓️ Añadir a Rutina</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('songPracticeModalOverlay');
        const closeBtn = document.getElementById('closeSongPracticeModalBtn');
        const sectionsData = sections;

        closeBtn.addEventListener('click', () => this.closeSongPracticeModal());
        modal.addEventListener('click', e => {
            if (e.target === modal) this.closeSongPracticeModal();
        });

        // Configurar eventos de secciones
        modal.querySelectorAll('.section-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.showSectionContent(sectionsData[index]));
        });

        // Configurar eventos de práctica
        document.getElementById('setMetronomeBtn').addEventListener('click', () => {
            if (song.defaultBpm) {
                this.app.metronome.setBpm(song.defaultBpm);
                this.app.showSection('metronome');
                this.closeSongPracticeModal();
            } else {
                alert('Esta canción no tiene BPM configurado');
            }
        });

        document.getElementById('addToRoutineBtn').addEventListener('click', () => {
            this.showAddToRoutineModal(songId);
        });

        this.app.openModal();
    }

    showSectionContent(section) {
        const contentDiv = document.getElementById('sectionContent');
        const controlsDiv = document.querySelector('.section-controls');
        
        contentDiv.innerHTML = `
            <div class="section-header">
                <h4>${section.name}</h4>
            </div>
            <div class="section-lyrics">
                <pre>${section.content}</pre>
            </div>
        `;
        
        controlsDiv.style.display = 'flex';
        
        // Configurar bucle de sección
        let isLooping = false;
        let loopInterval = null;
        
        document.getElementById('startSectionLoop').addEventListener('click', () => {
            if (!isLooping) {
                isLooping = true;
                document.getElementById('startSectionLoop').style.display = 'none';
                document.getElementById('stopSectionLoop').style.display = 'inline-block';
                
                // Iniciar bucle visual
                const lyricsElement = contentDiv.querySelector('.section-lyrics');
                lyricsElement.classList.add('looping');
                
                // Auto-scroll si está habilitado
                if (document.getElementById('autoScroll').checked) {
                    loopInterval = setInterval(() => {
                        lyricsElement.scrollTop = 0;
                        setTimeout(() => {
                            lyricsElement.scrollTop = lyricsElement.scrollHeight;
                        }, 100);
                    }, 3000);
                }
            }
        });
        
        document.getElementById('stopSectionLoop').addEventListener('click', () => {
            isLooping = false;
            document.getElementById('startSectionLoop').style.display = 'inline-block';
            document.getElementById('stopSectionLoop').style.display = 'none';
            
            const lyricsElement = contentDiv.querySelector('.section-lyrics');
            lyricsElement.classList.remove('looping');
            
            if (loopInterval) {
                clearInterval(loopInterval);
                loopInterval = null;
            }
        });
    }

    showAddToRoutineModal(songId) {
        const song = this.app.findSongById(songId);
        if (!song) return;

        const modalHtml = `
            <div class="modal-overlay" id="addToRoutineModalOverlay" style="display:flex;">
                <div class="modal">
                    <button class="close-modal" id="closeAddToRoutineModalBtn" title="Cerrar">×</button>
                    <h2>Añadir "${song.title}" a Rutina</h2>
                    <form id="addToRoutineForm">
                        <label for="routineSelectForSong">Rutina</label>
                        <select id="routineSelectForSong" class="styled-select" required>
                            <option value="">-- Seleccionar rutina --</option>
                            ${this.app.appData.routines.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                        </select>
                        <div class="form-grid">
                            <div>
                                <label for="songDurationInput">Duración (min)</label>
                                <input type="number" id="songDurationInput" min="1" max="60" value="10" required class="styled-input">
                            </div>
                            <div>
                                <label for="songKeyInput">Tonalidad</label>
                                <input type="text" id="songKeyInput" value="${song.defaultKey}" required class="styled-input">
                            </div>
                        </div>
                        <label for="songNotesInput">Notas</label>
                        <textarea id="songNotesInput" placeholder="Notas para la práctica..." class="styled-input"></textarea>
                        <div class="modal-actions">
                            <button type="button" class="btn-cancel button" id="cancelAddToRoutineBtn">Cancelar</button>
                            <button type="submit" class="btn-save button">Añadir</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('addToRoutineModalOverlay');
        const form = document.getElementById('addToRoutineForm');
        const closeBtn = document.getElementById('closeAddToRoutineModalBtn');
        const cancelBtn = document.getElementById('cancelAddToRoutineBtn');

        closeBtn.addEventListener('click', () => this.closeAddToRoutineModal());
        cancelBtn.addEventListener('click', () => this.closeAddToRoutineModal());
        modal.addEventListener('click', e => {
            if (e.target === modal) this.closeAddToRoutineModal();
        });

        form.addEventListener('submit', e => {
            e.preventDefault();
            
            const routineId = document.getElementById('routineSelectForSong').value;
            const duration = parseInt(document.getElementById('songDurationInput').value);
            const key = document.getElementById('songKeyInput').value;
            const notes = document.getElementById('songNotesInput').value;

            const routine = this.app.appData.routines.find(r => r.id === routineId);
            if (routine) {
                routine.items.push({
                    type: 'song',
                    duration: duration,
                    params: {
                        songId: songId,
                        key: key,
                        notes: notes
                    }
                });
                
                this.app.saveData();
                this.app.practicePlanner.renderRoutineList();
                this.closeAddToRoutineModal();
                this.closeSongPracticeModal();
            }
        });
    }

    closeAddToRoutineModal() {
        const modal = document.getElementById('addToRoutineModalOverlay');
        if (modal) {
            modal.remove();
        }
    }

    closeSongPracticeModal() {
        const modal = document.getElementById('songPracticeModalOverlay');
        if (modal) {
            modal.remove();
        }
        this.app.closeModal();
    }

    deleteSong(songId) { const song = this.app.findSongById(songId); this.app.showConfirmation(`¿Estás seguro de que quieres eliminar "${song.title}"? También se eliminará de todos los setlists y rutinas.`, () => { this.app.appData.songs = this.app.appData.songs.filter(s => s.id !== songId); this.app.appData.setlists.forEach(setlist => { setlist.items = setlist.items.filter(item => item.songId !== songId); }); this.app.appData.routines.forEach(routine => { routine.items = routine.items.filter(item => !(item.type === 'song' && item.params.songId === songId)); }); this.app.saveData(); this.renderSongList(); this.app.setlistManager.renderSetlistList(); this.app.practicePlanner.renderRoutineList(); }); }
}

class SetlistManager {
    constructor(app) { this.app = app; this.currentSetlistId = null; this.currentSetlistItemIndex = 0; this.setupSetlistModal(); this.setupAddSongToSetlistModal(); this.setupPerformanceMode(); }
    setupSetlistModal() { this.modalOverlay = document.getElementById('setlistModalOverlay'); this.form = document.getElementById('setlistForm'); this.closeBtn = document.getElementById('closeSetlistModalBtn'); this.cancelBtn = document.getElementById('cancelSetlistModalBtn'); this.editingSetlistId = null; document.getElementById('createSetlistBtn').addEventListener('click', () => this.showSetlistModal()); this.closeBtn.addEventListener('click', () => this.closeSetlistModal()); this.cancelBtn.addEventListener('click', () => this.closeSetlistModal()); this.modalOverlay.addEventListener('click', e => { if (e.target === this.modalOverlay) this.closeSetlistModal(); }); this.form.addEventListener('submit', e => this.handleSetlistFormSubmit(e)); }
    showSetlistModal(setlistId = null) { this.editingSetlistId = setlistId; if (setlistId) { const setlist = this.app.appData.setlists.find(s => s.id === setlistId); document.getElementById('setlistModalTitle').textContent = 'Editar Setlist'; document.getElementById('setlistNameInput').value = setlist.name; } else { document.getElementById('setlistModalTitle').textContent = 'Crear Setlist'; this.form.reset(); } this.modalOverlay.style.display = 'flex'; this.app.openModal(); }
    closeSetlistModal() { this.modalOverlay.style.display = 'none'; this.app.closeModal(); }
    handleSetlistFormSubmit(e) { e.preventDefault(); const name = document.getElementById('setlistNameInput').value; if (this.editingSetlistId) { this.app.appData.setlists.find(s => s.id === this.editingSetlistId).name = name; } else { this.app.appData.setlists.push({ id: `setlist_${Date.now()}`, name: name, items: [] }); } this.app.saveData(); this.renderSetlistList(); this.closeSetlistModal(); }
    setupAddSongToSetlistModal() { 
        this.addSongModalOverlay = document.getElementById('addSongToSetlistModalOverlay'); 
        this.addSongForm = document.getElementById('addSongToSetlistForm'); 
        this.addSongCloseBtn = document.getElementById('closeAddSongToSetlistModalBtn'); 
        this.setlistToAddSongTo = null; 
        
        this.addSongCloseBtn.addEventListener('click', () => this.closeAddSongModal()); 
        this.addSongModalOverlay.addEventListener('click', e => { 
            if (e.target === this.addSongModalOverlay) this.closeAddSongModal(); 
        }); 
        
        // Configurar búsqueda de canciones
        const searchInput = document.getElementById('songSearchInput');
        const songSelect = document.getElementById('songSelectForSetlist');
        
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterSongsInSetlistModal());
        }
        
        songSelect.addEventListener('change', e => { 
            const song = this.app.findSongById(e.target.value); 
            if (song) { 
                document.getElementById('setlistItemKey').value = song.defaultKey; 
                document.getElementById('setlistItemBpm').value = song.defaultBpm; 
            } 
        }); 
        
        this.addSongForm.addEventListener('submit', e => { 
            e.preventDefault(); 
            const setlistItem = { 
                songId: document.getElementById('songSelectForSetlist').value, 
                key: document.getElementById('setlistItemKey').value, 
                bpm: parseInt(document.getElementById('setlistItemBpm').value), 
                notes: document.getElementById('setlistItemNotes').value 
            }; 
            this.app.appData.setlists.find(s => s.id === this.setlistToAddSongTo).items.push(setlistItem); 
            this.app.saveData(); 
            this.renderSetlistList(); 
            this.closeAddSongModal(); 
        }); 
    }

    filterSongsInSetlistModal() {
        const searchInput = document.getElementById('songSearchInput');
        const songSelect = document.getElementById('songSelectForSetlist');
        const searchTerm = searchInput.value.toLowerCase();
        
        // Obtener todas las canciones
        const allSongs = this.app.appData.songs.filter(song => !song.archived); // No mostrar archivadas
        
        // Filtrar por término de búsqueda
        const filteredSongs = allSongs.filter(song => 
            song.title.toLowerCase().includes(searchTerm) ||
            (song.artist && song.artist.toLowerCase().includes(searchTerm)) ||
            (song.tags && song.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
        
        // Actualizar el select
        songSelect.innerHTML = '<option value="">-- Elige una canción --</option>';
        filteredSongs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.id;
            option.textContent = `${song.title}${song.artist ? ` - ${song.artist}` : ''}`;
            songSelect.appendChild(option);
        });
    }

    showAddSongModal(setlistId) { 
        this.setlistToAddSongTo = setlistId; 
        
        // Limpiar búsqueda y poblar canciones
        const searchInput = document.getElementById('songSearchInput');
        const songSelect = document.getElementById('songSelectForSetlist');
        
        if (searchInput) searchInput.value = '';
        
        songSelect.innerHTML = '<option value="">-- Elige una canción --</option>'; 
        if (this.app.appData.songs.length === 0) { 
            this.app.showConfirmation("Primero debes añadir canciones a tu repertorio.", () => this.app.showSection('songs')); 
            return; 
        } 
        
        // Solo mostrar canciones no archivadas
        const activeSongs = this.app.appData.songs.filter(song => !song.archived);
        activeSongs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.id;
            option.textContent = `${song.title}${song.artist ? ` - ${song.artist}` : ''}`;
            songSelect.appendChild(option);
        });
        
        this.addSongForm.reset(); 
        this.addSongModalOverlay.style.display = 'flex'; 
        this.app.openModal(); 
    }
    closeAddSongModal() { this.addSongModalOverlay.style.display = 'none'; this.app.closeModal(); }
    renderSetlistList() { const container = document.getElementById('setlistListContainer'); container.innerHTML = ''; if (this.app.appData.setlists.length === 0) { container.innerHTML = `<div class="empty-state"><h3>No has creado ningún setlist.</h3><p>Crea uno para organizar tu próximo servicio o ensayo.</p></div>`; return; } this.app.appData.setlists.forEach(setlist => { const setlistCard = document.createElement('div'); setlistCard.className = 'item-card-large'; setlistCard.dataset.setlistId = setlist.id; let itemsHtml = setlist.items.map((item, index) => { const song = this.app.findSongById(item.songId); return song ? `<li data-setlist-id="${setlist.id}" data-index="${index}"><span>${index + 1}. ${song.title} (${item.key}, ${item.bpm} BPM)</span><button class="delete-item-btn" title="Quitar">×</button></li>` : ''; }).join(''); setlistCard.innerHTML = `<div class="item-card-header"><h3>${setlist.name}</h3><div class="item-card-actions"><button class="button small-btn export-pdf" data-id="${setlist.id}">📄 PDF</button><button class="button small-btn-secondary add-song-to-setlist" data-id="${setlist.id}">+ Añadir</button><button class="button small-btn edit-setlist" data-id="${setlist.id}">✏️ Editar</button><button class="button small-btn-danger delete-setlist" data-id="${setlist.id}">🗑️ Borrar</button></div></div><ul class="list-items setlist-items" data-setlist-id="${setlist.id}">${itemsHtml || '<p class="empty-list-msg">Setlist vacío.</p>'}</ul><button class="button btn-primary start-performance" data-id="${setlist.id}" ${setlist.items.length === 0 ? 'disabled' : ''}>▶️ Performance</button>`; container.appendChild(setlistCard); }); container.querySelectorAll('.add-song-to-setlist').forEach(btn => btn.addEventListener('click', e => this.showAddSongModal(e.currentTarget.dataset.id))); container.querySelectorAll('.edit-setlist').forEach(btn => btn.addEventListener('click', e => this.showSetlistModal(e.currentTarget.dataset.id))); container.querySelectorAll('.delete-setlist').forEach(btn => btn.addEventListener('click', e => this.deleteSetlist(e.currentTarget.dataset.id))); container.querySelectorAll('.start-performance').forEach(btn => btn.addEventListener('click', e => this.startPerformanceMode(e.currentTarget.dataset.id))); container.querySelectorAll('.export-pdf').forEach(btn => btn.addEventListener('click', e => this.exportSetlistToPDF(e.currentTarget.dataset.id))); container.querySelectorAll('.setlist-items li .delete-item-btn').forEach(btn => { btn.addEventListener('click', e => { const itemEl = e.currentTarget.parentElement; this.removeSongFromSetlist(itemEl.dataset.setlistId, parseInt(itemEl.dataset.index)); }); }); document.querySelectorAll('.setlist-items').forEach(list => { if (typeof Sortable !== 'undefined') { Sortable.create(list, { animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => { const setlistId = evt.target.dataset.setlistId; const setlist = this.app.appData.setlists.find(s => s.id === setlistId); const [movedItem] = setlist.items.splice(evt.oldIndex, 1); setlist.items.splice(evt.newIndex, 0, movedItem); this.app.saveData(); this.renderSetlistList(); } }); } }); this.app.filterGlobalSearch(); }
    exportSetlistToPDF(setlistId) { 
        this.currentExportSetlistId = setlistId;
        this.showPdfExportOptionsModal();
    }
    
    showPdfExportOptionsModal() {
        const modal = document.getElementById('pdfExportOptionsModalOverlay');
        const form = document.getElementById('pdfExportOptionsForm');
        const closeBtn = document.getElementById('closePdfExportOptionsModalBtn');
        const cancelBtn = document.getElementById('cancelPdfExportBtn');
        
        // Configurar eventos si no están configurados
        if (!this.pdfExportModalSetup) {
            closeBtn.addEventListener('click', () => this.closePdfExportOptionsModal());
            cancelBtn.addEventListener('click', () => this.closePdfExportOptionsModal());
            modal.addEventListener('click', e => {
                if (e.target === modal) this.closePdfExportOptionsModal();
            });
            form.addEventListener('submit', e => this.handlePdfExportSubmit(e));
            this.pdfExportModalSetup = true;
        }
        
        modal.style.display = 'flex';
        this.app.openModal();
    }
    
    closePdfExportOptionsModal() {
        const modal = document.getElementById('pdfExportOptionsModalOverlay');
        modal.style.display = 'none';
        this.app.closeModal();
    }
    
    handlePdfExportSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const options = {
            includeNotes: formData.get('includeNotes') === 'on',
            includeArtist: formData.get('includeArtist') === 'on',
            includeChords: formData.get('includeChords') === 'on',
            includeTags: formData.get('includeTags') === 'on',
            compactFormat: formData.get('compactFormat') === 'on',
            includePageNumbers: formData.get('includePageNumbers') === 'on'
        };
        
        this.generatePdfWithOptions(this.currentExportSetlistId, options);
        this.closePdfExportOptionsModal();
    }
    
    generatePdfWithOptions(setlistId, options) {
        const setlist = this.app.appData.setlists.find(s => s.id === setlistId);
        if (!setlist) return;
        
        let content = `<div style="font-family: sans-serif; padding: 40px; color: #2c3e50;">`;
        
        // Header
        content += `<h1 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 10px;">${setlist.name}</h1>`;
        content += `<h3 style="color: #6c757d; margin-top: 0;">${new Date().toLocaleDateString()}</h3>`;
        
        if (setlist.items.length > 0) {
            const listStyle = options.compactFormat ? 
                'list-style: none; padding: 0;' : 
                'list-style: none; padding: 0;';
            
            content += `<ul style="${listStyle}">`;
            
            setlist.items.forEach((item, index) => {
                const song = this.app.findSongById(item.songId);
                if (!song) return;
                
                const itemStyle = options.compactFormat ?
                    'background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px;' :
                    'background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;';
                
                content += `<li style="${itemStyle}">`;
                content += `<h2 style="margin: 0 0 10px 0;">${index + 1}. ${song.title}</h2>`;
                
                // Información básica
                if (options.includeArtist && song.artist) {
                    content += `<p style="margin: 5px 0;"><strong>Artista:</strong> ${song.artist}</p>`;
                }
                content += `<p style="margin: 5px 0;"><strong>Tonalidad:</strong> ${item.key}</p>`;
                content += `<p style="margin: 5px 0;"><strong>BPM:</strong> ${item.bpm}</p>`;
                
                // Tags
                if (options.includeTags && song.tags && song.tags.length > 0) {
                    content += `<p style="margin: 5px 0;"><strong>Tags:</strong> ${song.tags.join(', ')}</p>`;
                }
                
                // Notas de performance
                if (options.includeNotes && item.notes) {
                    content += `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">`;
                    content += `<p><strong>Notas:</strong></p>`;
                    content += `<p style="white-space: pre-wrap;">${item.notes}</p>`;
                    content += `</div>`;
                }
                
                // Letra con acordes (si está habilitado)
                if (options.includeChords && song.lyrics) {
                    content += `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">`;
                    content += `<p><strong>Letra y Acordes:</strong></p>`;
                    content += `<pre style="white-space: pre-wrap; font-family: monospace; background: #f1f3f4; padding: 10px; border-radius: 4px; margin: 0;">${song.lyrics}</pre>`;
                    content += `</div>`;
                }
                
                content += `</li>`;
            });
            
            content += '</ul>';
        } else {
            content += '<p>Este setlist está vacío.</p>';
        }
        
        content += '</div>';
        
        if (typeof html2pdf !== 'undefined') {
            const opt = {
                margin: options.compactFormat ? 0.5 : 1,
                filename: `${setlist.name}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            html2pdf().from(content).set(opt).save();
        }
    }
    deleteSetlist(setlistId) { this.app.showConfirmation('¿Seguro que quieres eliminar este setlist?', () => { this.app.appData.setlists = this.app.appData.setlists.filter(s => s.id !== setlistId); this.app.saveData(); this.renderSetlistList(); }); }
    removeSongFromSetlist(setlistId, itemIndex) { const setlist = this.app.appData.setlists.find(s => s.id === setlistId); if (setlist) { setlist.items.splice(itemIndex, 1); this.app.saveData(); this.renderSetlistList(); } }
    setupPerformanceMode() { this.perfModeEl = document.getElementById('performance-mode'); document.getElementById('exit-performance-btn').addEventListener('click', () => this.exitPerformanceMode()); document.getElementById('perf-next-btn').addEventListener('click', () => this.navigateToSong(1)); document.getElementById('perf-prev-btn').addEventListener('click', () => this.navigateToSong(-1)); }
    startPerformanceMode(setlistId) { const setlist = this.app.appData.setlists.find(s => s.id === setlistId); if (!setlist || setlist.items.length === 0) return; this.currentSetlistId = setlistId; this.currentSetlistItemIndex = 0; this.perfModeEl.classList.remove('hidden'); document.body.style.overflow = 'hidden'; this.loadSongInPerformance(this.currentSetlistItemIndex); }
    exitPerformanceMode() { this.perfModeEl.classList.add('hidden'); document.body.style.overflow = 'auto'; if (this.app.metronome.isPlaying) this.app.metronome.stop(); }
    navigateToSong(direction) { const setlist = this.app.appData.setlists.find(s => s.id === this.currentSetlistId); const newIndex = this.currentSetlistItemIndex + direction; if (newIndex >= 0 && newIndex < setlist.items.length) { this.currentSetlistItemIndex = newIndex; this.loadSongInPerformance(newIndex); } }
    loadSongInPerformance(index) { const setlist = this.app.appData.setlists.find(s => s.id === this.currentSetlistId); const setlistItem = setlist.items[index]; const song = this.app.findSongById(setlistItem.songId); document.getElementById('perf-song-title').textContent = song.title; document.getElementById('perf-key').textContent = setlistItem.key; document.getElementById('perf-bpm').textContent = setlistItem.bpm; document.getElementById('perf-notes').textContent = setlistItem.notes || 'No hay notas para esta canción.'; this.app.metronome.setBpm(setlistItem.bpm); document.getElementById('perf-prev-btn').disabled = index === 0; document.getElementById('perf-next-btn').disabled = index === setlist.items.length - 1; }
}

class PracticePlanner {
    constructor(app) {
        this.app = app;
        this.editingRoutineId = null;
        this.routineToAddItemTo = null;
        this.setupRoutineModal();
        this.setupRoutineItemModal();
    }

    setupRoutineModal() {
        this.modal = {
            overlay: document.getElementById('routineModalOverlay'),
            form: document.getElementById('routineForm'),
            title: document.getElementById('routineModalTitle'),
            closeBtn: document.getElementById('closeRoutineModalBtn'),
            cancelBtn: document.getElementById('cancelRoutineModalBtn')
        };
        document.getElementById('createRoutineBtn').addEventListener('click', () => this.showRoutineModal());
        this.modal.closeBtn.addEventListener('click', () => this.closeRoutineModal());
        this.modal.cancelBtn.addEventListener('click', () => this.closeRoutineModal());
        this.modal.overlay.addEventListener('click', e => { if (e.target === this.modal.overlay) this.closeRoutineModal(); });
        this.modal.form.addEventListener('submit', e => this.handleRoutineFormSubmit(e));
    }

    showRoutineModal(routineId = null) {
        this.editingRoutineId = routineId;
        if (routineId) {
            const routine = this.app.appData.routines.find(r => r.id === routineId);
            this.modal.title.textContent = 'Editar Rutina';
            this.modal.form.name.value = routine.name;
        } else {
            this.modal.title.textContent = 'Nueva Rutina';
            this.modal.form.reset();
        }
        this.modal.overlay.style.display = 'flex';
        this.app.openModal();
    }

    closeRoutineModal() {
        this.modal.overlay.style.display = 'none';
        this.app.closeModal();
    }

    handleRoutineFormSubmit(e) {
        e.preventDefault();
        const name = this.modal.form.name.value;
        if (this.editingRoutineId) {
            this.app.appData.routines.find(r => r.id === this.editingRoutineId).name = name;
        } else {
            this.app.appData.routines.push({ id: `routine_${Date.now()}`, name, items: [] });
        }
        this.app.saveData();
        this.renderRoutineList();
        this.closeRoutineModal();
    }

    setupRoutineItemModal() {
        this.itemModal = {
            overlay: document.getElementById('routineItemModalOverlay'),
            form: document.getElementById('routineItemForm'),
            closeBtn: document.getElementById('closeRoutineItemModalBtn'),
            typeSelect: document.getElementById('routineItemTypeSelect'),
            paramsContainer: document.getElementById('routineItemParamsContainer')
        };
        this.itemModal.closeBtn.addEventListener('click', () => this.closeRoutineItemModal());
        this.itemModal.overlay.addEventListener('click', e => { if (e.target === this.itemModal.overlay) this.closeRoutineItemModal(); });
        this.itemModal.typeSelect.addEventListener('change', () => this.renderRoutineItemParams());
        this.itemModal.form.addEventListener('submit', e => this.handleRoutineItemFormSubmit(e));
    }

    showRoutineItemModal(routineId) {
        this.routineToAddItemTo = routineId;
        this.itemModal.form.reset();
        this.renderRoutineItemParams();
        this.itemModal.overlay.style.display = 'flex';
        this.app.openModal();
    }

    closeRoutineItemModal() {
        this.itemModal.overlay.style.display = 'none';
        this.app.closeModal();
    }
    
    renderRoutineItemParams() {
        const type = this.itemModal.typeSelect.value;
        const container = this.itemModal.paramsContainer;
        container.innerHTML = '';
        
        if (type === 'scale') {
            const { rootSelect, scaleSelect } = this.app.scaleVisualizer.getSelectsAsHtml('item');
            container.innerHTML = `
                <div class="form-grid">
                    <div><label for="itemRootNoteSelect">Tónica</label>${rootSelect}</div>
                    <div><label for="itemScaleTypeSelect">Tipo de Escala</label>${scaleSelect}</div>
                </div>`;
        } else if (type === 'song') {
            const songs = this.app.appData.songs;
            if (songs.length > 0) {
                 container.innerHTML = `<label for="itemSongSelect">Canción</label><select id="itemSongSelect" name="songId" class="styled-select">${songs.map(s => `<option value="${s.id}">${s.title}</option>`).join('')}</select>`;
            } else {
                container.innerHTML = `<p class="empty-list-msg">No hay canciones en el repertorio. Añade una primero.</p>`;
            }
        } else if (type === 'custom') {
            container.innerHTML = `<label for="itemCustomDescription">Descripción</label><input type="text" id="itemCustomDescription" name="description" class="styled-input" placeholder="Ej: Ejercicios de púa alterna" required>`;
        }
    }

    handleRoutineItemFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(this.itemModal.form);
        const item = {
            duration: formData.get('duration'),
            type: formData.get('type'),
            params: {}
        };
        
        if (item.type === 'scale') {
            item.params.rootNote = formData.get('rootNote');
            item.params.scaleType = formData.get('scaleType');
        } else if (item.type === 'song') {
            item.params.songId = formData.get('songId');
        } else if (item.type === 'custom') {
            item.params.description = formData.get('description');
        }

        if ((item.type === 'song' && !item.params.songId) || (item.type === 'custom' && !item.params.description)) {
            return;
        }

        const routine = this.app.appData.routines.find(r => r.id === this.routineToAddItemTo);
        routine.items.push(item);

        this.app.saveData();
        this.renderRoutineList();
        this.closeRoutineItemModal();
    }

    renderRoutineList() {
        const container = document.getElementById('routineListContainer');
        container.innerHTML = '';
        if (this.app.appData.routines.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>No has creado ninguna rutina de práctica.</h3><p>¡Crea una para estructurar tu estudio!</p></div>`;
            return;
        }

        this.app.appData.routines.forEach(routine => {
            const card = document.createElement('div');
            card.className = 'item-card-large';
            card.dataset.routineId = routine.id;

            let totalDuration = routine.items.reduce((sum, item) => sum + parseInt(item.duration), 0);

            const itemsHtml = routine.items.map((item, index) => {
                let description = '';
                switch (item.type) {
                    case 'scale':
                        description = `<strong>Escala:</strong> ${item.params.rootNote} ${this.app.scaleVisualizer.scaleSelect.options[this.app.scaleVisualizer.scales[item.params.scaleType] ? Object.keys(this.app.scaleVisualizer.scales).indexOf(item.params.scaleType) : 0].text}`;
                        break;
                    case 'song':
                        const song = this.app.findSongById(item.params.songId);
                        description = `<strong>Canción:</strong> ${song ? song.title : 'Canción eliminada'}`;
                        break;
                    case 'custom':
                        description = `<strong>Tarea:</strong> ${item.params.description}`;
                        break;
                }
                return `<li class="task-item" data-routine-id="${routine.id}" data-index="${index}"><span class="duration">${item.duration} min</span><span class="description">${description}</span><button class="delete-item-btn" title="Quitar">×</button></li>`;
            }).join('');

            card.innerHTML = `
                <div class="item-card-header">
                    <h3>${routine.name} <span style="font-weight:400; color:var(--text-secondary);font-size:0.9rem;">(${totalDuration} min)</span></h3>
                    <div class="item-card-actions">
                        <button class="button small-btn-secondary add-item-to-routine" data-id="${routine.id}">+ Añadir Tarea</button>
                        <button class="button small-btn edit-routine" data-id="${routine.id}">✏️ Editar</button>
                        <button class="button small-btn-danger delete-routine" data-id="${routine.id}">🗑️ Borrar</button>
                    </div>
                </div>
                <ul class="list-items routine-items" data-routine-id="${routine.id}">
                    ${itemsHtml || '<p class="empty-list-msg">Rutina vacía. Añade tareas para empezar.</p>'}
                </ul>`;

            container.appendChild(card);
        });

        container.querySelectorAll('.add-item-to-routine').forEach(b => b.addEventListener('click', e => this.showRoutineItemModal(e.currentTarget.dataset.id)));
        container.querySelectorAll('.edit-routine').forEach(b => b.addEventListener('click', e => this.showRoutineModal(e.currentTarget.dataset.id)));
        container.querySelectorAll('.delete-routine').forEach(b => b.addEventListener('click', e => this.deleteRoutine(e.currentTarget.dataset.id)));
        container.querySelectorAll('.routine-items .delete-item-btn').forEach(b => b.addEventListener('click', e => {
            e.stopPropagation();
            const itemEl = e.currentTarget.parentElement;
            this.removeItemFromRoutine(itemEl.dataset.routineId, parseInt(itemEl.dataset.index));
        }));
        container.querySelectorAll('.task-item').forEach(li => li.addEventListener('click', e => {
             if (e.target.tagName === 'BUTTON') return;
             this.executeTask(li.dataset.routineId, parseInt(li.dataset.index));
        }));
        this.app.filterGlobalSearch();
    }

    deleteRoutine(routineId) {
        this.app.showConfirmation('¿Seguro que quieres eliminar esta rutina?', () => {
            this.app.appData.routines = this.app.appData.routines.filter(r => r.id !== routineId);
            this.app.saveData();
            this.renderRoutineList();
        });
    }

    removeItemFromRoutine(routineId, itemIndex) {
        const routine = this.app.appData.routines.find(r => r.id === routineId);
        if (routine) {
            routine.items.splice(itemIndex, 1);
            this.app.saveData();
            this.renderRoutineList();
        }
    }

    executeTask(routineId, itemIndex) {
        const routine = this.app.appData.routines.find(r => r.id === routineId);
        if (!routine || !routine.items[itemIndex]) return;

        const item = routine.items[itemIndex];
        
        switch (item.type) {
            case 'scale':
                this.app.showSection('scales');
                // Configurar la escala automáticamente
                const scaleSelect = document.getElementById('scaleTypeSelect');
                const rootSelect = document.getElementById('rootNoteSelect');
                if (scaleSelect && rootSelect) {
                    scaleSelect.value = item.params.scaleType;
                    rootSelect.value = item.params.rootNote;
                    // Trigger change event
                    scaleSelect.dispatchEvent(new Event('change'));
                    rootSelect.dispatchEvent(new Event('change'));
                }
                break;
            case 'song':
                const song = this.app.findSongById(item.params.songId);
                if (song) {
                    // Configurar metrónomo con BPM de la canción
                    if (song.defaultBpm) {
                        this.app.metronome.setBpm(song.defaultBpm);
                    }
                    this.app.showSection('songs');
                }
                break;
            case 'custom':
                // Mostrar mensaje personalizado
                alert(`Tarea: ${item.params.description}`);
                break;
        }
    }
}

class ProgressionAnalyzer {
    constructor(app) { 
        this.app = app; 
        this.notes = "C C# D D# E F F# G G# A A# B".split(" "); 
        this.majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11]; 
        this.majorScaleDegrees = [{ roman: "I", type: "major" }, { roman: "ii", type: "minor" }, { roman: "iii", type: "minor" }, { roman: "IV", type: "major" }, { roman: "V", type: "major" }, { roman: "vi", type: "minor" }, { roman: "vii°", type: "diminished" }]; 
        const analyzeBtn = document.getElementById('analyzeProgressionBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyze()); 
        }
    }
    parseChord(str) { const match = str.trim().match(/^([A-G][#b]?)(.*)/); if (!match) return null; let root = match[1].replace('b', '#'); let quality = 'major'; if (match[2].includes('m') && !match[2].includes('maj')) quality = 'minor'; if (match[2].includes('dim') || match[2].includes('°')) quality = 'diminished'; return { root, type: quality, original: str.trim() }; }
    getScaleNotes(rootNote) { const rootIndex = this.notes.indexOf(rootNote); return this.majorScaleIntervals.map(i => this.notes[(rootIndex + i) % 12]); }
    analyze() { 
        const resultDiv = document.getElementById('progressionResult'); 
        const inputElement = document.getElementById('progressionInput');
        
        if (!resultDiv || !inputElement) {
            console.warn('Elementos del analizador de progresiones no encontrados');
            return;
        }
        
        const chords = inputElement.value.split(/[\s,|]+/).filter(c => c).map(c => this.parseChord(c)).filter(Boolean); 
        if (chords.length === 0) { 
            resultDiv.innerHTML = `<p>Por favor, introduce una progresión válida.</p>`; 
            return; 
        } 
        let bestKey = { key: null, score: -1 }; 
        this.notes.forEach(keyNote => { 
            const scaleNotes = this.getScaleNotes(keyNote); 
            const harmonicField = this.majorScaleDegrees.map((d, i) => ({ ...d, root: scaleNotes[i] })); 
            let score = 0; 
            chords.forEach(chord => { 
                if (harmonicField.some(fc => fc.root === chord.root && fc.type === chord.type)) score++; 
            }); 
            if (score > bestKey.score) bestKey = { key: keyNote, score }; 
        }); 
        if (bestKey.key && bestKey.score > 0) { 
            const key = bestKey.key; 
            const romanNumerals = chords.map(chord => { 
                const scaleNotes = this.getScaleNotes(key); 
                const hf = this.majorScaleDegrees.map((d, i) => ({ ...d, root: scaleNotes[i] })); 
                const fc = hf.find(f => f.root === chord.root && f.type === chord.type); 
                return fc ? `<span class="roman-numeral-pill">${fc.roman}</span>` : `<span class="roman-numeral-pill error">?</span>`; 
            }).join(''); 
            resultDiv.innerHTML = `<div class="analysis-item"><span class="analysis-label">Tonalidad:</span> <span class="roman-numeral-pill main-key">${key} Mayor</span></div><div class="analysis-item"><span class="analysis-label">Grados:</span> <div class="roman-numeral-progression">${romanNumerals}</div></div><div class="analysis-item"><span class="analysis-label">Escalas:</span> <ul><li>${key} Mayor</li><li>${this.getScaleNotes(key)[5]} Pentatónica menor</li></ul></div>`; 
        } else { 
            resultDiv.innerHTML = `<p>No se pudo determinar una tonalidad clara.</p>`; 
        } 
    }
}

class IdeaRecorder {
    constructor(app) { 
        this.app = app; 
        this.recBtn = document.getElementById('recBtn'); 
        this.recTime = document.getElementById('recTime'); 
        this.recList = document.getElementById('recList'); 
        this.recStatus = document.getElementById('recStatus'); 
        this.mediaRecorder = null; 
        this.isRecording = false; 
        this.chunks = []; 
        this.timerInterval = null; 
        this.startTime = 0; 
        this.setupEvents(); 
    }
    setupEvents() { 
        if (this.recBtn) {
            this.recBtn.addEventListener('click', () => this.toggleRecording()); 
        }
    }
    async toggleRecording() { if (this.isRecording) this.stopRecording(); else await this.startRecording(); }
    async startRecording() { 
        try { 
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
            this.mediaRecorder = new MediaRecorder(stream); 
            this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data); 
            this.mediaRecorder.onstop = () => this.saveRecording(); 
            this.chunks = []; 
            this.mediaRecorder.start(); 
            this.isRecording = true; 
            if (this.recBtn) this.recBtn.textContent = '■ Detener'; 
            if (this.recBtn) this.recBtn.classList.add('recording'); 
            if (this.recStatus) this.recStatus.textContent = "Grabando..."; 
            this.startTimer(); 
        } catch (err) { 
            if (this.recStatus) this.recStatus.textContent = "Error: No se pudo acceder al micrófono."; 
        } 
    }
    stopRecording() { 
        if (!this.mediaRecorder || !this.isRecording) return; 
        this.mediaRecorder.stop(); 
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop()); 
        this.isRecording = false; 
        if (this.recBtn) this.recBtn.textContent = '● Grabar'; 
        if (this.recBtn) this.recBtn.classList.remove('recording'); 
        if (this.recStatus) this.recStatus.textContent = "Procesando..."; 
        this.stopTimer(); 
    }
    startTimer() { 
        this.startTime = Date.now(); 
        this.timerInterval = setInterval(() => { 
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000); 
            const m = String(Math.floor(elapsed / 60)).padStart(2, '0'); 
            const s = String(elapsed % 60).padStart(2, '0'); 
            if (this.recTime) this.recTime.textContent = `${m}:${s}`; 
        }, 1000); 
    }
    stopTimer() { 
        clearInterval(this.timerInterval); 
        if (this.recTime) this.recTime.textContent = "00:00"; 
    }
    saveRecording() { 
        const blob = new Blob(this.chunks, { type: 'audio/webm' }); 
        const reader = new FileReader(); 
        reader.onloadend = () => { 
            const rec = { id: `rec_${Date.now()}`, name: `Grabación ${new Date().toLocaleString()}`, dataUrl: reader.result }; 
            this.app.appData.recordings.unshift(rec); 
            this.app.saveData(); 
            this.renderRecordings(); 
            this.chunks = []; 
            if (this.recStatus) this.recStatus.textContent = "Grabación guardada."; 
        }; 
        reader.readAsDataURL(blob); 
    }
    renderRecordings() { 
        if (!this.recList) return;
        this.recList.innerHTML = ''; 
        this.app.appData.recordings.forEach(rec => { 
            const li = document.createElement('li'); 
            li.innerHTML = `<div class="rec-info"><input type="text" value="${rec.name}" data-id="${rec.id}" class="rec-name-input" /><audio controls src="${rec.dataUrl}"></audio></div><button class="button small-btn-danger delete-rec" data-id="${rec.id}">🗑️</button>`; 
            this.recList.appendChild(li); 
        }); 
        this.recList.querySelectorAll('.rec-name-input').forEach(i => i.addEventListener('change', e => this.updateRecordingName(e.target.dataset.id, e.target.value))); 
        this.recList.querySelectorAll('.delete-rec').forEach(b => b.addEventListener('click', e => this.deleteRecording(e.target.dataset.id))); 
    }
    updateRecordingName(id, name) { const rec = this.app.appData.recordings.find(r => r.id === id); if (rec) { rec.name = name; this.app.saveData(); } }
    deleteRecording(id) { this.app.showConfirmation('¿Seguro que quieres borrar esta grabación?', () => { this.app.appData.recordings = this.app.appData.recordings.filter(r => r.id !== id); this.app.saveData(); this.renderRecordings(); }); }
}

class ScaleVisualizer {
    constructor(app) {
        this.app = app; 
        this.notes = "C C# D D# E F F# G G# A A# B".split(" "); 
        
        // Definir afinaciones disponibles
        this.tunings = {
            standard: [4, 9, 2, 7, 11, 4], // EADGBE
            'drop-d': [2, 9, 2, 7, 11, 4], // DADGBE
            'open-g': [2, 7, 2, 7, 11, 2], // DGDGBD
            'open-d': [2, 9, 2, 6, 9, 2], // DADF#AD
            'dadgad': [2, 9, 2, 7, 9, 2], // DADGAD
            'half-step-down': [3, 8, 1, 6, 10, 3], // EbAbDbGbBbEb
            'full-step-down': [2, 7, 0, 5, 9, 2] // DGCFAD
        };
        
        this.tuning = this.tunings.standard; // Afinación por defecto
        
        this.scales = {
            major: [0, 2, 4, 5, 7, 9, 11], 
            minor: [0, 2, 3, 5, 7, 8, 10], 
            "pentatonic-major": [0, 2, 4, 7, 9],
            "pentatonic-minor": [0, 3, 5, 7, 10], 
            "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10], 
            dorian: [0, 2, 3, 5, 7, 9, 10]
        };
        this.harmonicFields = {
            major: [{r:"I",t:""},{r:"ii",t:"m"},{r:"iii",t:"m"},{r:"IV",t:""},{r:"V",t:""},{r:"vi",t:"m"},{r:"vii",t:"dim"}],
            minor: [{r:"i",t:"m"},{r:"ii",t:"dim"},{r:"III",t:""},{r:"iv",t:"m"},{r:"v",t:"m"},{r:"VI",t:""},{r:"VII",t:""}],
            "harmonic-minor": [{r:"i",t:"m"},{r:"ii",t:"dim"},{r:"III",t:"aug"},{r:"iv",t:"m"},{r:"V",t:""},{r:"VI",t:""},{r:"vii",t:"dim"}],
            dorian: [{r:"i",t:"m"},{r:"ii",t:"m"},{r:"III",t:""},{r:"IV",t:""},{r:"v",t:"m"},{r:"vi",t:"dim"},{r:"VII",t:""}],
            mixolydian: [{r:"I",t:""},{r:"ii",t:"m"},{r:"iii",t:"dim"},{r:"IV",t:""},{r:"v",t:"m"},{r:"vi",t:"m"},{r:"VII",t:""}]
        };
        
        this.rootSelect = document.getElementById('rootNoteSelect'); 
        this.scaleSelect = document.getElementById('scaleTypeSelect'); 
        this.tuningSelect = document.getElementById('tuningSelect');
        this.fretboardContainer = document.getElementById('fretboardVisualizer'); 
        this.harmonicFieldContainer = document.getElementById('harmonicFieldContainer');
        this.viewSwitcher = document.getElementById('scaleViewSwitcher');
        
        // Verificar que los elementos existan antes de agregar event listeners
        if (this.rootSelect) {
            this.rootSelect.addEventListener('change', () => this.render()); 
        }
        if (this.scaleSelect) {
            this.scaleSelect.addEventListener('change', () => this.render()); 
        }
        if (this.tuningSelect) {
            this.tuningSelect.addEventListener('change', () => this.changeTuning());
        }
        if (this.viewSwitcher) {
            this.viewSwitcher.addEventListener('change', () => this.render());
        }
        
        // Cargar afinación guardada
        this.loadSavedTuning();
    }
    
    changeTuning() {
        if (!this.tuningSelect) return;
        
        const tuningName = this.tuningSelect.value;
        this.tuning = this.tunings[tuningName];
        
        // Guardar en localStorage
        this.app.appData.settings.scaleTuning = tuningName;
        this.app.saveData();
        
        // Re-renderizar
        this.render();
    }
    
    loadSavedTuning() {
        if (!this.tuningSelect) return;
        
        const savedTuning = this.app.appData.settings.scaleTuning;
        if (savedTuning && this.tunings[savedTuning]) {
            this.tuning = this.tunings[savedTuning];
            this.tuningSelect.value = savedTuning;
        }
    }
    
    getSelectsAsHtml(prefix) {
        if (!this.rootSelect || !this.scaleSelect) {
            return { rootSelect: '', scaleSelect: '' };
        }
        
        const rootSelectHtml = `<select id="${prefix}RootNoteSelect" name="rootNote" class="styled-select">${this.rootSelect.innerHTML}</select>`;
        const scaleSelectHtml = `<select id="${prefix}ScaleTypeSelect" name="scaleType" class="styled-select">${this.scaleSelect.innerHTML}</select>`;
        return { rootSelect: rootSelectHtml, scaleSelect: scaleSelectHtml };
    }

    render() {
        if (!this.fretboardContainer || !this.rootSelect || !this.scaleSelect || !this.viewSwitcher) {
            console.warn('Elementos del visualizador de escalas no encontrados');
            return;
        }
        
        this.fretboardContainer.innerHTML = '';
        const visual = this._createFretboardVisual();
        this.fretboardContainer.appendChild(visual);

        const rootNoteName = this.rootSelect.value.split('/')[0].trim(); 
        const rootIndex = this.notes.indexOf(rootNoteName);
        const scaleKey = this.scaleSelect.value; 
        const scaleIntervals = this.scales[scaleKey];
        const currentView = this.viewSwitcher.querySelector('input:checked')?.value || 'scale';
        const isDiatonic = scaleIntervals.length === 7;
        const scaleNoteIndexes = scaleIntervals.map(i => (rootIndex + i) % 12);
        
        let notesToShow = new Set(); 
        let noteClasses = {};

        if (currentView === 'scale' || !isDiatonic) {
            notesToShow = new Set(scaleNoteIndexes);
            scaleNoteIndexes.forEach(n => noteClasses[n] = 'scale-note');
        } else {
            for (let i = 0; i < 7; i++) {
                const degreeRoot = scaleNoteIndexes[i]; 
                const third = scaleNoteIndexes[(i + 2) % 7];
                const fifth = scaleNoteIndexes[(i + 4) % 7];
                if (currentView === 'triads') { 
                    [degreeRoot, third, fifth].forEach(n => { 
                        notesToShow.add(n); 
                        noteClasses[n] = 'triad-note'; 
                    }); 
                } 
                else if (currentView === 'arpeggios') { 
                    const seventh = scaleNoteIndexes[(i + 6) % 7]; 
                    [degreeRoot, third, fifth, seventh].forEach(n => { 
                        notesToShow.add(n); 
                        noteClasses[n] = 'arpeggio-note'; 
                    }); 
                }
            }
        }
        
        const grid = visual.querySelector('.fretboard-grid');
        if (grid) {
            this.tuning.slice().reverse().forEach((openNoteIndex, stringIndex) => {
                for (let fret = 0; fret <= 12; fret++) {
                    const noteIndex = (openNoteIndex + fret) % 12;
                    if (notesToShow.has(noteIndex)) {
                        const cell = grid.querySelector(`.fret-cell[data-string="${5-stringIndex}"][data-fret="${fret}"]`);
                        if (cell) {
                            const dot = document.createElement('div');
                            dot.className = 'note-dot';
                            dot.textContent = this.notes[noteIndex]; 
                            dot.classList.add(noteClasses[noteIndex] || 'scale-note');
                            if (noteIndex === rootIndex) dot.classList.add('root-note');
                            cell.appendChild(dot);
                        }
                    }
                }
            });
        }
        this.renderHarmonicField(rootIndex, scaleKey, scaleIntervals);
    }

    _createFretboardVisual() {
        const visualContainer = document.createElement('div');
        visualContainer.className = 'fretboard-visual';

        for (let i = 0; i < 6; i++) {
            const stringEl = document.createElement('div');
            stringEl.className = `string s-${i}`;
            stringEl.style.top = `${(100 / 12) * (i * 2 + 1)}%`;
            visualContainer.appendChild(stringEl);
        }

        const grid = document.createElement('div');
        grid.className = 'fretboard-grid';
        grid.appendChild(document.createElement('div'));
        for (let fret = 0; fret <= 12; fret++) {
            const label = document.createElement('div');
            label.className = 'fret-number-label';
            label.textContent = fret === 0 ? '' : fret;
            if ([3, 5, 7, 9].includes(fret)) label.classList.add('fret-marker');
            if (fret === 12) label.classList.add('fret-marker-double');
            grid.appendChild(label);
        }
        this.tuning.slice().reverse().forEach((openNoteIndex, stringIndex) => {
            grid.appendChild(Object.assign(document.createElement('div'), { className: 'string-label', textContent: this.notes[openNoteIndex] }));
            for (let fret = 0; fret <= 12; fret++) {
                const cell = document.createElement('div');
                cell.className = 'fret-cell';
                cell.dataset.string = 5 - stringIndex;
                cell.dataset.fret = fret;
                grid.appendChild(cell);
            }
        });
        visualContainer.appendChild(grid);
        return visualContainer;
    }

    renderHarmonicField(rootIndex, scaleKey, scaleIntervals) {
        if (!this.harmonicFieldContainer) return;
        
        this.harmonicFieldContainer.innerHTML = '';
        const degrees = this.harmonicFields[scaleKey]; 
        
        if (!degrees) {
            this.harmonicFieldContainer.style.display = 'block';
            const explanation = document.createElement('p');
            explanation.className = 'empty-list-msg';
            explanation.style.textAlign = 'center';
            explanation.style.padding = '1rem';
            explanation.textContent = 'Las escalas pentatónicas no forman un campo armónico diatónico completo. Selecciona una escala de 7 notas (como Mayor o menor) para ver sus acordes.';
            this.harmonicFieldContainer.appendChild(explanation);
            return;
        }
        this.harmonicFieldContainer.style.display = 'block';

        this.harmonicFieldContainer.appendChild(Object.assign(document.createElement('h4'), {textContent:'Campo Armónico (Acordes de la Escala)'}));
        const chordsContainer = document.createElement('div'); 
        chordsContainer.className = 'roman-numeral-progression';
        degrees.forEach((degree, i) => {
            const noteIndex = (rootIndex + scaleIntervals[i]) % 12; 
            let chordName = this.notes[noteIndex];
            if (degree.t === 'm') chordName += 'm';
            if (degree.t === 'dim') chordName += '°';
            if (degree.t === 'aug') chordName += '+';

            const pill = document.createElement('span'); 
            pill.className = 'roman-numeral-pill';
            pill.innerHTML = `<span class="degree-roman">${degree.r}</span> ${chordName}`;
            chordsContainer.appendChild(pill);
        });
        this.harmonicFieldContainer.appendChild(chordsContainer);
    }
}

class EarTrainer {
    constructor(app) {
        this.app = app;
        this.audioContext = null;
        this.currentNote = null;
        this.currentInterval = null;
        this.currentChord = null;
        this.score = { correct: 0, total: 0 };
        this.mode = 'notes'; // 'notes', 'intervals', 'chords'
        this.setupEarTrainer();
    }

    setupEarTrainer() {
        const container = document.querySelector('.ear-trainer-container');
        container.innerHTML = `
            <h1>👂 Entrenador de Oído</h1>
            <div class="ear-trainer-mode-selector">
                <button class="button mode-btn active" data-mode="notes">🎵 Notas</button>
                <button class="button mode-btn" data-mode="intervals">📏 Intervalos</button>
                <button class="button mode-btn" data-mode="chords">🎸 Acordes</button>
            </div>
            <p id="earTrainerStatus">Pulsa "Tocar Nota" para empezar.</p>
            <div id="earTrainerScore">Aciertos: 0 / Intentos: 0</div>
            <button id="playRandomNoteBtn" class="btn-primary button">▶️ Tocar Nota</button>
            <div id="earTrainerFretboard"></div>
            <div id="earTrainerOptions" class="ear-trainer-options"></div>
        `;

        // Configurar eventos de modo
        container.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
                this.startNewRound();
            });
        });

        document.getElementById('playRandomNoteBtn').addEventListener('click', () => this.playCurrentNote());
        this.startNewRound();
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    playNote(noteIndex, duration = 1.0) {
        this.initAudioContext();
        const time = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        const frequency = 440 * Math.pow(2, (noteIndex - 69) / 12);
        osc.frequency.setValueAtTime(frequency, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        osc.start(time);
        osc.stop(time + duration);
    }

    playInterval(note1, note2, duration = 1.0) {
        this.initAudioContext();
        const time = this.audioContext.currentTime;
        
        // Tocar ambas notas simultáneamente
        [note1, note2].forEach(noteIndex => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            const frequency = 440 * Math.pow(2, (noteIndex - 69) / 12);
            osc.frequency.setValueAtTime(frequency, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.start(time);
            osc.stop(time + duration);
        });
    }

    playChord(notes, duration = 1.5) {
        this.initAudioContext();
        const time = this.audioContext.currentTime;
        
        notes.forEach(noteIndex => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            const frequency = 440 * Math.pow(2, (noteIndex - 69) / 12);
            osc.frequency.setValueAtTime(frequency, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.start(time);
            osc.stop(time + duration);
        });
    }

    startNewRound() {
        const statusEl = document.getElementById('earTrainerStatus');
        const playBtn = document.getElementById('playRandomNoteBtn');
        const optionsEl = document.getElementById('earTrainerOptions');

        switch (this.mode) {
            case 'notes':
                this.currentNote = Math.floor(Math.random() * 12) + 60; // C4 a B4
                statusEl.textContent = 'Escucha la nota y adivina cuál es';
                playBtn.textContent = '▶️ Tocar Nota';
                this.renderNoteOptions();
                break;
            case 'intervals':
                this.currentInterval = this.generateRandomInterval();
                statusEl.textContent = 'Escucha el intervalo y adivina cuál es';
                playBtn.textContent = '▶️ Tocar Intervalo';
                this.renderIntervalOptions();
                break;
            case 'chords':
                this.currentChord = this.generateRandomChord();
                statusEl.textContent = 'Escucha el acorde y adivina su calidad';
                playBtn.textContent = '▶️ Tocar Acorde';
                this.renderChordOptions();
                break;
        }
    }

    generateRandomInterval() {
        const intervals = [
            { name: 'Unísono', semitones: 0 },
            { name: 'Segunda Menor', semitones: 1 },
            { name: 'Segunda Mayor', semitones: 2 },
            { name: 'Tercera Menor', semitones: 3 },
            { name: 'Tercera Mayor', semitones: 4 },
            { name: 'Cuarta Justa', semitones: 5 },
            { name: 'Quinta Aumentada', semitones: 6 },
            { name: 'Quinta Justa', semitones: 7 },
            { name: 'Sexta Menor', semitones: 8 },
            { name: 'Sexta Mayor', semitones: 9 },
            { name: 'Séptima Menor', semitones: 10 },
            { name: 'Séptima Mayor', semitones: 11 },
            { name: 'Octava', semitones: 12 }
        ];
        
        return intervals[Math.floor(Math.random() * intervals.length)];
    }

    generateRandomChord() {
        const chords = [
            { name: 'Mayor', intervals: [0, 4, 7] },
            { name: 'Menor', intervals: [0, 3, 7] },
            { name: 'Aumentado', intervals: [0, 4, 8] },
            { name: 'Disminuido', intervals: [0, 3, 6] },
            { name: 'Mayor 7', intervals: [0, 4, 7, 11] },
            { name: 'Menor 7', intervals: [0, 3, 7, 10] },
            { name: 'Dominante 7', intervals: [0, 4, 7, 10] },
            { name: 'Menor 7b5', intervals: [0, 3, 6, 10] }
        ];
        
        return chords[Math.floor(Math.random() * chords.length)];
    }

    playCurrentNote() {
        switch (this.mode) {
            case 'notes':
                this.playNote(this.currentNote);
                break;
            case 'intervals':
                const baseNote = 60; // C4
                const note2 = baseNote + this.currentInterval.semitones;
                this.playInterval(baseNote, note2);
                break;
            case 'chords':
                const rootNote = 60; // C4
                const chordNotes = this.currentChord.intervals.map(interval => rootNote + interval);
                this.playChord(chordNotes);
                break;
        }
    }

    renderNoteOptions() {
        const optionsEl = document.getElementById('earTrainerOptions');
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        optionsEl.innerHTML = `
            <div class="note-options">
                ${noteNames.map(note => `
                    <button class="button note-option" data-note="${note}">${note}</button>
                `).join('')}
            </div>
        `;

        optionsEl.querySelectorAll('.note-option').forEach(btn => {
            btn.addEventListener('click', e => this.handleNoteGuess(e.target.dataset.note));
        });
    }

    renderIntervalOptions() {
        const optionsEl = document.getElementById('earTrainerOptions');
        const intervals = [
            'Unísono', 'Segunda Menor', 'Segunda Mayor', 'Tercera Menor', 'Tercera Mayor',
            'Cuarta Justa', 'Quinta Aumentada', 'Quinta Justa', 'Sexta Menor', 'Sexta Mayor',
            'Séptima Menor', 'Séptima Mayor', 'Octava'
        ];
        
        optionsEl.innerHTML = `
            <div class="interval-options">
                ${intervals.map(interval => `
                    <button class="button interval-option" data-interval="${interval}">${interval}</button>
                `).join('')}
            </div>
        `;

        optionsEl.querySelectorAll('.interval-option').forEach(btn => {
            btn.addEventListener('click', e => this.handleIntervalGuess(e.target.dataset.interval));
        });
    }

    renderChordOptions() {
        const optionsEl = document.getElementById('earTrainerOptions');
        const chords = [
            'Mayor', 'Menor', 'Aumentado', 'Disminuido', 
            'Mayor 7', 'Menor 7', 'Dominante 7', 'Menor 7b5'
        ];
        
        optionsEl.innerHTML = `
            <div class="chord-options">
                ${chords.map(chord => `
                    <button class="button chord-option" data-chord="${chord}">${chord}</button>
                `).join('')}
            </div>
        `;

        optionsEl.querySelectorAll('.chord-option').forEach(btn => {
            btn.addEventListener('click', e => this.handleChordGuess(e.target.dataset.chord));
        });
    }

    handleNoteGuess(guessedNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const correctNote = noteNames[this.currentNote % 12];
        
        this.score.total++;
        if (guessedNote === correctNote) {
            this.score.correct++;
            this.showFeedback('¡Correcto! 🎉', 'success');
        } else {
            this.showFeedback(`Incorrecto. Era ${correctNote}`, 'error');
        }
        
        this.updateScoreDisplay();
        setTimeout(() => this.startNewRound(), 1500);
    }

    handleIntervalGuess(guessedInterval) {
        this.score.total++;
        if (guessedInterval === this.currentInterval.name) {
            this.score.correct++;
            this.showFeedback('¡Correcto! 🎉', 'success');
        } else {
            this.showFeedback(`Incorrecto. Era ${this.currentInterval.name}`, 'error');
        }
        
        this.updateScoreDisplay();
        setTimeout(() => this.startNewRound(), 1500);
    }

    handleChordGuess(guessedChord) {
        this.score.total++;
        if (guessedChord === this.currentChord.name) {
            this.score.correct++;
            this.showFeedback('¡Correcto! 🎉', 'success');
        } else {
            this.showFeedback(`Incorrecto. Era ${this.currentChord.name}`, 'error');
        }
        
        this.updateScoreDisplay();
        setTimeout(() => this.startNewRound(), 1500);
    }

    showFeedback(message, type) {
        const statusEl = document.getElementById('earTrainerStatus');
        statusEl.textContent = message;
        statusEl.className = `feedback ${type}`;
        
        setTimeout(() => {
            statusEl.className = '';
        }, 1500);
    }

    updateScoreDisplay() {
        const scoreEl = document.getElementById('earTrainerScore');
        const percentage = this.score.total > 0 ? Math.round((this.score.correct / this.score.total) * 100) : 0;
        scoreEl.textContent = `Aciertos: ${this.score.correct} / Intentos: ${this.score.total} (${percentage}%)`;
    }

    renderFretboard() {
        const fretboardEl = document.getElementById('earTrainerFretboard');
        if (this.mode !== 'notes') {
            fretboardEl.style.display = 'none';
            return;
        }
        
        fretboardEl.style.display = 'block';
        fretboardEl.innerHTML = `
            <div class="fretboard">
                <div class="fretboard-header">
                    <span>Diapasón de Referencia</span>
                </div>
                <div class="fretboard-strings">
                    ${['E', 'A', 'D', 'G', 'B', 'E'].map((note, stringIndex) => `
                        <div class="string" data-string="${stringIndex}">
                            <div class="string-note">${note}</div>
                            ${Array.from({length: 12}, (_, fret) => {
                                const noteIndex = (stringIndex * 5 + fret) % 12;
                                const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                                return `<div class="fret" data-fret="${fret}" data-note="${noteNames[noteIndex]}">${noteNames[noteIndex]}</div>`;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

class PracticeLog {
    constructor(app) {
        this.app = app;
        this.setupPracticeLogSection();
    }

    setupPracticeLogSection() {
        // Añadir botón de progreso en la navegación
        const nav = document.querySelector('.nav-content');
        const progressBtn = document.createElement('button');
        progressBtn.className = 'nav-btn button';
        progressBtn.setAttribute('data-section', 'progress');
        progressBtn.innerHTML = '📊 Progreso';
        nav.appendChild(progressBtn);

        // Crear sección de progreso
        const main = document.querySelector('main');
        const progressSection = document.createElement('section');
        progressSection.id = 'progress';
        progressSection.className = 'section';
        progressSection.innerHTML = `
            <div class="manager-header">
                <h1>📊 Registro de Progreso</h1>
                <button class="btn-primary button" id="addPracticeEntryBtn">➕ Registrar Sesión</button>
            </div>
            <div class="progress-stats">
                <div class="stat-card">
                    <h3>Tiempo Total</h3>
                    <p id="totalPracticeTime">0h 0m</p>
                </div>
                <div class="stat-card">
                    <h3>Sesiones</h3>
                    <p id="totalSessions">0</p>
                </div>
                <div class="stat-card">
                    <h3>Promedio por Sesión</h3>
                    <p id="avgSessionTime">0m</p>
                </div>
                <div class="stat-card">
                    <h3>Racha Actual</h3>
                    <p id="currentStreak">0 días</p>
                </div>
            </div>
            <div class="practice-log-container">
                <div class="log-filters">
                    <select id="logFilterType" class="styled-select">
                        <option value="all">Todas las actividades</option>
                        <option value="routine">Rutinas</option>
                        <option value="speed_trainer">Entrenador de Velocidad</option>
                        <option value="song">Canciones</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    <input type="date" id="logFilterDate" class="styled-input">
                </div>
                <div id="practiceLogList"></div>
            </div>
        `;
        main.appendChild(progressSection);

        // Configurar eventos
        document.getElementById('addPracticeEntryBtn').addEventListener('click', () => this.showAddEntryModal());
        document.getElementById('logFilterType').addEventListener('change', () => this.renderLogList());
        document.getElementById('logFilterDate').addEventListener('change', () => this.renderLogList());
    }

    showAddEntryModal() {
        const modalHtml = `
            <div class="modal-overlay" id="practiceEntryModalOverlay" style="display:flex;">
                <div class="modal">
                    <button class="close-modal" id="closePracticeEntryModalBtn" title="Cerrar">×</button>
                    <h2>Registrar Sesión de Práctica</h2>
                    <form id="practiceEntryForm">
                        <div class="form-grid">
                            <div>
                                <label for="entryType">Tipo de Actividad</label>
                                <select id="entryType" class="styled-select" required>
                                    <option value="routine">Rutina</option>
                                    <option value="speed_trainer">Entrenador de Velocidad</option>
                                    <option value="song">Canción</option>
                                    <option value="custom">Personalizado</option>
                                </select>
                            </div>
                            <div>
                                <label for="entryDuration">Duración (minutos)</label>
                                <input type="number" id="entryDuration" min="1" max="480" required class="styled-input">
                            </div>
                        </div>
                        <div id="entryParamsContainer"></div>
                        <label for="entryNotes">¿Cómo te sentiste?</label>
                        <textarea id="entryNotes" placeholder="Describe tu práctica, áreas a mejorar, logros..." class="styled-input"></textarea>
                        <label for="entryAreasToImprove">Áreas a mejorar</label>
                        <textarea id="entryAreasToImprove" placeholder="Técnica, ritmo, teoría..." class="styled-input"></textarea>
                        <div class="modal-actions">
                            <button type="button" class="btn-cancel button" id="cancelPracticeEntryBtn">Cancelar</button>
                            <button type="submit" class="btn-save button">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('practiceEntryModalOverlay');
        const form = document.getElementById('practiceEntryForm');
        const closeBtn = document.getElementById('closePracticeEntryModalBtn');
        const cancelBtn = document.getElementById('cancelPracticeEntryBtn');

        closeBtn.addEventListener('click', () => this.closeAddEntryModal());
        cancelBtn.addEventListener('click', () => this.closeAddEntryModal());
        modal.addEventListener('click', e => {
            if (e.target === modal) this.closeAddEntryModal();
        });

        document.getElementById('entryType').addEventListener('change', e => this.updateEntryParams(e.target.value));
        form.addEventListener('submit', e => this.handleEntryFormSubmit(e));

        this.updateEntryParams('routine');
        this.app.openModal();
    }

    updateEntryParams(type) {
        const container = document.getElementById('entryParamsContainer');
        let html = '';

        switch (type) {
            case 'routine':
                html = `
                    <label for="entryRoutine">Rutina</label>
                    <select id="entryRoutine" class="styled-select">
                        <option value="">-- Seleccionar rutina --</option>
                        ${this.app.appData.routines.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                `;
                break;
            case 'song':
                html = `
                    <label for="entrySong">Canción</label>
                    <select id="entrySong" class="styled-select">
                        <option value="">-- Seleccionar canción --</option>
                        ${this.app.appData.songs.map(s => `<option value="${s.id}">${s.title}</option>`).join('')}
                    </select>
                `;
                break;
            case 'speed_trainer':
                html = `
                    <div class="form-grid">
                        <div>
                            <label for="entryStartBpm">BPM Inicial</label>
                            <input type="number" id="entryStartBpm" min="40" max="200" class="styled-input">
                        </div>
                        <div>
                            <label for="entryEndBpm">BPM Final</label>
                            <input type="number" id="entryEndBpm" min="40" max="240" class="styled-input">
                        </div>
                    </div>
                `;
                break;
            case 'custom':
                html = `
                    <label for="entryCustomActivity">Actividad</label>
                    <input type="text" id="entryCustomActivity" placeholder="Ej: Escalas, Arpegios, Improvisación..." class="styled-input">
                `;
                break;
        }

        container.innerHTML = html;
    }

    handleEntryFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const type = document.getElementById('entryType').value;
        const duration = parseInt(document.getElementById('entryDuration').value);
        const notes = document.getElementById('entryNotes').value;
        const areasToImprove = document.getElementById('entryAreasToImprove').value;

        let params = {};
        switch (type) {
            case 'routine':
                params.routineId = document.getElementById('entryRoutine').value;
                break;
            case 'song':
                params.songId = document.getElementById('entrySong').value;
                break;
            case 'speed_trainer':
                params.startBpm = parseInt(document.getElementById('entryStartBpm').value);
                params.endBpm = parseInt(document.getElementById('entryEndBpm').value);
                break;
            case 'custom':
                params.activity = document.getElementById('entryCustomActivity').value;
                break;
        }

        this.addEntry({
            id: `entry_${Date.now()}`,
            type: type,
            duration: duration,
            notes: notes,
            areasToImprove: areasToImprove,
            params: params,
            timestamp: new Date().toISOString()
        });

        this.closeAddEntryModal();
    }

    closeAddEntryModal() {
        const modal = document.getElementById('practiceEntryModalOverlay');
        if (modal) {
            modal.remove();
        }
        this.app.closeModal();
    }

    addEntry(entry) {
        if (!this.app.appData.practiceLog) {
            this.app.appData.practiceLog = [];
        }
        
        this.app.appData.practiceLog.unshift(entry);
        this.app.saveData();
        this.renderLogList();
        this.updateStats();
    }

    renderLogList() {
        const container = document.getElementById('practiceLogList');
        const filterType = document.getElementById('logFilterType').value;
        const filterDate = document.getElementById('logFilterDate').value;

        let entries = this.app.appData.practiceLog || [];

        // Aplicar filtros
        if (filterType !== 'all') {
            entries = entries.filter(entry => entry.type === filterType);
        }

        if (filterDate) {
            const filterDateObj = new Date(filterDate);
            entries = entries.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entryDate.toDateString() === filterDateObj.toDateString();
            });
        }

        if (entries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No hay registros de práctica</h3>
                    <p>¡Comienza a registrar tus sesiones para ver tu progreso!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = entries.map(entry => {
            const date = new Date(entry.timestamp);
            const typeIcon = this.getTypeIcon(entry.type);
            const typeLabel = this.getTypeLabel(entry.type);
            const details = this.getEntryDetails(entry);

            return `
                <div class="practice-entry-card">
                    <div class="entry-header">
                        <div class="entry-type">
                            <span class="entry-icon">${typeIcon}</span>
                            <span class="entry-label">${typeLabel}</span>
                        </div>
                        <div class="entry-date">
                            ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                    <div class="entry-duration">
                        <strong>${entry.duration} minutos</strong>
                    </div>
                    ${details ? `<div class="entry-details">${details}</div>` : ''}
                    ${entry.notes ? `<div class="entry-notes"><strong>Notas:</strong> ${entry.notes}</div>` : ''}
                    ${entry.areasToImprove ? `<div class="entry-areas"><strong>Áreas a mejorar:</strong> ${entry.areasToImprove}</div>` : ''}
                    <button class="button small-btn-danger delete-entry" data-id="${entry.id}">🗑️</button>
                </div>
            `;
        }).join('');

        // Configurar eventos de eliminación
        container.querySelectorAll('.delete-entry').forEach(btn => {
            btn.addEventListener('click', e => {
                const entryId = e.target.dataset.id;
                this.deleteEntry(entryId);
            });
        });
    }

    getTypeIcon(type) {
        const icons = {
            'routine': '🗓️',
            'speed_trainer': '🏃',
            'song': '🎵',
            'custom': '🎯'
        };
        return icons[type] || '📝';
    }

    getTypeLabel(type) {
        const labels = {
            'routine': 'Rutina',
            'speed_trainer': 'Entrenador de Velocidad',
            'song': 'Canción',
            'custom': 'Personalizado'
        };
        return labels[type] || 'Actividad';
    }

    getEntryDetails(entry) {
        switch (entry.type) {
            case 'routine':
                const routine = this.app.appData.routines.find(r => r.id === entry.params.routineId);
                return routine ? `Rutina: ${routine.name}` : '';
            case 'song':
                const song = this.app.findSongById(entry.params.songId);
                return song ? `Canción: ${song.title}` : '';
            case 'speed_trainer':
                return `BPM: ${entry.params.startBpm} → ${entry.params.endBpm}`;
            case 'custom':
                return entry.params.activity ? `Actividad: ${entry.params.activity}` : '';
            default:
                return '';
        }
    }

    deleteEntry(entryId) {
        this.app.showConfirmation('¿Estás seguro de que quieres eliminar este registro?', () => {
            this.app.appData.practiceLog = this.app.appData.practiceLog.filter(entry => entry.id !== entryId);
            this.app.saveData();
            this.renderLogList();
            this.updateStats();
        });
    }

    updateStats() {
        const entries = this.app.appData.practiceLog || [];
        
        // Tiempo total
        const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        document.getElementById('totalPracticeTime').textContent = `${totalHours}h ${remainingMinutes}m`;

        // Total de sesiones
        document.getElementById('totalSessions').textContent = entries.length;

        // Promedio por sesión
        const avgMinutes = entries.length > 0 ? Math.round(totalMinutes / entries.length) : 0;
        document.getElementById('avgSessionTime').textContent = `${avgMinutes}m`;

        // Racha actual
        const currentStreak = this.calculateCurrentStreak(entries);
        document.getElementById('currentStreak').textContent = `${currentStreak} días`;
    }

    calculateCurrentStreak(entries) {
        if (entries.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let streak = 0;
        let currentDate = new Date(today);

        while (true) {
            const hasEntryForDate = entries.some(entry => {
                const entryDate = new Date(entry.timestamp);
                entryDate.setHours(0, 0, 0, 0);
                return entryDate.getTime() === currentDate.getTime();
            });

            if (hasEntryForDate) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }
}

class CircleOfFifths {
    constructor(app) {
        this.app = app;
        this.selectedKey = null;
        this.setupCircleOfFifths();
    }

    setupCircleOfFifths() {
        // Eliminar la creación dinámica del botón de círculo de quintas
        // Solo mantener la lógica de inicialización de la sección y eventos
        // Crear sección del círculo de quintas si no existe
        const main = document.querySelector('main');
        if (!document.getElementById('circle-of-fifths')) {
            const circleSection = document.createElement('section');
            circleSection.id = 'circle-of-fifths';
            circleSection.className = 'section';
            circleSection.innerHTML = `
                <div class="circle-of-fifths-container">
                    <h1>🎯 Círculo de Quintas Interactivo</h1>
                    <div class="circle-controls">
                        <button class="button btn-secondary" id="resetCircleBtn">🔄 Reiniciar</button>
                        <button class="button btn-secondary" id="showAllChordsBtn">🎸 Mostrar Todos los Acordes</button>
                    </div>
                    <div class="circle-main">
                        <div class="circle-svg-container">
                            <svg id="circleSvg" viewBox="0 0 600 600" class="circle-svg">
                                <!-- El SVG se generará dinámicamente -->
                            </svg>
                        </div>
                        <div class="circle-info-panel">
                            <div id="keyInfo" class="key-info">
                                <h3>Selecciona una tonalidad</h3>
                                <p>Haz clic en cualquier nota del círculo para ver su información armónica</p>
                            </div>
                            <div id="chordInfo" class="chord-info" style="display:none;">
                                <h3>Acordes Diatónicos</h3>
                                <div id="diatonicChords"></div>
                            </div>
                            <div id="scaleInfo" class="scale-info" style="display:none;">
                                <h3>Escalas Relacionadas</h3>
                                <div id="relatedScales"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            main.appendChild(circleSection);
        }
        // Configurar eventos
        document.getElementById('resetCircleBtn').addEventListener('click', () => this.resetCircle());
        document.getElementById('showAllChordsBtn').addEventListener('click', () => this.showAllChords());
        this.renderCircle();
    }

    renderCircle() {
        const svg = document.getElementById('circleSvg');
        const centerX = 300;
        const centerY = 300;
        const radius = 200;
        
        // Definir las notas en orden de quintas
        const notes = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
        const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
        const minorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm', 'Dm'];

        let svgContent = '';

        // Dibujar círculo exterior
        svgContent += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="var(--border-color)" stroke-width="2"/>`;

        // Dibujar notas del círculo
        notes.forEach((note, index) => {
            const angle = (index * 30 - 90) * (Math.PI / 180); // Empezar desde arriba
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            const isSharp = note.includes('#');
            const fillColor = isSharp ? 'var(--accent-color)' : 'var(--primary-color)';
            
            svgContent += `
                <circle cx="${x}" cy="${y}" r="25" fill="${fillColor}" stroke="var(--border-color)" stroke-width="2" 
                        class="key-circle" data-key="${majorKeys[index]}" data-note="${note}" data-index="${index}"/>
                <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="14" font-weight="bold" 
                      class="key-text" data-key="${majorKeys[index]}">${note}</text>
                <text x="${x}" y="${y + 25}" text-anchor="middle" fill="white" font-size="10" 
                      class="minor-key-text" data-key="${minorKeys[index]}">${minorKeys[index]}</text>
            `;
        });

        // Dibujar líneas de conexión (quintas)
        for (let i = 0; i < notes.length; i++) {
            const angle1 = (i * 30 - 90) * (Math.PI / 180);
            const angle2 = ((i + 1) * 30 - 90) * (Math.PI / 180);
            const x1 = centerX + (radius - 10) * Math.cos(angle1);
            const y1 = centerY + (radius - 10) * Math.sin(angle1);
            const x2 = centerX + (radius - 10) * Math.cos(angle2);
            const y2 = centerY + (radius - 10) * Math.sin(angle2);
            
            svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--border-color)" stroke-width="1" opacity="0.5"/>`;
        }

        svg.innerHTML = svgContent;

        // Configurar eventos de clic
        svg.querySelectorAll('.key-circle').forEach(circle => {
            circle.addEventListener('click', e => this.selectKey(e.target.dataset.key));
        });
    }

    selectKey(key) {
        this.selectedKey = key;
        
        // Actualizar visualización
        document.querySelectorAll('.key-circle').forEach(circle => {
            circle.style.stroke = circle.dataset.key === key ? 'var(--success-color)' : 'var(--border-color)';
            circle.style.strokeWidth = circle.dataset.key === key ? '4' : '2';
        });

        this.showKeyInfo(key);
    }

    showKeyInfo(key) {
        const keyInfo = document.getElementById('keyInfo');
        const chordInfo = document.getElementById('chordInfo');
        const scaleInfo = document.getElementById('scaleInfo');
        const diatonicChordsEl = document.getElementById('diatonicChords');
        const relatedScalesEl = document.getElementById('relatedScales');

        // Validar que todos los elementos existen antes de usarlos
        if (!keyInfo || !chordInfo || !scaleInfo || !diatonicChordsEl || !relatedScalesEl) {
            console.warn('Algunos elementos del círculo de quintas no se encontraron en el DOM');
            return;
        }

        // Información de la tonalidad
        const isMinor = key.includes('m');
        const rootNote = isMinor ? key.replace('m', '') : key;
        const relativeKey = this.getRelativeKey(key);
        
        keyInfo.innerHTML = `
            <h3>${key} ${isMinor ? 'menor' : 'Mayor'}</h3>
            <div class="key-details">
                <p><strong>Tónica:</strong> ${rootNote}</p>
                <p><strong>Relativa:</strong> ${relativeKey}</p>
                <p><strong>Armadura:</strong> ${this.getKeySignature(key)}</p>
            </div>
        `;

        // Acordes diatónicos
        const diatonicChords = this.getDiatonicChords(key);
        const diatonicChordsHtml = diatonicChords.map((chord, index) => {
            const romanNumeral = this.getRomanNumeral(index, isMinor);
            return `
                <div class="chord-item">
                    <span class="roman-numeral">${romanNumeral}</span>
                    <span class="chord-name">${chord}</span>
                </div>
            `;
        }).join('');

        diatonicChordsEl.innerHTML = diatonicChordsHtml;
        chordInfo.style.display = 'block';

        // Escalas relacionadas
        const relatedScales = this.getRelatedScales(key);
        const scalesHtml = relatedScales.map(scale => `
            <div class="scale-item">
                <span class="scale-name">${scale.name}</span>
                <span class="scale-notes">${scale.notes.join(' ')}</span>
            </div>
        `).join('');

        relatedScalesEl.innerHTML = scalesHtml;
        scaleInfo.style.display = 'block';
    }

    getRelativeKey(key) {
        const isMinor = key.includes('m');
        const rootNote = isMinor ? key.replace('m', '') : key;
        
        if (isMinor) {
            // Encontrar la relativa mayor
            const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
            const minorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm', 'Dm'];
            const index = minorKeys.indexOf(key);
            return majorKeys[index];
        } else {
            // Encontrar la relativa menor
            const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
            const minorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm', 'Dm'];
            const index = majorKeys.indexOf(key);
            return minorKeys[index];
        }
    }

    getKeySignature(key) {
        const signatures = {
            'C': '0 sostenidos/bemoles',
            'G': '1 sostenido (F#)',
            'D': '2 sostenidos (F#, C#)',
            'A': '3 sostenidos (F#, C#, G#)',
            'E': '4 sostenidos (F#, C#, G#, D#)',
            'B': '5 sostenidos (F#, C#, G#, D#, A#)',
            'F#': '6 sostenidos (F#, C#, G#, D#, A#, E#)',
            'C#': '7 sostenidos (F#, C#, G#, D#, A#, E#, B#)',
            'F': '1 bemol (Bb)',
            'Bb': '2 bemoles (Bb, Eb)',
            'Eb': '3 bemoles (Bb, Eb, Ab)',
            'Ab': '4 bemoles (Bb, Eb, Ab, Db)',
            'Db': '5 bemoles (Bb, Eb, Ab, Db, Gb)',
            'Gb': '6 bemoles (Bb, Eb, Ab, Db, Gb, Cb)'
        };
        
        return signatures[key] || 'Desconocida';
    }

    getDiatonicChords(key) {
        const isMinor = key.includes('m');
        const rootNote = isMinor ? key.replace('m', '') : key;
        
        if (isMinor) {
            // Acordes de escala menor natural
            const minorScale = this.getMinorScale(rootNote);
            return minorScale.map(note => {
                const index = minorScale.indexOf(note);
                if (index === 0 || index === 3 || index === 4) return note;
                if (index === 1 || index === 2 || index === 5) return note + 'm';
                return note + 'dim';
            });
        } else {
            // Acordes de escala mayor
            const majorScale = this.getMajorScale(rootNote);
            return majorScale.map(note => {
                const index = majorScale.indexOf(note);
                if (index === 0 || index === 3 || index === 4) return note;
                if (index === 1 || index === 2 || index === 5) return note + 'm';
                return note + 'dim';
            });
        }
    }

    getMajorScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 2, 4, 5, 7, 9, 11];
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    getMinorScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 2, 3, 5, 7, 8, 10]; // Escala menor natural
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    getRomanNumeral(index, isMinor) {
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const qualities = isMinor ? ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] : ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
        return qualities[index];
    }

    getRelatedScales(key) {
        const isMinor = key.includes('m');
        const rootNote = isMinor ? key.replace('m', '') : key;
        
        const scales = [];
        
        if (isMinor) {
            // Escalas relacionadas con tonalidad menor
            scales.push({
                name: 'Menor Natural',
                notes: this.getMinorScale(rootNote)
            });
            scales.push({
                name: 'Menor Armónica',
                notes: this.getHarmonicMinorScale(rootNote)
            });
            scales.push({
                name: 'Menor Melódica',
                notes: this.getMelodicMinorScale(rootNote)
            });
            scales.push({
                name: 'Pentatónica Menor',
                notes: this.getMinorPentatonicScale(rootNote)
            });
        } else {
            // Escalas relacionadas con tonalidad mayor
            scales.push({
                name: 'Mayor',
                notes: this.getMajorScale(rootNote)
            });
            scales.push({
                name: 'Pentatónica Mayor',
                notes: this.getMajorPentatonicScale(rootNote)
            });
            scales.push({
                name: 'Mixolidio',
                notes: this.getMixolydianScale(rootNote)
            });
            scales.push({
                name: 'Dórico',
                notes: this.getDorianScale(rootNote)
            });
        }
        
        return scales;
    }

    getHarmonicMinorScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 2, 3, 5, 7, 8, 11]; // Séptima aumentada
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    getMelodicMinorScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 2, 3, 5, 7, 9, 11]; // Sexta y séptima mayores
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    getMinorPentatonicScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 3, 5, 7, 10];
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    getMajorPentatonicScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 2, 4, 7, 9];
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    getMixolydianScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 2, 4, 5, 7, 9, 10]; // Séptima menor
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    getDorianScale(root) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const intervals = [0, 2, 3, 5, 7, 9, 10]; // Tercera menor, sexta mayor
        const rootIndex = notes.indexOf(root);
        
        return intervals.map(interval => notes[(rootIndex + interval) % 12]);
    }

    resetCircle() {
        this.selectedKey = null;
        document.querySelectorAll('.key-circle').forEach(circle => {
            circle.style.stroke = 'var(--border-color)';
            circle.style.strokeWidth = '2';
        });
        
        document.getElementById('keyInfo').innerHTML = `
            <h3>Selecciona una tonalidad</h3>
            <p>Haz clic en cualquier nota del círculo para ver su información armónica</p>
        `;
        document.getElementById('chordInfo').style.display = 'none';
        document.getElementById('scaleInfo').style.display = 'none';
    }

    showAllChords() {
        // Mostrar todos los acordes diatónicos de todas las tonalidades
        const allChords = {};
        const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
        
        keys.forEach(key => {
            allChords[key] = this.getDiatonicChords(key);
        });

        const modalHtml = `
            <div class="modal-overlay" id="allChordsModalOverlay" style="display:flex;">
                <div class="modal large-modal">
                    <button class="close-modal" id="closeAllChordsModalBtn" title="Cerrar">×</button>
                    <h2>Todos los Acordes Diatónicos</h2>
                    <div class="all-chords-grid">
                        ${Object.entries(allChords).map(([key, chords]) => `
                            <div class="key-chords">
                                <h3>${key} Mayor</h3>
                                <div class="chords-list">
                                    ${chords.map((chord, index) => {
                                        const romanNumeral = this.getRomanNumeral(index, false);
                                        return `<span class="chord-item">${romanNumeral}: ${chord}</span>`;
                                    }).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('allChordsModalOverlay');
        const closeBtn = document.getElementById('closeAllChordsModalBtn');

        closeBtn.addEventListener('click', () => this.closeAllChordsModal());
        modal.addEventListener('click', e => {
            if (e.target === modal) this.closeAllChordsModal();
        });

        this.app.openModal();
    }

    closeAllChordsModal() {
        const modal = document.getElementById('allChordsModalOverlay');
        if (modal) {
            modal.remove();
        }
        this.app.closeModal();
    }
}

// =================================================================================
// CLASE PRINCIPAL DE LA APLICACIÓN
// =================================================================================
class GuitarWorshipTrainer {
    constructor() {
        // Crear AudioContext compartido
        this.sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.appData = {
            songs: [],
            setlists: [],
            routines: [],
            recordings: [],
            practiceLog: [],
            settings: {
                theme: 'light',
                metronome: {
                    bpm: 120,
                    subdivision: 1
                },
                tuner: {
                    a4: 440
                }
            }
        };
        
        this.currentSection = 'inicio';
        this.init();
    }

    init() {
        this.loadData();
        this.themeManager = new ThemeManager(this);
        this.themeManager.loadSavedTheme();
        this.metronome = new Metronome(this);
        this.tuner = new Tuner(this);
        this.songManager = new SongManager(this);
        this.setlistManager = new SetlistManager(this);
        this.practicePlanner = new PracticePlanner(this);
        this.progressionAnalyzer = new ProgressionAnalyzer(this);
        this.scaleVisualizer = new ScaleVisualizer(this);
        this.earTrainer = new EarTrainer(this);
        this.recorder = new IdeaRecorder(this);
        this.practiceLog = new PracticeLog(this);
        this.circleOfFifths = new CircleOfFifths(this);

        this.setupNavigation();
        this.setupCardNavigation();
        this.setupGlobalSearch();
        this.setupConfirmationModal();
        this.setupKeyboardShortcuts();
        
        this.songManager.renderSongList();
        this.setlistManager.renderSetlistList();
        this.practicePlanner.renderRoutineList();
        this.recorder.renderRecordings();
        this.practiceLog.renderLogList();
        this.practiceLog.updateStats();
        document.getElementById('copyright-year').textContent = new Date().getFullYear();
        this.showSection(this.currentSection);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // No procesar atajos si estamos en un input o textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }
            
            // No procesar si hay un modal abierto
            if (document.body.classList.contains('modal-open')) {
                return;
            }
            
            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    this.handleSpaceKey();
                    break;
                case 't':
                    e.preventDefault();
                    this.handleTunerKey();
                    break;
                case 's':
                    e.preventDefault();
                    this.handleSongsKey();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    this.handleLeftArrow();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    this.handleRightArrow();
                    break;
                case 'escape':
                    e.preventDefault();
                    this.handleEscapeKey();
                    break;
                case 'h':
                    e.preventDefault();
                    this.handleHomeKey();
                    break;
                case 'm':
                    e.preventDefault();
                    this.handleMetronomeKey();
                    break;
                case 'e':
                    e.preventDefault();
                    this.handleEarTrainerKey();
                    break;
                case 'c':
                    e.preventDefault();
                    this.handleCircleOfFifthsKey();
                    break;
            }
        });
    }

    handleSpaceKey() {
        // Iniciar/pausar metrónomo
        if (this.currentSection === 'metronome') {
            this.metronome.togglePlay();
        }
    }

    handleTunerKey() {
        // Abrir afinador
        this.showSection('tuner');
    }

    handleSongsKey() {
        // Abrir canciones
        this.showSection('songs');
    }

    handleLeftArrow() {
        // Navegación en performance mode
        if (this.setlistManager.currentSetlistId && !document.getElementById('performance-mode').classList.contains('hidden')) {
            this.setlistManager.navigateToSong(-1);
        }
    }

    handleRightArrow() {
        // Navegación en performance mode
        if (this.setlistManager.currentSetlistId && !document.getElementById('performance-mode').classList.contains('hidden')) {
            this.setlistManager.navigateToSong(1);
        }
    }

    handleEscapeKey() {
        // Salir de performance mode o cerrar modales
        if (!document.getElementById('performance-mode').classList.contains('hidden')) {
            this.setlistManager.exitPerformanceMode();
        } else if (document.body.classList.contains('modal-open')) {
            this.closeModal();
        }
    }

    handleHomeKey() {
        // Ir a inicio
        this.showSection('inicio');
    }

    handleMetronomeKey() {
        // Ir a metrónomo
        this.showSection('metronome');
    }

    handleEarTrainerKey() {
        // Ir a entrenador de oído
        this.showSection('ear-trainer');
    }

    handleCircleOfFifthsKey() {
        // Ir a círculo de quintas
        this.showSection('circle-of-fifths');
    }

    saveData() { localStorage.setItem('guitarWorshipTrainerData', JSON.stringify(this.appData)); }
    
    loadData() {
        const savedData = JSON.parse(localStorage.getItem('guitarWorshipTrainerData'));
        const deepMerge = (target, source) => {
             for (const key in source) {
                if (source[key] instanceof Object && key in target && !Array.isArray(source[key])) {
                     Object.assign(source[key], deepMerge(target[key] || {}, source[key]));
                }
             }
             return Object.assign(target || {}, source);
        };
        this.appData = deepMerge(this.appData, savedData || {});
        if (!savedData) { this.saveData(); }
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => this.showSection(btn.dataset.section)));
    }
    setupCardNavigation() {
        document.querySelectorAll('.card').forEach(card => card.addEventListener('click', () => this.showSection(card.dataset.section)));
    }

    showSection(sectionId) {
        this.currentSection = sectionId;
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === sectionId));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === sectionId));
        
        const searchInput = document.getElementById('globalSearchInput');
        const shouldShowSearch = ['songs', 'setlists', 'practice'].includes(sectionId);
        searchInput.style.display = shouldShowSearch ? 'inline-flex' : 'none';
        if (!shouldShowSearch) searchInput.value = '';
        this.filterGlobalSearch();

        // Detener el metrónomo si no estamos en la sección de metrónomo
        if (sectionId !== 'metronome' && this.metronome && this.metronome.isPlaying) {
            this.metronome.stop();
        }
        // Detener el metrónomo si entramos a circle-of-fifths (por si acaso)
        if (sectionId === 'circle-of-fifths' && this.metronome && this.metronome.isPlaying) {
            this.metronome.stop();
        }
        // Asegurar que el metrónomo NO se inicie en ninguna otra sección
        if (sectionId === 'metronome' && this.metronome && !this.metronome.isPlaying) {
            // No iniciar automáticamente, solo mostrar controles
        }
        if (sectionId !== 'tuner' && this.tuner && this.tuner.isTunerOn) { this.tuner.stop(); }

        if (sectionId === 'scales' && this.scaleVisualizer) { this.scaleVisualizer.render(); }
        if (sectionId === 'songs' && this.songManager) { this.songManager.renderSongList(); }
        if (sectionId === 'setlists' && this.setlistManager) { this.setlistManager.renderSetlistList(); }
        if (sectionId === 'practice' && this.practicePlanner) { this.practicePlanner.renderRoutineList(); }
        if (sectionId === 'ear-trainer' && this.earTrainer) { this.earTrainer.startNewRound(); }
    }
    
    setupGlobalSearch() {
        this.searchInput = document.getElementById('globalSearchInput');
        this.searchInput.addEventListener('input', () => this.filterGlobalSearch());
    }

    filterGlobalSearch() {
        // Validar que searchInput existe y tiene valor
        if (!this.searchInput || !this.searchInput.value) {
            return;
        }
        
        const query = this.searchInput.value.toLowerCase().trim();
        let itemSelector;

        if (this.currentSection === 'songs') itemSelector = '#songListContainer .item-card';
        else if (this.currentSection === 'setlists') itemSelector = '#setlistListContainer .item-card-large';
        else if (this.currentSection === 'practice') itemSelector = '#routineListContainer .item-card-large';
        else return;

        document.querySelectorAll(itemSelector).forEach(item => {
            const textContent = item.textContent.toLowerCase();
            item.classList.toggle('hidden', !textContent.includes(query));
        });
    }

    openModal() { document.body.classList.add('modal-open'); }
    closeModal() { document.body.classList.remove('modal-open'); }

    setupConfirmationModal() {
        this.confirmModal = {
            overlay: document.getElementById('confirmModalOverlay'),
            title: document.getElementById('confirmModalTitle'),
            message: document.getElementById('confirmModalMessage'),
            confirm: document.getElementById('confirmModalConfirm'),
            cancel: document.getElementById('confirmModalCancel')
        };
        this.confirmModal.confirm.addEventListener('click', () => this.confirmModal.onConfirm && this.confirmModal.onConfirm());
        this.confirmModal.cancel.addEventListener('click', () => this.hideConfirmation());
        
        // Configurar modal de atajos de teclado
        const shortcutsBtn = document.getElementById('keyboardShortcutsBtn');
        const shortcutsModal = document.getElementById('keyboardShortcutsModalOverlay');
        const closeShortcutsBtn = document.getElementById('closeKeyboardShortcutsModalBtn');
        const closeShortcutsBtn2 = document.getElementById('closeKeyboardShortcutsBtn');
        
        if (shortcutsBtn) {
            shortcutsBtn.addEventListener('click', () => {
                shortcutsModal.style.display = 'flex';
                this.openModal();
            });
        }
        
        if (closeShortcutsBtn) {
            closeShortcutsBtn.addEventListener('click', () => {
                shortcutsModal.style.display = 'none';
                this.closeModal();
            });
        }
        
        if (closeShortcutsBtn2) {
            closeShortcutsBtn2.addEventListener('click', () => {
                shortcutsModal.style.display = 'none';
                this.closeModal();
            });
        }
        
        if (shortcutsModal) {
            shortcutsModal.addEventListener('click', e => {
                if (e.target === shortcutsModal) {
                    shortcutsModal.style.display = 'none';
                    this.closeModal();
                }
            });
        }
    }
    showConfirmation(message, onConfirm) {
        this.confirmModal.message.textContent = message;
        const newConfirmBtn = this.confirmModal.confirmBtn.cloneNode(true);
        this.confirmModal.confirmBtn.parentNode.replaceChild(newConfirmBtn, this.confirmModal.confirmBtn);
        this.confirmModal.confirmBtn = newConfirmBtn;
        this.confirmModal.confirmBtn.addEventListener('click', () => { onConfirm(); this.hideConfirmation(); }, { once: true });
        this.confirmModal.overlay.style.display = 'flex'; this.openModal();
    }
    hideConfirmation() { this.confirmModal.overlay.style.display = 'none'; this.closeModal(); }
    findSongById(id) { return this.appData.songs.find(song => song.id === id); }
}

// =================================================================================
// PUNTO DE ENTRADA PRINCIPAL: SE EJECUTA CUANDO EL HTML ESTÁ LISTO
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    new GuitarWorshipTrainer();
});