// Este módulo controla todas las interacciones de la interfaz de usuario (UI).

function setupUIEventListeners() {
    // Navegación principal
    const navButtons = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');
    const cards = document.querySelectorAll('.card');

    function showPage(targetId) {
        pages.forEach(page => page.classList.toggle('active', page.id === targetId));
        navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => showPage(btn.dataset.target));
    });

    cards.forEach(card => {
        card.addEventListener('click', () => showPage(card.dataset.target));
    });

    // Tema claro/oscuro
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Cargar preferencia de tema
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggleBtn.textContent = '☀️';
    }

    // Modal de configuración
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.querySelector('.modal .close-btn');

    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'block');
    closeBtn.addEventListener('click', () => settingsModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
}

function updateBpmDisplay(bpm) {
    document.getElementById('bpm-display').textContent = bpm;
}

// Exportamos las funciones que otros módulos podrían necesitar
// En este caso, solo la configuración inicial.
// Si otros módulos necesitan interactuar con la UI, se añaden aquí.