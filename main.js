// =================================================================================
// GESTOR DE TEMAS
// =================================================================================
class ThemeManager {
    setTheme(theme) { document.body.setAttribute('data-theme', theme); localStorage.setItem('gwt-theme', theme); }
    loadSavedTheme() {
        const savedTheme = localStorage.getItem('gwt-theme') || 'light';
        this.setTheme(savedTheme);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedTheme);
        });
    }
}

// =================================================================================
// METRÓNOMO PRO
// =================================================================================
class Metronome {
    constructor(backingTrackPlayer) {
        this.backingTrackPlayer = backingTrackPlayer;
        this.audioContext = null; this.isPlaying = false;
        this.bpm = 120; this.timeSignature = '4/4'; this.subdivision = 1; this.strumPattern = '';
        this.currentBeat = 0; this.currentSubdivision = 0; this.nextNoteTime = 0;
        this.timerID = null; this.lookahead = 25; this.scheduleAheadTime = 0.1;
        this.tapTimes = [];
        this.strumPatterns = { 'basic': ['↓', '↓', '↑', '↑', '↓', '↑'], 'ballad': ['↓', '↑', '↑', '↓', '↑', '↑'] };
        this.setupControls();
        this.loadSettings();
    }
    setupControls() {
        this.bpmSlider = document.getElementById('bpmSlider');
        this.bpmDisplay = document.getElementById('bpmDisplay');
        this.playBtn = document.getElementById('playBtn');
        this.timeSignatureSelect = document.getElementById('timeSignature');
        this.subdivisionSelect = document.getElementById('subdivisionSelect');
        this.strumPatternSelect = document.getElementById('strumPatternSelect');
        this.customStrumInput = document.getElementById('customStrumPattern');
        this.bpmSlider.addEventListener('input', e => this.setBpm(parseInt(e.target.value), true));
        this.timeSignatureSelect.addEventListener('change', e => { this.timeSignature = e.target.value; this.saveSettings(); });
        this.subdivisionSelect.addEventListener('change', e => { this.subdivision = parseInt(e.target.value); this.saveSettings(); });
        this.strumPatternSelect.addEventListener('change', e => {
            this.strumPattern = e.target.value;
            this.updateVisualIndicator();
            this.customStrumInput.style.display = (this.strumPattern === 'custom') ? 'block' : 'none';
        });
        this.customStrumInput.addEventListener('input', () => {
            if (this.strumPattern === 'custom') this.updateVisualIndicator();
        });
        this.playBtn.addEventListener('click', () => this.togglePlay());
        document.getElementById('tapTempoBtn').addEventListener('click', () => this.handleTap());
    }
    setBpm(newBpm, save = false) {
        this.bpm = newBpm;
        this.bpmDisplay.textContent = this.bpm;
        this.bpmSlider.value = this.bpm;
        if(save) this.saveSettings();
    }
    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('gwt-metro-settings'));
        if (settings) {
            this.setBpm(settings.bpm || 120);
            this.timeSignature = settings.timeSignature || '4/4';
            this.subdivision = settings.subdivision || 1;
        }
        document.getElementById('timeSignature').value = this.timeSignature;
        document.getElementById('subdivisionSelect').value = this.subdivision;
    }
    saveSettings() {
        const settings = { bpm: this.bpm, timeSignature: this.timeSignature, subdivision: this.subdivision };
        localStorage.setItem('gwt-metro-settings', JSON.stringify(settings));
    }
    togglePlay() {
        if (this.isPlaying) {
            this.stop();
            if (this.backingTrackPlayer && this.backingTrackPlayer.isPlaying) {
                this.backingTrackPlayer.togglePlay();
            }
        } else {
            this.start();
            if (this.backingTrackPlayer && this.backingTrackPlayer.audio.src && this.backingTrackPlayer.audio.paused) {
                this.backingTrackPlayer.togglePlay();
            }
        }
    }
    handleTap() {
        const now = Date.now();
        if (this.tapTimes.length > 0 && (now - this.tapTimes[this.tapTimes.length - 1] > 2000)) this.tapTimes = [];
        this.tapTimes.push(now);
        if (this.tapTimes.length > 3) this.tapTimes.shift();
        if (this.tapTimes.length > 1) {
            const avg = (this.tapTimes[this.tapTimes.length - 1] - this.tapTimes[0]) / (this.tapTimes.length - 1);
            const newBpm = Math.round(60000 / avg);
            if (newBpm >= 40 && newBpm <= 240) this.setBpm(newBpm, true);
        }
    }
    updateVisualIndicator() {
        const indicator = document.getElementById('visualIndicator');
        let patternArr = [];
        if (this.strumPattern === 'custom') {
            const val = this.customStrumInput.value.trim();
            patternArr = val.split(/\s+/).filter(Boolean);
        } else if (this.strumPattern && this.strumPatterns[this.strumPattern]) {
            patternArr = this.strumPatterns[this.strumPattern];
        }
        if (patternArr.length) {
            let symbol = patternArr[0];
            indicator.innerHTML = this._getStrumSymbolHTML(symbol);
            indicator.style.borderRadius = '8px';
            indicator.style.borderStyle = 'dashed';
        } else {
            indicator.innerHTML = '';
            indicator.style.borderRadius = '50%';
            indicator.style.borderStyle = 'solid';
        }
    }
    _getStrumSymbolHTML(symbol) {
        if (symbol === '↓') return '<div class="strum-arrow down"></div>';
        if (symbol === '↑') return '<div class="strum-arrow up"></div>';
        if (symbol === 'x') return '<div class="strum-arrow" style="color:var(--error-color);font-size:2rem;">x</div>';
        if (symbol === '-') return '<div class="strum-arrow" style="color:var(--text-secondary);font-size:2rem;">-</div>';
        return '';
    }
    start() {
        if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlaying = true;
        this.currentBeat = 0; this.currentSubdivision = 0;
        this.nextNoteTime = this.audioContext.currentTime;
        this.scheduler();
        this.playBtn.innerHTML = '⏸️ Pausar'; this.playBtn.classList.add('playing');
    }
    stop() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
        this.playBtn.innerHTML = '▶️ Iniciar'; this.playBtn.classList.remove('playing');
        document.getElementById('visualIndicator').classList.remove('beat');
    }
    scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.nextNoteTime);
            this.nextNote();
        }
        if (this.isPlaying) this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }
    scheduleNote(time) {
        const isMainBeat = this.currentSubdivision === 0;
        const isFirstBeat = this.currentBeat === 0 && isMainBeat;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.value = isFirstBeat ? 1000 : (isMainBeat ? 800 : 400);
        gain.gain.setValueAtTime(isMainBeat ? 0.1 : 0.05, time);
        osc.type = 'square';
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.start(time);
        osc.stop(time + 0.1);
        setTimeout(() => this.showVisualBeat(isMainBeat), (time - this.audioContext.currentTime) * 1000);
    }
    showVisualBeat(isMainBeat) {
        const indicator = document.getElementById('visualIndicator');
        let patternArr = [];
        if (this.strumPattern === 'custom') {
            const val = this.customStrumInput.value.trim();
            patternArr = val.split(/\s+/).filter(Boolean);
        } else if (this.strumPattern && this.strumPatterns[this.strumPattern]) {
            patternArr = this.strumPatterns[this.strumPattern];
        }
        if (patternArr.length && isMainBeat) {
            const symbol = patternArr[this.currentBeat % patternArr.length];
            indicator.innerHTML = this._getStrumSymbolHTML(symbol);
            const arrowEl = indicator.querySelector('.strum-arrow');
            if (arrowEl) {
                arrowEl.classList.add('active');
                setTimeout(() => arrowEl.classList.remove('active'), 100);
            }
        } else if (isMainBeat) {
            indicator.classList.add('beat');
            setTimeout(() => indicator.classList.remove('beat'), 100);
        }
    }
    nextNote() {
        const secondsPerSubdivision = (60.0 / this.bpm) / this.subdivision;
        this.nextNoteTime += secondsPerSubdivision;
        this.currentSubdivision = (this.currentSubdivision + 1) % this.subdivision;
        if (this.currentSubdivision === 0) {
            const beatsPerMeasure = parseInt(this.timeSignature.split('/')[0]);
            this.currentBeat = (this.currentBeat + 1) % beatsPerMeasure;
        }
    }
}

// =================================================================================
// REPRODUCTOR DE BACKING TRACK
// =================================================================================
class BackingTrackPlayer {
    constructor() {
        this.metronome = null; // Se inyectará después de la construcción
        this.audio = document.getElementById('backingAudio');
        this.input = document.getElementById('backingTrackInput');
        this.loadBtn = document.getElementById('backingLoadBtn');
        this.playPauseBtn = document.getElementById('backingPlayPauseBtn');
        this.volumeSlider = document.getElementById('backingVolume');
        this.markABtn = document.getElementById('markA');
        this.markBBtn = document.getElementById('markB');
        this.progress = document.getElementById('backingProgress');
        this.timeDisplay = document.getElementById('backingTime');
        this.status = document.getElementById('backingStatus');
        this.pointA = null;
        this.pointB = null;
        this.isPlaying = false;
        this._setupEvents();
    }
    _setupEvents() {
        this.loadBtn.addEventListener('click', () => this.input.click());
        this.input.addEventListener('change', e => this._loadFile(e));
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.volumeSlider.addEventListener('input', e => this.audio.volume = parseFloat(e.target.value));
        this.markABtn.addEventListener('click', () => { this.pointA = this.audio.currentTime; this._updateStatus(); });
        this.markBBtn.addEventListener('click', () => { this.pointB = this.audio.currentTime; this._updateStatus(); });
        this.audio.addEventListener('ended', () => this._onEnded());
        this.audio.addEventListener('timeupdate', () => { this._checkLoop(); this._updateProgress(); });
        this.audio.addEventListener('loadedmetadata', () => this._updateProgress());
    }
    _loadFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        this.audio.src = url;
        this.audio.load();
        this.status.textContent = ``; // Limpiar estado de A/B
        this.loadBtn.textContent = `🎵 ${file.name.substring(0, 20)}...`;
        this.pointA = null; this.pointB = null;
        this.playPauseBtn.textContent = '▶️';
        this._updateProgress();
    }
    _updateProgress() {
        if (!this.audio.duration || isNaN(this.audio.duration)) {
            this.progress.value = 0;
            this.progress.max = 1;
            this.timeDisplay.textContent = '00:00 / 00:00';
            return;
        }
        this.progress.value = this.audio.currentTime;
        this.progress.max = this.audio.duration;
        this.timeDisplay.textContent = `${this._formatTime(this.audio.currentTime)} / ${this._formatTime(this.audio.duration)}`;
    }
    togglePlay() {
        if (!this.audio.src) return;
        if (this.audio.paused) {
            this.audio.play();
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸️';
            if (this.metronome && !this.metronome.isPlaying) {
                this.metronome.togglePlay();
            }
        } else {
            this.audio.pause();
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶️';
            if (this.metronome && this.metronome.isPlaying) {
                this.metronome.togglePlay();
            }
        }
    }
    _onEnded() {
        if (this.pointA !== null && this.pointB !== null && this.pointB > this.pointA) {
            this.audio.currentTime = this.pointA;
            this.audio.play();
        } else {
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶️';
            if (this.metronome && this.metronome.isPlaying) {
                this.metronome.stop();
            }
        }
    }
    _checkLoop() {
        if (this.pointA !== null && this.pointB !== null && this.pointB > this.pointA && this.audio.currentTime >= this.pointB) {
            this.audio.currentTime = this.pointA;
        }
    }
    _updateStatus() {
        let msg = '';
        if (this.pointA !== null) msg += `A: ${this._formatTime(this.pointA)} `;
        if (this.pointB !== null) msg += `B: ${this._formatTime(this.pointB)}`;
        this.status.textContent = msg.trim();
    }
    _formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// =================================================================================
// ENTRENADOR DE OÍDO MUSICAL
// =================================================================================
class EarTraining {
    constructor() {
        this.audioContext = null; this.currentInterval = null; this.currentChord = null; this.currentProgression = null; this.selectedInstrument = 'piano';
        this.intervals = [{ name: 'Unísono', semitones: 0 },{ name: '2ª menor', semitones: 1 },{ name: '2ª mayor', semitones: 2 },{ name: '3ª menor', semitones: 3 },{ name: '3ª mayor', semitones: 4 },{ name: '4ª justa', semitones: 5 },{ name: 'Tritono', semitones: 6 },{ name: '5ª justa', semitones: 7 },{ name: '6ª menor', semitones: 8 },{ name: '6ª mayor', semitones: 9 },{ name: '7ª menor', semitones: 10 },{ name: '7ª mayor', semitones: 11 },{ name: 'Octava', semitones: 12 }];
        this.chords = [{ name: 'Mayor', intervals: [0, 4, 7] },{ name: 'menor', intervals: [0, 3, 7] },{ name: 'Aumentado', intervals: [0, 4, 8] },{ name: 'Disminuido', intervals: [0, 3, 6] },{ name: 'Mayor 7', intervals: [0, 4, 7, 11] },{ name: 'menor 7', intervals: [0, 3, 7, 10] },{ name: 'Dominante 7', intervals: [0, 4, 7, 10] }];
        this.progressions = [{ name: 'I-V-vi-IV', chords: ['C', 'G', 'Am', 'F'] },{ name: 'vi-IV-I-V', chords: ['Am', 'F', 'C', 'G'] },{ name: 'I-vi-IV-V', chords: ['C', 'Am', 'F', 'G'] },{ name: 'ii-V-I', chords: ['Dm', 'G', 'C'] }];
        this.selectedIntervals = new Set(this.intervals.map(i => i.name));
        this.selectedChords = new Set(this.chords.map(c => c.name));
        this.selectedProgressions = new Set(this.progressions.map(p => p.name));
        this.setupControls();
    }
    setupControls() {
        document.getElementById('instrumentSelect').addEventListener('change', e => this.selectedInstrument = e.target.value);
        document.querySelectorAll('#ear-training .tab').forEach(tab => tab.addEventListener('click', e => this.showTab(e.target.dataset.tab)));
        document.getElementById('newInterval').addEventListener('click', () => this.playNewInterval());
        document.getElementById('repeatInterval').addEventListener('click', () => this.repeatCurrentInterval());
        document.getElementById('newChord').addEventListener('click', () => this.playNewChord());
        document.getElementById('repeatChord').addEventListener('click', () => this.repeatCurrentChord());
        document.getElementById('newProgression').addEventListener('click', () => this.playNewProgression());
        document.getElementById('repeatProgression').addEventListener('click', () => this.repeatCurrentProgression());
        this.renderIntervalCheckboxes();
        this.renderChordCheckboxes();
        this.renderProgressionCheckboxes();
    }
    renderIntervalCheckboxes() {
        const container = document.getElementById('intervalOptions');
        container.innerHTML = '<span style="font-weight:600;">¿Qué intervalos quieres practicar?</span>';
        this.intervals.forEach(interval => {
            const label = document.createElement('label');
            label.style.marginRight = '1.2em';
            label.style.fontWeight = '400';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = this.selectedIntervals.has(interval.name);
            cb.onchange = () => {
                if(cb.checked) this.selectedIntervals.add(interval.name);
                else this.selectedIntervals.delete(interval.name);
            };
            label.appendChild(cb);
            label.append(' ' + interval.name);
            container.appendChild(label);
        });
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '0.5em 1.5em';
        container.style.marginBottom = '1em';
    }
    renderChordCheckboxes() {
        const container = document.getElementById('chordOptions');
        container.innerHTML = '<span style="font-weight:600;">¿Qué acordes quieres practicar?</span>';
        this.chords.forEach(chord => {
            const label = document.createElement('label');
            label.style.marginRight = '1.2em';
            label.style.fontWeight = '400';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = this.selectedChords.has(chord.name);
            cb.onchange = () => {
                if(cb.checked) this.selectedChords.add(chord.name);
                else this.selectedChords.delete(chord.name);
            };
            label.appendChild(cb);
            label.append(' ' + chord.name);
            container.appendChild(label);
        });
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '0.5em 1.5em';
        container.style.marginBottom = '1em';
    }
    renderProgressionCheckboxes() {
        const container = document.getElementById('progressionOptions');
        container.innerHTML = '<span style="font-weight:600;">¿Qué progresiones quieres practicar?</span>';
        this.progressions.forEach(prog => {
            const label = document.createElement('label');
            label.style.marginRight = '1.2em';
            label.style.fontWeight = '400';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = this.selectedProgressions.has(prog.name);
            cb.onchange = () => {
                if(cb.checked) this.selectedProgressions.add(prog.name);
                else this.selectedProgressions.delete(prog.name);
            };
            label.appendChild(cb);
            label.append(' ' + prog.name);
            container.appendChild(label);
        });
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '0.5em 1.5em';
        container.style.marginBottom = '1em';
    }
    showTab(tabId) {
        document.querySelectorAll('#ear-training .tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('#ear-training .tab').forEach(tab => tab.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`#ear-training .tab[data-tab="${tabId}"]`).classList.add('active');
    }
    initAudioContext() { if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
    playNewInterval() {
        this.initAudioContext();
        const pool = this.intervals.filter(i => this.selectedIntervals.has(i.name));
        const arr = pool.length ? pool : this.intervals;
        this.currentInterval = arr[Math.floor(Math.random() * arr.length)];
        this.playInterval(this.currentInterval.semitones);
        document.getElementById('intervalResult').textContent = '🎵 Escucha el intervalo...';
        this.showOptions('interval', arr, this.currentInterval);
    }
    repeatCurrentInterval() { if (this.currentInterval) this.playInterval(this.currentInterval.semitones); }
    playNewChord() {
        this.initAudioContext();
        const pool = this.chords.filter(c => this.selectedChords.has(c.name));
        const arr = pool.length ? pool : this.chords;
        this.currentChord = arr[Math.floor(Math.random() * arr.length)];
        this.playChord(this.currentChord.intervals);
        document.getElementById('chordResult').textContent = '🎹 Escucha el acorde...';
        this.showOptions('chord', arr, this.currentChord);
    }
    repeatCurrentChord() { if (this.currentChord) this.playChord(this.currentChord.intervals); }
    playNewProgression() {
        this.initAudioContext();
        const pool = this.progressions.filter(p => this.selectedProgressions.has(p.name));
        const arr = pool.length ? pool : this.progressions;
        this.currentProgression = arr[Math.floor(Math.random() * arr.length)];
        this.playProgression(this.currentProgression.chords);
        document.getElementById('progressionResult').textContent = '🎼 Escucha la progresión...';
        this.showOptions('progression', arr, this.currentProgression);
    }
    repeatCurrentProgression() { if (this.currentProgression) this.playProgression(this.currentProgression.chords); }
    showOptions(type, optionsArray, correctOption) {
        const container = document.getElementById(`${type}Options`);
        container.innerHTML = ''; container.style.display = 'block';
        const options = this.generateRandomOptions(optionsArray, correctOption, 4);
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'exercise-btn button';
            btn.textContent = type === 'chord' ? `Acorde ${option.name}` : option.name;
            btn.addEventListener('click', () => this.checkAnswer(type, option, btn, correctOption));
            container.appendChild(btn);
        });
    }

    checkAnswer(type, selectedOption, button, correctOption) {
        const isCorrect = selectedOption.name === correctOption.name;
        const resultDiv = document.getElementById(`${type}Result`);
        const optionsContainer = document.getElementById(`${type}Options`);
        optionsContainer.querySelectorAll('.button').forEach(b => b.disabled = true);
        button.classList.add(isCorrect ? 'correct' : 'incorrect');
        resultDiv.style.color = `var(--${isCorrect ? 'success' : 'error'}-color)`;
        if (isCorrect) {
            resultDiv.textContent = `✅ ¡Correcto! ${correctOption.name}`;
        } else {
            resultDiv.textContent = `❌ Incorrecto. Era: ${correctOption.name}`;
            optionsContainer.querySelectorAll('.button').forEach(btn => {
                if (btn.textContent.includes(correctOption.name)) btn.classList.add('correct');
            });
        }
        setTimeout(() => {
            optionsContainer.style.display = 'none';
            resultDiv.textContent = '';
        }, 3000);
    }

    playInterval(semitones) {
        const baseFreq = 261.63;
        this.playTone(baseFreq, 0, 1);
        setTimeout(() => this.playTone(baseFreq * Math.pow(2, semitones / 12), 0, 1), 800);
    }
    playChord(intervals) {
        const baseFreq = this.selectedInstrument === 'bass' ? 130.81 : 261.63;
        intervals.forEach(interval => this.playTone(baseFreq * Math.pow(2, interval / 12), 0, 2));
    }
    playProgression(chordNames) {
        const chordMap = { 'C': [0, 4, 7], 'Dm': [2, 5, 9], 'F': [5, 9, 12], 'G': [7, 11, 14], 'Am': [9, 12, 16] };
        chordNames.forEach((chordName, index) => {
            setTimeout(() => this.playChord(chordMap[chordName] || [0, 4, 7]), index * 1200);
        });
    }
    generateRandomOptions(array, correct, count) {
        const options = [...array];
        for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
        const wrongOptions = options.filter(opt => opt.name !== correct.name);
        const finalOptions = [correct, ...wrongOptions.slice(0, count - 1)];
        return finalOptions.sort(() => Math.random() - 0.5);
    }
    
    playTone(frequency, delay = 0, duration = 1) {
        this.initAudioContext();
        const startTime = this.audioContext.currentTime + delay;
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        osc.frequency.value = frequency;
        switch (this.selectedInstrument) {
            case 'piano': osc.type = 'triangle'; gainNode.gain.setValueAtTime(0, startTime); gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05); gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration); break;
            case 'guitar': osc.type = 'sawtooth'; gainNode.gain.setValueAtTime(0, startTime); gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02); gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); break;
            case 'bass': osc.type = 'sine'; gainNode.gain.setValueAtTime(0, startTime); gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05); gainNode.gain.linearRampToValueAtTime(0, startTime + duration); break;
        }
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    triggerNewExercise() {
        const activeTab = document.querySelector('#ear-training .tab.active').dataset.tab;
        document.getElementById(`new${activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}`).click();
    }
    triggerRepeatExercise() {
        const activeTab = document.querySelector('#ear-training .tab.active').dataset.tab;
        document.getElementById(`repeat${activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}`).click();
    }
}

// =================================================================================
// VISUALIZADOR DE ESCALAS
// =================================================================================
class ScaleVisualizer {
    constructor() {
        this.notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            'pentatonic-major': [0, 2, 4, 7, 9],
            'pentatonic-minor': [0, 3, 5, 7, 10],
            'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
            'mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'dorian': [0, 2, 3, 5, 7, 9, 10]
        };
        this.scaleDegrees = {
            major: ['R', '2', '3', '4', '5', '6', '7'],
            minor: ['R', '2', 'b3', '4', '5', 'b6', 'b7'],
            'pentatonic-major': ['R', '2', '3', '5', '6'],
            'pentatonic-minor': ['R', 'b3', '4', '5', 'b7'],
            'harmonic-minor': ['R', '2', 'b3', '4', '5', 'b6', '7'],
            'mixolydian': ['R', '2', '3', '4', '5', '6', 'b7'],
            'dorian': ['R', '2', 'b3', '4', '5', '6', 'b7']
        };
        this.tuning = [4, 9, 2, 7, 11, 4]; // EADGBe in indexes
        this.rootSelect = document.getElementById('rootNoteSelect');
        this.scaleSelect = document.getElementById('scaleTypeSelect');
        this.container = document.getElementById('fretboardVisualizer');
        this.showDegrees = false;
        this.addDegreeSwitch();
        this.rootSelect.addEventListener('change', () => this.render());
        this.scaleSelect.addEventListener('change', () => this.render());
    }
    addDegreeSwitch() {
        // Crear el switch visual
        const controls = document.querySelector('.scales-controls');
        const wrapper = document.createElement('label');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '0.5em';
        wrapper.style.fontWeight = '500';
        wrapper.style.fontSize = '1rem';
        wrapper.style.marginLeft = '1em';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.style.transform = 'scale(1.2)';
        input.addEventListener('change', e => {
            this.showDegrees = input.checked;
            this.render();
        });
        const span = document.createElement('span');
        span.textContent = 'Ver grados';
        wrapper.appendChild(input);
        wrapper.appendChild(span);
        controls.appendChild(wrapper);
    }
    render() {
        const rootNoteName = this.rootSelect.value.split(' ')[0];
        const rootIndex = this.notes.indexOf(rootNoteName);
        const scaleType = this.scaleSelect.value;
        const scaleIntervals = this.scales[scaleType];
        const scaleNoteIndexes = new Set(scaleIntervals.map(i => (rootIndex + i) % 12));
        const degrees = this.scaleDegrees[scaleType];
        this.container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'fretboard-grid';
        grid.appendChild(document.createElement('div'));
        for (let fret = 0; fret <= 12; fret++) {
            const fretLabel = document.createElement('div');
            fretLabel.className = 'fret-number-label';
            fretLabel.textContent = fret === 0 ? 'Open' : fret;
            if ([3, 5, 7, 9].includes(fret)) fretLabel.classList.add('fret-marker');
            if (fret === 12) fretLabel.classList.add('fret-marker-double');
            grid.appendChild(fretLabel);
        }
        this.tuning.slice().reverse().forEach(openNoteIndex => {
            const stringLabel = document.createElement('div');
            stringLabel.className = 'string-label';
            stringLabel.textContent = this.notes[openNoteIndex];
            grid.appendChild(stringLabel);
            for (let fret = 0; fret <= 12; fret++) {
                const noteIndex = (openNoteIndex + fret) % 12;
                const cell = document.createElement('div');
                cell.className = 'fret-cell';
                if (scaleNoteIndexes.has(noteIndex)) {
                    const dot = document.createElement('div');
                    dot.className = 'note-dot';
                    let scaleIdx = scaleIntervals.findIndex(i => (rootIndex + i) % 12 === noteIndex);
                    if (this.showDegrees && scaleIdx !== -1) {
                        dot.textContent = degrees[scaleIdx];
                    } else {
                        dot.textContent = this.notes[noteIndex];
                    }
                    dot.classList.add(noteIndex === rootIndex ? 'root-note' : 'scale-note');
                    cell.appendChild(dot);
                }
                grid.appendChild(cell);
            }
        });
        this.container.appendChild(grid);
    }
}

// =================================================================================
// GESTOR DE CANCIONES PRO
// =================================================================================
class SongManager {
    constructor(earTrainingInstance, backingTrackPlayer, metronome) {
        this.earTraining = earTrainingInstance;
        this.backingTrackPlayer = backingTrackPlayer;
        this.metronome = metronome;
        this.songs = []; this.currentSong = null; this.currentTransposition = 0;
        this.tooltip = document.getElementById('chordTooltip');
        this.chordDiagrams = {
            'C': { frets: ['x', 3, 2, 0, 1, 0] }, 'G': { frets: [3, 2, 0, 0, 0, 3] }, 'D': { frets: ['x', 'x', 0, 2, 3, 2] }, 'A': { frets: ['x', 0, 2, 2, 2, 0] }, 'E': { frets: [0, 2, 2, 1, 0, 0] },
            'Am': { frets: ['x', 0, 2, 2, 1, 0] }, 'Em': { frets: [0, 2, 2, 0, 0, 0] }, 'Dm': { frets: ['x', 'x', 0, 2, 3, 1] }, 'F': { frets: [1, 3, 3, 2, 1, 1], barre: 1 },
            'C7': { frets: ['x', 3, 2, 3, 1, 0] }, 'G7': { frets: [3, 2, 0, 0, 0, 1] }, 'D7': { frets: ['x', 'x', 0, 2, 1, 2] }, 'A7': { frets: ['x', 0, 2, 0, 2, 0] }, 'E7': { frets: [0, 2, 0, 1, 0, 0] }, 'B7': { frets: ['x', 2, 1, 2, 0, 2] }
        };
        this.loopingSection = -1;
        this.loopInterval = null;
        this.sectionLoopBtns = [];
        this.setupControls();
        this.setupModalControls();
        this.loadSongs();
    }
    setupControls() {
        document.getElementById('songSelect').addEventListener('change', e => this.selectSong(e.target.value));
        document.getElementById('deleteSongBtn').addEventListener('click', () => this.deleteSong());
        document.getElementById('transposeUp').addEventListener('click', () => this.transposeSong(1));
        document.getElementById('transposeDown').addEventListener('click', () => this.transposeSong(-1));
        document.getElementById('importSongsBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('exportSongsBtn').addEventListener('click', () => this.exportSongs());
        document.getElementById('fileInput').addEventListener('change', e => this.importSongs(e));
        document.getElementById('exportMidiBtn').addEventListener('click', () => this.exportToMidi());
    }
    setupModalControls() {
        this.modalOverlay = document.getElementById('songModalOverlay');
        this.modalForm = document.getElementById('songForm');
        this.titleInput = document.getElementById('songTitleInput');
        this.artistInput = document.getElementById('songArtistInput');
        this.structureInput = document.getElementById('songStructureInput');
        this.modalTitle = document.getElementById('songModalTitle');
        this.closeBtn = document.getElementById('closeSongModalBtn');
        this.cancelBtn = document.getElementById('cancelSongModalBtn');
        this.editingSongId = null;
        document.getElementById('addSongBtn').addEventListener('click', () => this.showSongModal());
        this.closeBtn.addEventListener('click', () => this._closeSongModal());
        this.cancelBtn.addEventListener('click', () => this._closeSongModal());
        this.modalOverlay.addEventListener('click', e => { if(e.target === this.modalOverlay) this._closeSongModal(); });
        this.modalForm.addEventListener('submit', e => this._handleSongFormSubmit(e));
    }
    showSongModal(songId = null) {
        this.editingSongId = songId;
        if (songId) {
            const song = this.songs.find(s => s.id === songId);
            if (!song) return;
            this.modalTitle.textContent = 'Editar Canción';
            this.titleInput.value = song.title;
            this.artistInput.value = song.artist;
            this.structureInput.value = song.structure.map(sec => `[${sec.name}]\n${sec.chords.join(' ')}`).join('\n\n');
        } else {
            this.modalTitle.textContent = 'Nueva Canción';
            this.modalForm.reset();
        }
        this.modalOverlay.style.display = 'flex';
    }
    _closeSongModal() {
        this.modalOverlay.style.display = 'none';
        this.modalForm.reset();
        this.editingSongId = null;
    }
    _handleSongFormSubmit(e) {
        e.preventDefault();
        const title = this.titleInput.value.trim();
        const artist = this.artistInput.value.trim();
        const structureText = this.structureInput.value.trim();
        if(!title || !structureText) return;
        const sections = [];
        let currentSection = { name: '', chords: [] };
        structureText.split(/\n/).forEach(line => {
            const sectionMatch = line.match(/^\s*\[(.+)\]\s*$/);
            if(sectionMatch) {
                if(currentSection.name) sections.push(currentSection);
                currentSection = { name: sectionMatch[1], chords: [] };
            } else if(line.trim()) {
                currentSection.chords.push(...line.trim().split(/\s+/));
            }
        });
        if(currentSection.name) sections.push(currentSection);
        const songObj = {
            id: this.editingSongId || 'song_' + Date.now() + Math.floor(Math.random()*1000),
            title,
            artist,
            structure: sections
        };
        if(this.editingSongId) {
            const idx = this.songs.findIndex(s => s.id === this.editingSongId);
            if(idx !== -1) this.songs[idx] = songObj;
        } else {
            this.songs.push(songObj);
        }
        this.saveSongs();
        this.updateSongSelect();
        this.selectSong(songObj.id);
        this._closeSongModal();
    }
    loadSongs() {
        const saved = localStorage.getItem('gwt-songs');
        this.songs = saved ? JSON.parse(saved) : [];
        if (this.songs.length === 0) this.loadExampleSong();
        this.updateSongSelect();
        this.selectSong(this.songs[0]?.id);
    }
    loadExampleSong() {
        const exampleSong = {
            id: 'example-1', title: 'Sublime Gracia', artist: 'John Newton (Arr. Sencillo)',
            structure: [
                { name: 'Verso 1', chords: ['G', 'C', 'G', 'G', 'G', 'G', 'D', 'D'] },
                { name: 'Verso 2', chords: ['G', 'C', 'G', 'G', 'G', 'D', 'G', 'G'] }
            ]
        };
        this.songs.push(exampleSong);
        this.saveSongs();
    }
    saveSongs() { localStorage.setItem('gwt-songs', JSON.stringify(this.songs)); }
    selectSong(id) {
        this.currentSong = this.songs.find(s => s.id === id);
        this.currentTransposition = 0;
        this.toggleDisplay();
        if(this.currentSong) {
            document.getElementById('songSelect').value = id;
            this.displaySong();
        }
    }
    toggleDisplay() {
        const hasSongs = this.songs.length > 0;
        document.getElementById('songEmptyState').style.display = hasSongs ? 'none' : 'block';
        document.getElementById('songDisplay').style.display = this.currentSong ? 'block' : 'none';
        document.getElementById('deleteSongBtn').style.display = this.currentSong ? 'inline-flex' : 'none';
        document.getElementById('exportSongsBtn').style.display = hasSongs ? 'inline-flex' : 'none';
    }
    displaySong() {
        if (!this.currentSong) return;
        document.getElementById('currentSongTitle').textContent = this.currentSong.title;
        document.getElementById('currentSongArtist').textContent = this.currentSong.artist;
        const structureContainer = document.getElementById('songStructure');
        structureContainer.innerHTML = '';
        this.sectionLoopBtns = [];
        this.currentSong.structure.forEach((section, sectionIndex) => {
            const sectionTitleDiv = document.createElement('div');
            sectionTitleDiv.className = 'section-title';
            if (this.loopingSection === sectionIndex) sectionTitleDiv.classList.add('looping-section');
            const sectionNameSpan = document.createElement('span');
            sectionNameSpan.textContent = `[${section.name}]`;
            sectionTitleDiv.appendChild(sectionNameSpan);
            const loopBtn = document.createElement('span');
            loopBtn.className = 'section-loop-btn';
            loopBtn.textContent = '⟲';
            loopBtn.title = 'Repetir esta sección';
            if (this.loopingSection === sectionIndex) loopBtn.classList.add('looping');
            loopBtn.onclick = () => this.toggleSectionLoop(sectionIndex);
            sectionTitleDiv.appendChild(loopBtn);
            if (sectionIndex === 0) {
                let editBtn = document.getElementById('editSongBtn');
                if (!editBtn) {
                    editBtn = document.createElement('button');
                    editBtn.id = 'editSongBtn';
                    editBtn.className = 'button';
                    editBtn.textContent = '✏️ Editar';
                    editBtn.style.marginLeft = '0.5rem';
                    editBtn.onclick = () => this.showSongModal(this.currentSong.id);
                    const songActions = document.querySelector('#songDisplay .song-actions');
                    songActions.appendChild(editBtn);
                }
            }
            const chordsDiv = document.createElement('div');
            const transposedChords = section.chords.map(chord => this.transposeChord(chord, this.currentTransposition));
            transposedChords.forEach((chord, i) => {
                const chordSpan = document.createElement('span');
                chordSpan.className = 'chord';
                chordSpan.textContent = chord;
                chordSpan.addEventListener('mouseenter', e => this.showChordTooltip(e, chord));
                chordSpan.addEventListener('mouseleave', () => this.hideChordTooltip());
                chordsDiv.appendChild(chordSpan);
                if(i < transposedChords.length - 1) chordsDiv.append(' | ');
            });
            structureContainer.appendChild(sectionTitleDiv);
            structureContainer.appendChild(chordsDiv);
            if(sectionIndex < this.currentSong.structure.length - 1) structureContainer.append(document.createElement('br'));
        });
    }
    
    showChordTooltip(event, chordName) {
        let match = chordName.match(/^([A-G])[#b]?(.*)/i);
        if (!match) return;
        let root = match[1];
        let quality = match[2] || '';
        let baseChord = root + quality;
        let diagram = this.chordDiagrams[baseChord] || this.chordDiagrams[root];
        if (!diagram) return;
        this.tooltip.innerHTML = this._createTooltipFretboardHTML(chordName, diagram);
        const rect = event.target.getBoundingClientRect();
        this.tooltip.style.left = `${rect.left}px`;
        this.tooltip.style.top = `${rect.bottom + 10}px`;
        this.tooltip.classList.add('visible');
    }

    hideChordTooltip() { this.tooltip.classList.remove('visible'); }
    
    _createTooltipFretboardHTML(name, diagram) {
        let html = `<div class="fretboard-tooltip"><div class="chord-name">${name}</div>`;
        const frets = diagram.frets;
        const stringPositions = [5, 15, 25, 35, 45, 55];
        let topRow = '';
        frets.forEach((f, i) => {
            const pos = stringPositions[i];
            if (f === 0) topRow += `<div class="open-string-tooltip" style="left: ${pos}px;"></div>`;
            if (f === 'x') topRow += `<div class="muted-string-tooltip" style="left: ${pos}px;">×</div>`;
        });
        html += `<div style="position: relative; height: 10px;">${topRow}</div>`;
        for (let fret = 1; fret <= 4; fret++) {
            html += '<div class="fret-tooltip">';
            stringPositions.forEach(pos => html += `<div class="string-tooltip" style="left: ${pos}px;"></div>`);
            frets.forEach((f, stringIndex) => {
                if(f === fret) html += `<div class="finger-tooltip" style="left: ${stringPositions[stringIndex]}px; top: 50%;"></div>`;
            });
            html += '</div>';
        }
        return html + '</div>';
    }

    deleteSong() {
        if (!this.currentSong || !confirm(`¿Eliminar "${this.currentSong.title}"?`)) return;
        this.songs = this.songs.filter(s => s.id !== this.currentSong.id);
        this.saveSongs();
        this.currentSong = null;
        this.updateSongSelect();
        this.toggleDisplay();
    }
    transposeSong(steps) {
        if (!this.currentSong) return;
        this.currentTransposition += steps;
        this.displaySong();
    }
    transposeChord(chord, steps) {
        if(steps === 0) return chord;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const regex = /^([A-G][#b]?)(.*)/;
        const match = chord.match(regex);
        if (!match) return chord;
        
        let [, root, rest] = match;
        let index = notes.indexOf(root);
        if(index === -1) index = flatNotes.indexOf(root);
        if (index === -1) return chord;
        
        const newIndex = (index + steps % 12 + 12) % 12;
        const useFlats = ['F','Bb','Eb','Ab','Db','Gb'].includes(notes[newIndex]);
        return (useFlats ? flatNotes[newIndex] : notes[newIndex]) + rest;
    }
    updateSongSelect() {
        const select = document.getElementById('songSelect');
        select.innerHTML = '<option value="">Selecciona una canción...</option>';
        this.songs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.id; option.textContent = `${song.title} - ${song.artist}`;
            select.appendChild(option);
        });
    }
    exportSongs() {
        if (this.songs.length === 0) return alert('No hay canciones para exportar.');
        document.body.classList.add('loading');
        const data = JSON.stringify(this.songs, null, 2);
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'guitar-trainer-backup.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setTimeout(() => document.body.classList.remove('loading'), 500);
    }
    importSongs(event) {
        const file = event.target.files[0];
        if (!file) return;
        document.body.classList.add('loading');
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const importedSongs = JSON.parse(e.target.result);
                if (!Array.isArray(importedSongs)) throw new Error("Formato inválido.");
                const existingIds = this.songs.map(s => s.id);
                const newSongs = importedSongs.filter(s => s.id && s.title && !existingIds.includes(s.id));
                this.songs.push(...newSongs);
                this.saveSongs();
                this.updateSongSelect();
                this.toggleDisplay();
                alert(`${newSongs.length} canciones importadas.`);
            } catch (err) { alert(`Error al importar: ${err.message}`); }
            finally { document.body.classList.remove('loading'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
    toggleSectionLoop(sectionIndex) {
        if (this.loopingSection === sectionIndex) {
            this.loopingSection = -1;
        } else {
            this.loopingSection = sectionIndex;
            if (this.backingTrackPlayer && this.backingTrackPlayer.audio.src) {
                const bpm = this.metronome ? this.metronome.bpm : 120;
                const section = this.currentSong.structure[sectionIndex];
                const beatsPerChord = 1;
                const secondsPerBeat = 60 / bpm;
                const sectionStart = this.currentSong.structure.slice(0, sectionIndex).reduce((acc, sec) => acc + sec.chords.length * beatsPerChord * secondsPerBeat, 0);
                const sectionDuration = section.chords.length * beatsPerChord * secondsPerBeat;
                this.backingTrackPlayer.pointA = sectionStart;
                this.backingTrackPlayer.pointB = sectionStart + sectionDuration;
                this.backingTrackPlayer._updateStatus();
            } else {
                this._showToast("Carga una pista de audio para usar el loop A/B.");
            }
        }
        this.displaySong();
    }
    exportToMidi() {
        if (!this.currentSong) return alert('Selecciona una canción.');
        const noteMap = {
            'C': ['C4','E4','G4'], 'Cm': ['C4','D#4','G4'],
            'D': ['D4','F#4','A4'], 'Dm': ['D4','F4','A4'],
            'E': ['E4','G#4','B4'], 'Em': ['E4','G4','B4'],
            'F': ['F4','A4','C5'], 'Fm': ['F4','G#4','C5'],
            'G': ['G4','B4','D5'], 'Gm': ['G4','A#4','D5'],
            'A': ['A4','C#5','E5'], 'Am': ['A4','C5','E5'],
            'B': ['B4','D#5','F#5'], 'Bm': ['B4','D5','F#5']
        };
        let chords = [];
        this.currentSong.structure.forEach(section => {
            chords = chords.concat(section.chords.map(chord => this.transposeChord(chord, this.currentTransposition)));
        });
        const track = new MidiWriter.Track();
        track.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 1}));
        chords.forEach(chord => {
            let match = chord.match(/^([A-G][b#]?)(m)?/i);
            let key = match ? (match[1].replace('b','').replace('#','') + (match[2]||'')) : chord;
            let notes = noteMap[key];
            if (!notes) return;
            track.addEvent(new MidiWriter.NoteEvent({pitch: notes, duration: '1'}));
        });
        const write = new MidiWriter.Writer(track);
        const blob = new Blob([write.buildFile()], {type: 'audio/midi'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${this.currentSong.title || 'cancion'}.mid`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this._showToast('✅ Archivo MIDI exportado con éxito.');
    }
    _showToast(msg) {
        let toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '2em';
        toast.style.right = '2em';
        toast.style.background = 'var(--accent-primary)';
        toast.style.color = '#fff';
        toast.style.padding = '1em 2em';
        toast.style.borderRadius = '10px';
        toast.style.fontWeight = 'bold';
        toast.style.fontSize = '1.1em';
        toast.style.boxShadow = '0 2px 12px rgba(52,152,219,0.15)';
        toast.style.zIndex = 9999;
        document.body.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 2500);
    }
}

// =================================================================================
// JUEGO DE MEMORIA MUSICAL
// =================================================================================
class MemoryGame {
    constructor(earTrainingInstance) {
        this.earTraining = earTrainingInstance;
        this.sequence = []; this.playerSequence = []; this.level = 0;
        this.isPlaying = false;
        this.chords = ['C', 'G', 'Am', 'F', 'D', 'Em'];
        this.display = document.getElementById('memorySequenceDisplay');
        this.optionsContainer = document.getElementById('memoryOptionsContainer');
        this.resultDisplay = document.getElementById('memoryResult');
        document.getElementById('startMemoryGameBtn').addEventListener('click', () => this.startGame());
    }
    startGame() {
        this.level = 1; this.sequence = []; this.playerSequence = [];
        this.resultDisplay.textContent = '';
        this.nextLevel();
    }
    nextLevel() {
        this.display.textContent = `Nivel ${this.level}`;
        this.playerSequence = [];
        const randomChord = this.chords[Math.floor(Math.random() * this.chords.length)];
        this.sequence.push(randomChord);
        this.playSequence();
    }
    playSequence() {
        this.isPlaying = true; this.optionsContainer.innerHTML = '';
        this.sequence.forEach((chord, index) => {
            setTimeout(() => {
                this.display.textContent = chord;
                if(this.earTraining) {
                    const isMinor = chord.endsWith('m');
                    const chordData = this.earTraining.chords.find(c => isMinor ? c.name === 'menor' : c.name === 'Mayor');
                    if (chordData) this.earTraining.playChord(chordData.intervals);
                }
                setTimeout(() => this.display.textContent = '', 500);
            }, (index + 1) * 1000);
        });
        setTimeout(() => {
            this.isPlaying = false;
            this.display.textContent = 'Tu Turno...';
            this.createOptions();
        }, (this.sequence.length + 1) * 1000);
    }
    createOptions() {
        this.optionsContainer.innerHTML = '';
        this.chords.forEach(chord => {
            const btn = document.createElement('button');
            btn.className = 'exercise-btn button';
            btn.textContent = chord;
            btn.addEventListener('click', () => this.handlePlayerInput(chord));
            this.optionsContainer.appendChild(btn);
        });
    }
    handlePlayerInput(chord) {
        if (this.isPlaying) return;
        this.playerSequence.push(chord);
        const currentIndex = this.playerSequence.length - 1;

        if (this.playerSequence[currentIndex] !== this.sequence[currentIndex]) {
            this.resultDisplay.textContent = `❌ ¡Incorrecto! La secuencia era ${this.sequence.join(' - ')}. Has llegado al nivel ${this.level}.`;
            this.resultDisplay.style.color = 'var(--error-color)';
            this.display.textContent = 'Juego Terminado';
            return;
        }

        if (this.playerSequence.length === this.sequence.length) {
            this.resultDisplay.textContent = '✅ ¡Correcto!';
            this.resultDisplay.style.color = 'var(--success-color)';
            this.level++;
            setTimeout(() => {
                this.resultDisplay.textContent = '';
                this.nextLevel();
            }, 1500);
        }
    }
}
// =================================================================================
// GRABADORA DE IDEAS
// =================================================================================
class IdeaRecorder {
    constructor() {
        this.recBtn = document.getElementById('recBtn');
        this.recTime = document.getElementById('recTime');
        this.recList = document.getElementById('recList');
        this.recStatus = document.getElementById('recStatus');
        this.mediaRecorder = null;
        this.isRecording = false;
        this.chunks = [];
        this.timerInterval = null;
        this.startTime = 0;
        this._setupEvents();
    }
    _setupEvents() {
        if(!this.recBtn) return;
        this.recBtn.addEventListener('click', () => this.toggleRecording());
    }
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
            this.mediaRecorder.onstop = () => this._saveRecording();
            this.chunks = [];
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recBtn.textContent = '■ Detener';
            this.recBtn.classList.add('recording');
            this.recStatus.textContent = "Grabando...";
            this._startTimer();
        } catch (err) {
            this.recStatus.textContent = "Error: No se pudo acceder al micrófono.";
            console.error("Error al acceder al micrófono:", err);
        }
    }
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.recBtn.textContent = '● Grabar';
            this.recBtn.classList.remove('recording');
            this.recStatus.textContent = "Grabación detenida.";
            this._stopTimer();
        }
    }
    _startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            this.recTime.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }
    _stopTimer() {
        clearInterval(this.timerInterval);
        this.recTime.textContent = "00:00";
    }
    _saveRecording() {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const audioURL = URL.createObjectURL(blob);
        this._addRecordingToList(audioURL);
        this.chunks = [];
    }
    _addRecordingToList(audioURL) {
        const li = document.createElement('li');
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = audioURL;
        const name = document.createElement('span');
        name.textContent = `Grabación #${this.recList.children.length + 1}`;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.className = 'delete';
        deleteBtn.onclick = () => {
            li.remove();
            URL.revokeObjectURL(audioURL);
        };
        li.appendChild(name);
        li.appendChild(audio);
        li.appendChild(deleteBtn);
        this.recList.prepend(li);
    }
}

// =================================================================================
// CLASE PRINCIPAL DE LA APLICACIÓN
// =================================================================================
class GuitarWorshipTrainer {
    constructor() {
        // Primero, se crean las instancias
        this.themeManager = new ThemeManager();
        this.earTraining = new EarTraining();
        this.scaleVisualizer = new ScaleVisualizer();
        this.memoryGame = new MemoryGame(this.earTraining);
        this.ideaRecorder = new IdeaRecorder();
        this.backingTrackPlayer = new BackingTrackPlayer();
        this.metronome = new Metronome(this.backingTrackPlayer);
        this.songManager = new SongManager(this.earTraining, this.backingTrackPlayer, this.metronome);
        
        // Ahora se establecen las referencias cruzadas
        this.backingTrackPlayer.metronome = this.metronome;

        this.currentSection = 'inicio';
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupThemeSwitcher();
        this.setupCardNavigation();
        this.setupKeyboardShortcuts();
        this.setupCopyright();
        this.themeManager.loadSavedTheme();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showSection(btn.dataset.section);
            });
        });
    }

    setupCardNavigation() {
        document.querySelectorAll('.card[data-section]').forEach(card => {
            card.addEventListener('click', () => {
                this.showSection(card.dataset.section);
            });
        });
    }

    setupThemeSwitcher() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.themeManager.setTheme(btn.dataset.theme);
                this.updateActiveThemeButton(btn);
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (this.currentSection === 'metronome' && e.code === 'Space') {
                e.preventDefault();
                this.metronome.togglePlay();
            }
             if (this.currentSection === 'ear-training') {
                if (e.code === 'KeyN') { e.preventDefault(); this.earTraining.triggerNewExercise(); }
                if (e.code === 'KeyR') { e.preventDefault(); this.earTraining.triggerRepeatExercise(); }
            }
        });
    }

    setupCopyright() {
        document.getElementById('copyright-year').textContent = new Date().getFullYear();
    }

    showSection(sectionId) {
        this.currentSection = sectionId;
        document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === sectionId));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === sectionId));

        if (sectionId !== 'metronome' && this.metronome.isPlaying) {
            this.metronome.stop();
        }
        if (sectionId === 'scales' && this.scaleVisualizer) {
            this.scaleVisualizer.render();
        }
    }

    updateActiveThemeButton(activeBtn) {
        document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }
}

// Inicializar la aplicación
window.addEventListener('DOMContentLoaded', () => {
    window.app = new GuitarWorshipTrainer();
});