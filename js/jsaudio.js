// Este módulo maneja toda la lógica de audio de la aplicación.
// Utiliza la Web Audio API para un control preciso del sonido.

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundSources = {};
let currentMetronomeSound = 'classic';
let currentNoteSound = 'piano';

async function loadSounds() {
    try {
        const metronomeClassicBuffer = await fetchSound('assets/audio/metronome-classic.wav');
        const metronomeWoodblockBuffer = await fetchSound('assets/audio/metronome-woodblock.wav');
        const notePianoBuffer = await fetchSound('assets/audio/note-piano.mp3');
        const noteGuitarBuffer = await fetchSound('assets/audio/note-guitar.mp3');

        soundSources = {
            metronome: {
                classic: metronomeClassicBuffer,
                woodblock: metronomeWoodblockBuffer
            },
            note: {
                piano: notePianoBuffer,
                guitar: noteGuitarBuffer
            }
        };
        console.log('Sonidos cargados correctamente.');
    } catch (error) {
        console.error('Error al cargar los sonidos:', error);
        alert('Hubo un problema al cargar los archivos de audio. Asegúrate de que estén en la carpeta assets/audio y que el servidor local esté funcionando si es necesario.');
    }
}

async function fetchSound(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`No se pudo cargar el sonido: ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

function playSound(buffer, time) {
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(time);
}

function playMetronomeTick(time, isAccent) {
    // Por ahora, usamos el mismo sonido. Podríamos diferenciarlo en el futuro.
    const soundBuffer = soundSources.metronome[currentMetronomeSound];
    playSound(soundBuffer, time);
}

function playNote(time) {
    const soundBuffer = soundSources.note[currentNoteSound];
    playSound(soundBuffer, time);
}

function setMetronomeSound(soundName) {
    if (soundSources.metronome[soundName]) {
        currentMetronomeSound = soundName;
        console.log(`Sonido de metrónomo cambiado a: ${soundName}`);
    }
}

function setNoteSound(soundName) {
    if (soundSources.note[soundName]) {
        currentNoteSound = soundName;
        console.log(`Sonido de notas cambiado a: ${soundName}`);
    }
}

// Cargar los sonidos cuando el script se carga por primera vez
loadSounds();