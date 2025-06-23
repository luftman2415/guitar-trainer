// Lógica específica para el Entrenador de Oído

let currentEarTrainingMode = 'intervals';

function setupEarTrainer() {
    const tabs = document.querySelectorAll('#ear-training .tab-btn');
    const tabContents = document.querySelectorAll('#ear-training .tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;
            
            // Actualizar pestañas y contenido
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === targetId);
            });
            
            // Cambiar el modo y actualizar los controles
            currentEarTrainingMode = targetId;
            updateEarTrainerControls();
        });
    });

    // Iniciar con los controles del primer tab
    updateEarTrainerControls();
}

function updateEarTrainerControls() {
    const controlsContainer = document.getElementById('ear-training-controls');
    controlsContainer.innerHTML = ''; // Limpiar controles existentes

    let buttons = [];

    switch(currentEarTrainingMode) {
        case 'intervals':
            buttons = [
                { text: 'Nuevo Intervalo', action: () => console.log('Nuevo Intervalo') },
                { text: 'Repetir', action: () => console.log('Repetir Intervalo') }
            ];
            break;
        case 'chords':
            buttons = [
                { text: 'Nuevo Acorde', action: () => console.log('Nuevo Acorde') },
                { text: 'Repetir', action: () => console.log('Repetir Acorde') }
            ];
            break;
        case 'progressions':
            buttons = [
                { text: 'Nueva Progresión', action: () => console.log('Nueva Progresión') },
                { text: 'Repetir', action: () => console.log('Repetir Progresión') }
            ];
            break;
    }

    buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.textContent = btnInfo.text;
        button.addEventListener('click', btnInfo.action);
        controlsContainer.appendChild(button);
    });
}