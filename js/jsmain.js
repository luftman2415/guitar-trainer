// Punto de entrada principal de la aplicación.
// Se asegura de que el DOM esté cargado antes de ejecutar el código.

document.addEventListener('DOMContentLoaded', () => {
    console.log('Guitar Worship Trainer listo.');

    // Inicializar todos los módulos
    setupUIEventListeners();
    setupMetronome();
    setupEarTrainer();
    setupMemory();
    setupSettings();
});

function setupSettings() {
    const metronomeSoundSelect = document.getElementById('metronome-sound-select');
    const noteSoundSelect = document.getElementById('note-sound-select');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const settingsModal = document.getElementById('settings-modal');

    // Cargar configuraciones guardadas
    const savedMetronomeSound = localStorage.getItem('metronomeSound') || 'classic';
    const savedNoteSound = localStorage.getItem('noteSound') || 'piano';

    metronomeSoundSelect.value = savedMetronomeSound;
    noteSoundSelect.value = savedNoteSound;
    setMetronomeSound(savedMetronomeSound);
    setNoteSound(savedNoteSound);

    // Guardar al hacer clic
    saveSettingsBtn.addEventListener('click', () => {
        const selectedMetronomeSound = metronomeSoundSelect.value;
        const selectedNoteSound = noteSoundSelect.value;

        // Actualizar en el módulo de audio
        setMetronomeSound(selectedMetronomeSound);
        setNoteSound(selectedNoteSound);

        // Guardar en localStorage
        localStorage.setItem('metronomeSound', selectedMetronomeSound);
        localStorage.setItem('noteSound', selectedNoteSound);

        alert('Configuración guardada.');
        settingsModal.style.display = 'none';
    });
}