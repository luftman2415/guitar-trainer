// Lógica específica para el Metrónomo

let metronomeIsPlaying = false;
let bpm = 120;
let timeSignature = [4, 4];
let subdivision = 1;
let beatInterval;
let currentBeat = 0;

// Speed Trainer
let speedTrainerActive = false;
let speedTrainerIncrease = 5;
let speedTrainerBars = 8;
let barCount = 0;

function setupMetronome() {
    const playPauseBtn = document.getElementById('play-pause-metronome');
    const bpmSlider = document.getElementById('bpm-slider');
    const timeSignatureSelect = document.getElementById('time-signature-select');
    const subdivisionSelect = document.getElementById('subdivision-select');
    
    // Speed Trainer controls
    const speedTrainerToggle = document.getElementById('speed-trainer-toggle');
    const speedTrainerIncreaseInput = document.getElementById('speed-trainer-increase');
    const speedTrainerBarsInput = document.getElementById('speed-trainer-bars');

    playPauseBtn.addEventListener('click', toggleMetronome);
    
    bpmSlider.addEventListener('input', (e) => {
        bpm = parseInt(e.target.value);
        updateBpmDisplay(bpm);
        if (metronomeIsPlaying) {
            stopMetronome();
            startMetronome();
        }
    });

    timeSignatureSelect.addEventListener('change', (e) => {
        timeSignature = e.target.value.split('/').map(Number);
        if (metronomeIsPlaying) {
            stopMetronome();
            startMetronome();
        }
    });

    subdivisionSelect.addEventListener('change', (e) => {
        subdivision = parseInt(e.target.value);
        if (metronomeIsPlaying) {
            stopMetronome();
            startMetronome();
        }
    });
    
    // Speed trainer listeners
    speedTrainerToggle.addEventListener('change', (e) => speedTrainerActive = e.target.checked);
    speedTrainerIncreaseInput.addEventListener('input', (e) => speedTrainerIncrease = parseInt(e.target.value));
    speedTrainerBarsInput.addEventListener('input', (e) => speedTrainerBars = parseInt(e.target.value));
}

function toggleMetronome() {
    metronomeIsPlaying = !metronomeIsPlaying;
    if (metronomeIsPlaying) {
        startMetronome();
        document.getElementById('play-pause-metronome').textContent = '⏹️ Parar';
    } else {
        stopMetronome();
        document.getElementById('play-pause-metronome').textContent = '▶️ Iniciar';
    }
}

function startMetronome() {
    currentBeat = 0;
    barCount = 0;
    const interval = (60 / bpm) * 1000 / (subdivision);
    beatInterval = setInterval(playBeat, interval);
}

function stopMetronome() {
    clearInterval(beatInterval);
}

function playBeat() {
    // El "lookahead" de la Web Audio API permite programar sonidos con precisión
    const time = audioContext.currentTime;
    const isFirstBeatOfBar = currentBeat % (timeSignature[0] * subdivision) === 0;

    playMetronomeTick(time, isFirstBeatOfBar);
    
    if (isFirstBeatOfBar) {
        barCount++;
        if (speedTrainerActive && barCount > 0 && barCount % speedTrainerBars === 0) {
            increaseSpeed();
        }
    }

    currentBeat++;
}

function increaseSpeed() {
    bpm += speedTrainerIncrease;
    if (bpm > 240) bpm = 240; // Límite superior
    document.getElementById('bpm-slider').value = bpm;
    updateBpmDisplay(bpm);
    stopMetronome();
    startMetronome();
}