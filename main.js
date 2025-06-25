// =================================================================================
// ESTRUCTURA DE DATOS Y GESTOR PRINCIPAL
// =================================================================================
class GuitarWorshipTrainer {
    constructor() {
        this.defaultData = {
            songs: [{ id: 'song_example_1', title: 'Sublime Gracia', artist: 'John Newton', defaultKey: 'G', defaultBpm: 65, lyrics: '[Verse 1]\nG              C       G\nSublime gracia del Señor\n                 D\nQue a un infeliz salvó' }],
            setlists: [], recordings: [],
            settings: {
                theme: 'light', tourCompleted: false,
                metronome: { sound: 'square', accent: true, bpm: 120, timeSignature: '4/4', subdivision: '1' },
                tuner: { a4: 440 }
            }
        };
        this.appData = {};
        this.currentSection = 'inicio';
        this.loadData();

        this.themeManager = new ThemeManager(this);
        this.onboardingGuide = new OnboardingGuide(this);
        this.tuner = new Tuner(this);
        this.metronome = new Metronome(this);
        this.songManager = new SongManager(this);
        this.setlistManager = new SetlistManager(this);
        this.analyzer = new ProgressionAnalyzer(this);
        this.scaleVisualizer = new ScaleVisualizer(this);
        this.recorder = new IdeaRecorder(this);
        
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupNavigation();
            this.setupCardNavigation();
            this.setupConfirmationModal();
            this.setupGlobalSearch();
            this.themeManager.loadSavedTheme();
            this.songManager.renderSongList();
            this.setlistManager.renderSetlistList();
            this.recorder.renderRecordings();
            document.getElementById('copyright-year').textContent = new Date().getFullYear();
            this.showSection(this.currentSection);
            this.onboardingGuide.startTourIfNeeded();
        });
    }

    saveData() { localStorage.setItem('guitarWorshipTrainerData', JSON.stringify(this.appData)); }
    
    loadData() {
        const savedData = JSON.parse(localStorage.getItem('guitarWorshipTrainerData'));
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] instanceof Object && key in target && !Array.isArray(source[key])) {
                    Object.assign(source[key], deepMerge(target[key], source[key]));
                }
            }
            return Object.assign(target || {}, source);
        };
        this.appData = deepMerge(this.defaultData, savedData || {});
        if (!savedData) { this.saveData(); }
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => this.showSection(btn.dataset.section)));
    }
    setupCardNavigation() {
        document.querySelectorAll('.card').forEach(card => card.addEventListener('click', () => this.showSection(card.dataset.section)));
    }

    showSection(sectionId, isFromTour = false) {
        this.currentSection = sectionId;
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === sectionId));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === sectionId));
        
        const searchInput = document.getElementById('globalSearchInput');
        const shouldShowSearch = ['songs', 'setlists'].includes(sectionId);
        searchInput.style.display = shouldShowSearch ? 'inline-flex' : 'none';
        if (!shouldShowSearch) searchInput.value = '';
        this.filterGlobalSearch();

        if (!isFromTour) {
            if (sectionId !== 'metronome' && this.metronome.isPlaying) { this.metronome.stop(); }
            if (sectionId !== 'tuner' && this.tuner.isTunerOn) { this.tuner.stop(); }
        }

        if (sectionId === 'scales') { this.scaleVisualizer.render(); }
        if (sectionId === 'songs') { this.songManager.renderSongList(); }
        if (sectionId === 'setlists') { this.setlistManager.renderSetlistList(); }
    }
    
    setupGlobalSearch() {
        this.searchInput = document.getElementById('globalSearchInput');
        this.searchInput.addEventListener('input', () => this.filterGlobalSearch());
    }

    filterGlobalSearch() {
        const query = this.searchInput.value.toLowerCase().trim();
        let itemSelector;

        if (this.currentSection === 'songs') itemSelector = '#songListContainer .item-card';
        else if (this.currentSection === 'setlists') itemSelector = '#setlistListContainer .item-card-large';
        else return;

        document.querySelectorAll(itemSelector).forEach(item => {
            const textContent = item.textContent.toLowerCase();
            item.classList.toggle('hidden', !textContent.includes(query));
        });
    }

    openModal() { document.body.classList.add('modal-open'); }
    closeModal() { document.body.classList.remove('modal-open'); }

    setupConfirmationModal() {
        this.confirmModal = { overlay: document.getElementById('confirmModalOverlay'), message: document.getElementById('confirmModalMessage'), confirmBtn: document.getElementById('confirmModalConfirm'), cancelBtn: document.getElementById('confirmModalCancel') };
        this.confirmModal.overlay.addEventListener('click', e => { if (e.target === this.confirmModal.overlay) this.hideConfirmation(); });
        this.confirmModal.cancelBtn.addEventListener('click', () => this.hideConfirmation());
    }
    showConfirmation(message, onConfirm) {
        this.confirmModal.message.textContent = message;
        this.confirmModal.confirmBtn.replaceWith(this.confirmModal.confirmBtn.cloneNode(true));
        this.confirmModal.confirmBtn = document.getElementById('confirmModalConfirm');
        this.confirmModal.confirmBtn.addEventListener('click', () => { onConfirm(); this.hideConfirmation(); }, { once: true });
        this.confirmModal.overlay.style.display = 'flex'; this.openModal();
    }
    hideConfirmation() { this.confirmModal.overlay.style.display = 'none'; this.closeModal(); }
    findSongById(id) { return this.appData.songs.find(song => song.id === id); }
}

// =================================================================================
// ONBOARDING GUIDE
// =================================================================================
class OnboardingGuide {
    constructor(app) {
        this.app = app;
        document.getElementById('restartTourBtn').addEventListener('click', () => this.startTour(true));
    }
    startTourIfNeeded() {
        if (!this.app.appData.settings.tourCompleted) {
            this.startTour();
        }
    }
    startTour(force = false) {
        const driver = window.driver.driver;
        this.app.showSection('inicio', true);

        driver({
            showProgress: true,
            steps: [
                { element: '#tour-step-0', popover: { title: '¡Bienvenido!', description: 'Esta es tu navaja suiza para la música de adoración.' } },
                { element: '#tour-step-1', popover: { title: 'Navegación Principal', description: 'Usa estos botones para cambiar entre las diferentes herramientas.' } },
                {
                    element: '[data-section="setlists"]', popover: { title: 'Gestor de Setlists', description: 'Vamos a ver cómo organizar tus canciones para un evento.' },
                    onNextClick: () => { this.app.showSection('setlists', true); driver.moveNext(); }
                },
                {
                    element: '#setlistListContainer', popover: { title: 'Tus Setlists', description: 'Aquí aparecerán tus listas. Puedes añadir canciones, reordenarlas arrastrando y exportar a PDF.' },
                    onNextClick: () => { this.app.showSection('scales', true); driver.moveNext(); }
                },
                { element: '#tour-step-4', popover: { title: 'Visualizador de Escalas', description: 'Elige una tónica y un tipo de escala para verla en el diapasón.' } },
                { element: '#tour-step-5', popover: { title: 'Modos de Visualización', description: 'No solo veas la escala, ¡analízala! Filtra para ver solo las tríadas o arpegios.' } },
                { element: '#tour-step-6', popover: { title: 'Personaliza tu Look', description: 'Elige el tema que más te guste. ¡Hay para todos los gustos!' } },
                { popover: { title: '¡Todo Listo!', description: 'Ya estás listo para empezar. ¡Explora y lleva tu música al siguiente nivel!' } }
            ],
            onClose: () => {
                if (!this.app.appData.settings.tourCompleted) {
                    this.app.appData.settings.tourCompleted = true;
                    this.app.saveData();
                }
                this.app.showSection('inicio');
            }
        }).drive();
    }
}

// =================================================================================
// THEME MANAGER
// =================================================================================
class ThemeManager {
    constructor(app) { this.app = app; this.setup(); }
    setup() { document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', () => this.setTheme(btn.dataset.theme))); }
    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.app.appData.settings.theme = theme; this.app.saveData();
    }
    loadSavedTheme() { this.setTheme(this.app.appData.settings.theme || 'light'); }
}

// =================================================================================
// METRONOME (CORRECCIÓN FINAL)
// =================================================================================
class Metronome {
    constructor(app) {
        this.app = app; this.audioContext = null; this.isPlaying = false;
        this.beat = 0; this.metronomeInterval = null; this.tapTimestamps = [];
        this.dom = {
            bpmDisplay: document.getElementById('bpmDisplay'), bpmSlider: document.getElementById('bpmSlider'),
            playBtn: document.getElementById('playBtn'), tapTempoBtn: document.getElementById('tapTempoBtn'),
            soundSelect: document.getElementById('soundSelect'), accentToggle: document.getElementById('accentToggle'),
            timeSigSelect: document.getElementById('timeSignature'), subDivSelect: document.getElementById('subdivision'),
            visualIndicator: document.getElementById('visualIndicator')
        };
        this.setupControls(); this.loadSettings();
    }
    initAudio() {
        if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
    }
    createClick(level) {
        if (!this.audioContext) return;
        const time = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain); gain.connect(this.audioContext.destination);
        osc.type = this.app.appData.settings.metronome.sound;
        const freq = [880, 440, 300][level];
        const gainVal = [0.4, 0.3, 0.15][level];
        const duration = 0.05;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(gainVal, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.start(time); osc.stop(time + duration);
    }
    setupControls() {
        this.dom.playBtn.addEventListener('click', () => this.togglePlay());
        this.dom.tapTempoBtn.addEventListener('click', () => this.handleTap());

        const restartIfPlaying = () => {
            if (this.isPlaying) {
                this.stop();
                this.start();
            }
        };

        this.dom.bpmSlider.addEventListener('input', e => {
            this.app.appData.settings.metronome.bpm = parseInt(e.target.value);
            this.dom.bpmDisplay.textContent = e.target.value;
            this.app.saveData();
            restartIfPlaying();
        });

        ['soundSelect', 'accentToggle', 'timeSigSelect', 'subDivSelect'].forEach(key => {
            const el = this.dom[key];
            el.addEventListener('change', () => {
                const prop = key.replace('Select', '').replace('Toggle', '');
                this.app.appData.settings.metronome[prop] = (el.type === 'checkbox') ? el.checked : el.value;
                this.app.saveData();
                restartIfPlaying();
            });
        });
    }
    loadSettings() {
        const s = this.app.appData.settings.metronome;
        this.dom.bpmDisplay.textContent = s.bpm;
        this.dom.bpmSlider.value = s.bpm;
        this.dom.soundSelect.value = s.sound; 
        this.dom.accentToggle.checked = s.accent;
        this.dom.timeSigSelect.value = s.timeSignature; 
        this.dom.subDivSelect.value = s.subdivision;
    }
    setBpm(newBpm) {
        this.app.appData.settings.metronome.bpm = newBpm;
        this.loadSettings();
        if (this.isPlaying) { this.stop(); this.start(); }
        this.app.saveData();
    }
    togglePlay() { this.isPlaying ? this.stop() : this.start(); }
    start() {
        this.initAudio(); this.isPlaying = true; this.beat = 0;
        this.dom.playBtn.innerHTML = '⏸️ Pausar';
        const settings = this.app.appData.settings.metronome;
        const timeSignature = settings.timeSignature;
        const beatsPerMeasure = timeSignature === '6/8' ? 6 : parseInt(timeSignature.split('/')[0]);
        const subdivision = parseInt(settings.subdivision);
        const intervalMs = (60 / settings.bpm / subdivision) * 1000;
        
        this.metronomeInterval = setInterval(() => {
            const mainBeatIndex = Math.floor(this.beat / subdivision);
            const subBeatIndex = this.beat % subdivision;
            let clickLevel = 2;
            if (subBeatIndex === 0) { clickLevel = (mainBeatIndex === 0 && settings.accent) ? 0 : 1; }
            this.createClick(clickLevel);
            if (clickLevel < 2) {
                this.dom.visualIndicator.classList.add('beat');
                setTimeout(() => this.dom.visualIndicator.classList.remove('beat'), 100);
            }
            this.beat = (this.beat + 1) % (beatsPerMeasure * subdivision);
        }, intervalMs);
    }
    stop() {
        this.isPlaying = false;
        this.dom.playBtn.innerHTML = '▶️ Iniciar';
        clearInterval(this.metronomeInterval);
        this.metronomeInterval = null;
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
                this.dom.bpmDisplay.classList.add('bpm-flash');
                setTimeout(() => this.dom.bpmDisplay.classList.remove('bpm-flash'), 500);
            }
        }
        setTimeout(() => { if (this.tapTimestamps.length > 0 && Date.now() - this.tapTimestamps[this.tapTimestamps.length - 1] > 2000) this.tapTimestamps = []; }, 2100);
    }
}

// =================================================================================
// CHROMATIC TUNER
// =================================================================================
class Tuner { /* ...código sin cambios... */ constructor(app){this.app=app;this.isTunerOn=!1;this.audioContext=null;this.analyser=null;this.source=null;this.animationFrameId=null;this.noteStrings="C C# D D# E F F# G G# A A# B".split(" ");this.dom={note:document.getElementById("tunerNote"),sharp:document.getElementById("tunerSharp"),flat:document.getElementById("tunerFlat"),needle:document.getElementById("tunerNeedle"),cents:document.getElementById("centsDisplay"),startBtn:document.getElementById("tunerStartBtn"),status:document.getElementById("tunerStatus")};this.dom.startBtn.addEventListener("click",()=>this.toggleTuner())}toggleTuner(){this.isTunerOn?this.stop():this.start()}start(){navigator.mediaDevices.getUserMedia({audio:!0}).then(stream=>{this.isTunerOn=!0;this.dom.startBtn.textContent="Desactivar Afinador";this.dom.status.style.display="none";this.audioContext=new(window.AudioContext||window.webkitAudioContext);this.source=this.audioContext.createMediaStreamSource(stream);this.analyser=this.audioContext.createAnalyser();this.analyser.fftSize=2048;this.source.connect(this.analyser);this.updatePitch()}).catch(()=>{this.dom.status.textContent="Error: Permiso para micrófono denegado."})}stop(){this.isTunerOn=!1;this.source&&this.source.mediaStream.getTracks().forEach(track=>track.stop());this.audioContext&&this.audioContext.close();this.animationFrameId&&cancelAnimationFrame(this.animationFrameId);this.dom.startBtn.textContent="Activar Afinador";this.resetUI()}updatePitch(){const buffer=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(buffer);const pitch=this.autoCorrelate(buffer,this.audioContext.sampleRate);pitch!==-1&&this.updateUI(this.noteFromPitch(pitch));this.isTunerOn&&(this.animationFrameId=requestAnimationFrame(()=>this.updatePitch()))}updateUI({noteName:noteName,detune:detune}){this.dom.note.textContent=noteName.charAt(0);this.dom.sharp.style.opacity=noteName.includes("♯")?1:0;this.dom.flat.style.opacity=noteName.includes("♭")?1:0;this.dom.cents.textContent=`${detune.toFixed(0)} cents`;const rotation=Math.max(-90,Math.min(90,detune*1.8));this.dom.needle.style.transform=`rotate(${rotation}deg)`;this.dom.needle.style.backgroundColor=Math.abs(detune)<5?"var(--success-color)":"var(--text-primary)"}resetUI(){this.dom.note.textContent="--";this.dom.sharp.style.opacity=0;this.dom.flat.style.opacity=0;this.dom.cents.textContent="- cents";this.dom.needle.style.transform="rotate(0deg)"}noteFromPitch(frequency){const noteNum=12*(Math.log(frequency/this.app.appData.settings.tuner.a4)/Math.log(2)),roundedNote=Math.round(noteNum)+69,noteName=this.noteStrings[roundedNote%12],expectedFrequency=this.app.appData.settings.tuner.a4*Math.pow(2,(roundedNote-69)/12),detune=1200*Math.log2(frequency/expectedFrequency);return{noteName:noteName,detune:detune}}autoCorrelate(buf,sampleRate){let size=buf.length,rms=0;for(let i=0;i<size;i++)rms+=buf[i]*buf[i];if(rms=Math.sqrt(rms/size),rms<.01)return-1;let r1=0,r2=size-1,thres=.2;for(let i=0;i<size/2;i++)if(Math.abs(buf[i])<thres){r1=i;break}for(let i=1;i<size/2;i++)if(Math.abs(buf[size-i])<thres){r2=size-i;break}buf=buf.slice(r1,r2),size=buf.length;let c=new Float32Array(size).fill(0);for(let i=0;i<size;i++)for(let j=0;j<size-i;j++)c[i]=c[i]+buf[j]*buf[j+i];let d=0;for(;c[d]>c[d+1];)d++;let maxval=-1,maxpos=-1;for(let i=d;i<size;i++)c[i]>maxval&&(maxval=c[i],maxpos=i);let T0=maxpos,x1=c[T0-1],x2=c[T0],x3=c[T0+1],a=(x1+x3-2*x2)/2,b=(x3-x1)/2;return a&&(T0=T0-b/(2*a)),sampleRate/T0}}

// =================================================================================
// SONG MANAGER
// =================================================================================
class SongManager { /* ...código sin cambios... */ constructor(app){this.app=app;this.setupModal()}setupModal(){this.modalOverlay=document.getElementById("songModalOverlay");this.modalForm=document.getElementById("songForm");this.closeBtn=document.getElementById("closeSongModalBtn");this.cancelBtn=document.getElementById("cancelSongModalBtn");this.editingSongId=null;document.getElementById("addSongBtn").addEventListener("click",()=>this.showSongModal());this.closeBtn.addEventListener("click",()=>this.closeSongModal());this.cancelBtn.addEventListener("click",()=>this.closeSongModal());this.modalOverlay.addEventListener("click",e=>{e.target===this.modalOverlay&&this.closeSongModal()});this.modalForm.addEventListener("submit",e=>this.handleFormSubmit(e))}showSongModal(songId=null){this.app.openModal();this.editingSongId=songId;if(songId){const song=this.app.findSongById(songId);song&&(document.getElementById("songModalTitle").textContent="Editar Canción",document.getElementById("songTitleInput").value=song.title,document.getElementById("songArtistInput").value=song.artist||"",document.getElementById("songDefaultKeyInput").value=song.defaultKey,document.getElementById("songDefaultBpmInput").value=song.defaultBpm||"",document.getElementById("songLyricsInput").value=song.lyrics)}else document.getElementById("songModalTitle").textContent="Nueva Canción",this.modalForm.reset();this.modalOverlay.style.display="flex"}closeSongModal(){this.modalOverlay.style.display="none";this.editingSongId=null;this.app.closeModal()}handleFormSubmit(e){e.preventDefault();const formData=new FormData(this.modalForm),songData={id:this.editingSongId||`song_${Date.now()}`,title:formData.get("title"),artist:formData.get("artist"),defaultKey:formData.get("defaultKey"),defaultBpm:parseInt(formData.get("defaultBpm"))||null,lyrics:formData.get("lyrics")};this.editingSongId?this.app.appData.songs[this.app.appData.songs.findIndex(s=>s.id===this.editingSongId)]=songData:this.app.appData.songs.push(songData);this.app.saveData();this.renderSongList();this.closeSongModal()}renderSongList(){const container=document.getElementById("songListContainer");if(container.innerHTML="",this.app.appData.songs.length===0)return void(container.innerHTML='<div class="empty-state"><h3>No tienes canciones en tu repertorio.</h3><p>¡Añade tu primera canción para empezar!</p></div>');this.app.appData.songs.forEach(song=>{const songCard=document.createElement("div");songCard.className="item-card";songCard.innerHTML=`
                <div class="item-card-main">
                    <h3>${song.title}</h3>
                    <p>${song.artist||"Artista desconocido"} • Tono: ${song.defaultKey} • BPM: ${song.defaultBpm||"N/A"}</p>
                </div>
                <div class="item-card-actions">
                    <button class="button small-btn edit-song" data-id="${song.id}">✏️ Editar</button>
                    <button class="button small-btn-danger delete-song" data-id="${song.id}">🗑️ Borrar</button>
                </div>`;container.appendChild(songCard)});container.querySelectorAll(".edit-song").forEach(btn=>btn.addEventListener("click",e=>this.showSongModal(e.target.dataset.id)));container.querySelectorAll(".delete-song").forEach(btn=>btn.addEventListener("click",e=>this.deleteSong(e.target.dataset.id)));this.app.filterGlobalSearch()}deleteSong(songId){const song=this.app.findSongById(songId);this.app.showConfirmation(`¿Estás seguro de que quieres eliminar "${song.title}"? También se eliminará de todos los setlists.`,()=>{this.app.appData.songs=this.app.appData.songs.filter(s=>s.id!==songId);this.app.appData.setlists.forEach(setlist=>{setlist.items=setlist.items.filter(item=>item.songId!==songId)});this.app.saveData();this.renderSongList();this.app.setlistManager.renderSetlistList()})}}

// =================================================================================
// SETLIST MANAGER (con Drag&Drop y PDF)
// =================================================================================
class SetlistManager { /* ...código sin cambios... */ constructor(app){this.app=app;this.currentSetlistId=null;this.currentSetlistItemIndex=0;this.setupSetlistModal();this.setupAddSongToSetlistModal();this.setupPerformanceMode()}setupSetlistModal(){this.modalOverlay=document.getElementById("setlistModalOverlay");this.form=document.getElementById("setlistForm");this.closeBtn=document.getElementById("closeSetlistModalBtn");this.cancelBtn=document.getElementById("cancelSetlistModalBtn");this.editingSetlistId=null;document.getElementById("createSetlistBtn").addEventListener("click",()=>this.showSetlistModal());this.closeBtn.addEventListener("click",()=>this.closeSetlistModal());this.cancelBtn.addEventListener("click",()=>this.closeSetlistModal());this.modalOverlay.addEventListener("click",e=>{e.target===this.modalOverlay&&this.closeSetlistModal()});this.form.addEventListener("submit",e=>this.handleSetlistFormSubmit(e))}showSetlistModal(setlistId=null){this.editingSetlistId=setlistId;if(setlistId){const setlist=this.app.appData.setlists.find(s=>s.id===setlistId);document.getElementById("setlistModalTitle").textContent="Editar Setlist";document.getElementById("setlistNameInput").value=setlist.name}else document.getElementById("setlistModalTitle").textContent="Crear Setlist",this.form.reset();this.modalOverlay.style.display="flex";this.app.openModal()}closeSetlistModal(){this.modalOverlay.style.display="none";this.app.closeModal()}handleSetlistFormSubmit(e){e.preventDefault();const name=document.getElementById("setlistNameInput").value;this.editingSetlistId?this.app.appData.setlists.find(s=>s.id===this.editingSetlistId).name=name:this.app.appData.setlists.push({id:`setlist_${Date.now()}`,name:name,items:[]});this.app.saveData();this.renderSetlistList();this.closeSetlistModal()}setupAddSongToSetlistModal(){this.addSongModalOverlay=document.getElementById("addSongToSetlistModalOverlay");this.addSongForm=document.getElementById("addSongToSetlistForm");this.addSongCloseBtn=document.getElementById("closeAddSongToSetlistModalBtn");this.setlistToAddSongTo=null;this.addSongCloseBtn.addEventListener("click",()=>this.closeAddSongModal());this.addSongModalOverlay.addEventListener("click",e=>{e.target===this.addSongModalOverlay&&this.closeAddSongModal()});document.getElementById("songSelectForSetlist").addEventListener("change",e=>{const song=this.app.findSongById(e.target.value);song&&(document.getElementById("setlistItemKey").value=song.defaultKey,document.getElementById("setlistItemBpm").value=song.defaultBpm)});this.addSongForm.addEventListener("submit",e=>{e.preventDefault();const setlistItem={songId:document.getElementById("songSelectForSetlist").value,key:document.getElementById("setlistItemKey").value,bpm:parseInt(document.getElementById("setlistItemBpm").value),notes:document.getElementById("setlistItemNotes").value};this.app.appData.setlists.find(s=>s.id===this.setlistToAddSongTo).items.push(setlistItem);this.app.saveData();this.renderSetlistList();this.closeAddSongModal()})}showAddSongModal(setlistId){this.setlistToAddSongTo=setlistId;const songSelect=document.getElementById("songSelectForSetlist");if(songSelect.innerHTML='<option value="">-- Elige una canción --</option>',this.app.appData.songs.length===0)return void this.app.showConfirmation("Primero debes añadir canciones a tu repertorio.",()=>this.app.showSection("songs"));this.app.appData.songs.forEach(song=>songSelect.add(new Option(song.title,song.id)));this.addSongForm.reset();this.addSongModalOverlay.style.display="flex";this.app.openModal()}closeAddSongModal(){this.addSongModalOverlay.style.display="none";this.app.closeModal()}renderSetlistList(){const container=document.getElementById("setlistListContainer");if(container.innerHTML="",this.app.appData.setlists.length===0)return void(container.innerHTML='<div class="empty-state"><h3>No has creado ningún setlist.</h3><p>Crea uno para organizar tu próximo servicio o ensayo.</p></div>');this.app.appData.setlists.forEach(setlist=>{const setlistCard=document.createElement("div");setlistCard.className="item-card-large";setlistCard.dataset.setlistId=setlist.id;let itemsHtml=setlist.items.map((item,index)=>{const song=this.app.findSongById(item.songId);return song?`<li data-setlist-id="${setlist.id}" data-index="${index}"><span>${index+1}. ${song.title} (${item.key}, ${item.bpm} BPM)</span><button class="delete-item-btn" title="Quitar">×</button></li>`:""}).join("");setlistCard.innerHTML=`
                <div class="item-card-header">
                    <h3>${setlist.name}</h3>
                    <div class="item-card-actions">
                        <button class="button small-btn export-pdf" data-id="${setlist.id}">📄 PDF</button>
                        <button class="button small-btn-secondary add-song-to-setlist" data-id="${setlist.id}">+ Añadir</button>
                        <button class="button small-btn edit-setlist" data-id="${setlist.id}">✏️ Editar</button>
                        <button class="button small-btn-danger delete-setlist" data-id="${setlist.id}">🗑️ Borrar</button>
                    </div>
                </div>
                <ul class="setlist-items" data-setlist-id="${setlist.id}">${itemsHtml||'<p class="empty-setlist-msg">Setlist vacío.</p>'}</ul>
                <button class="button btn-primary start-performance" data-id="${setlist.id}" ${setlist.items.length===0?"disabled":""}>▶️ Performance</button>`;container.appendChild(setlistCard)});container.querySelectorAll(".add-song-to-setlist").forEach(btn=>btn.addEventListener("click",e=>this.showAddSongModal(e.currentTarget.dataset.id)));container.querySelectorAll(".edit-setlist").forEach(btn=>btn.addEventListener("click",e=>this.showSetlistModal(e.currentTarget.dataset.id)));container.querySelectorAll(".delete-setlist").forEach(btn=>btn.addEventListener("click",e=>this.deleteSetlist(e.currentTarget.dataset.id)));container.querySelectorAll(".start-performance").forEach(btn=>btn.addEventListener("click",e=>this.startPerformanceMode(e.currentTarget.dataset.id)));container.querySelectorAll(".export-pdf").forEach(btn=>btn.addEventListener("click",e=>this.exportSetlistToPDF(e.currentTarget.dataset.id)));container.querySelectorAll(".setlist-items li .delete-item-btn").forEach(btn=>btn.addEventListener("click",e=>{const itemEl=e.currentTarget.parentElement;this.removeSongFromSetlist(itemEl.dataset.setlistId,parseInt(itemEl.dataset.index))}));document.querySelectorAll(".setlist-items").forEach(list=>{Sortable.create(list,{animation:150,ghostClass:"sortable-ghost",onEnd:evt=>{const setlistId=evt.target.dataset.setlistId,setlist=this.app.appData.setlists.find(s=>s.id===setlistId),[movedItem]=setlist.items.splice(evt.oldIndex,1);setlist.items.splice(evt.newIndex,0,movedItem);this.app.saveData();this.renderSetlistList()}})});this.app.filterGlobalSearch()}exportSetlistToPDF(setlistId){const setlist=this.app.appData.setlists.find(s=>s.id===setlistId);if(!setlist)return;let content=`
            <div style="font-family: sans-serif; padding: 40px; color: #2c3e50;">
                <h1 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 10px;">${setlist.name}</h1>
                <h3 style="color: #6c757d; margin-top: 0;">${new Date().toLocaleDateString()}</h3>`;setlist.items.length>0?(content+='<ul style="list-style: none; padding: 0;">',setlist.items.forEach((item,index)=>{const song=this.app.findSongById(item.songId);content+=`
                    <li style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <h2 style="margin: 0 0 10px 0;">${index+1}. ${song.title}</h2>
                        <p style="margin: 5px 0;"><strong>Artista:</strong> ${song.artist||"N/A"}</p>
                        <p style="margin: 5px 0;"><strong>Tonalidad:</strong> ${item.key}</p>
                        <p style="margin: 5px 0;"><strong>BPM:</strong> ${item.bpm}</p>
                        ${item.notes?`<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;"><p><strong>Notas:</strong></p><p style="white-space: pre-wrap;">${item.notes}</p></div>`:""}
                    </li>`}),content+="</ul>"):content+="\n<p>Este setlist está vacío.</p>";content+="\n</div>";const opt={margin:1,filename:`${setlist.name}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2},jsPDF:{unit:"in",format:"letter",orientation:"portrait"}};html2pdf().from(content).set(opt).save()}deleteSetlist(setlistId){this.app.showConfirmation("¿Seguro que quieres eliminar este setlist?",()=>{this.app.appData.setlists=this.app.appData.setlists.filter(s=>s.id!==setlistId);this.app.saveData();this.renderSetlistList()})}removeSongFromSetlist(setlistId,itemIndex){const setlist=this.app.appData.setlists.find(s=>s.id===setlistId);setlist&&(setlist.items.splice(itemIndex,1),this.app.saveData(),this.renderSetlistList())}setupPerformanceMode(){this.perfModeEl=document.getElementById("performance-mode");document.getElementById("exit-performance-btn").addEventListener("click",()=>this.exitPerformanceMode());document.getElementById("perf-next-btn").addEventListener("click",()=>this.navigateToSong(1));document.getElementById("perf-prev-btn").addEventListener("click",()=>this.navigateToSong(-1))}startPerformanceMode(setlistId){const setlist=this.app.appData.setlists.find(s=>s.id===setlistId);setlist&&setlist.items.length!==0&&(this.currentSetlistId=setlistId,this.currentSetlistItemIndex=0,this.perfModeEl.classList.remove("hidden"),document.body.style.overflow="hidden",this.loadSongInPerformance(this.currentSetlistItemIndex))}exitPerformanceMode(){this.perfModeEl.classList.add("hidden");document.body.style.overflow="auto";this.app.metronome.isPlaying&&this.app.metronome.stop()}navigateToSong(direction){const setlist=this.app.appData.setlists.find(s=>s.id===this.currentSetlistId),newIndex=this.currentSetlistItemIndex+direction;newIndex>=0&&newIndex<setlist.items.length&&(this.currentSetlistItemIndex=newIndex,this.loadSongInPerformance(newIndex))}loadSongInPerformance(index){const setlist=this.app.appData.setlists.find(s=>s.id===this.currentSetlistId),setlistItem=setlist.items[index],song=this.app.findSongById(setlistItem.songId);document.getElementById("perf-song-title").textContent=song.title;document.getElementById("perf-key").textContent=setlistItem.key;document.getElementById("perf-bpm").textContent=setlistItem.bpm;document.getElementById("perf-notes").textContent=setlistItem.notes||"No hay notas para esta canción.";this.app.metronome.setBpm(setlistItem.bpm);document.getElementById("perf-prev-btn").disabled=index===0;document.getElementById("perf-next-btn").disabled=index===setlist.items.length-1}}

// =================================================================================
// PROGRESSION ANALYZER
// =================================================================================
class ProgressionAnalyzer { /* ...código sin cambios... */ constructor(app){this.app=app;this.notes="C C# D D# E F F# G G# A A# B".split(" ");this.majorScaleIntervals=[0,2,4,5,7,9,11];this.majorScaleDegrees=[{roman:"I",type:"major"},{roman:"ii",type:"minor"},{roman:"iii",type:"minor"},{roman:"IV",type:"major"},{roman:"V",type:"major"},{roman:"vi",type:"minor"},{roman:"vii°",type:"diminished"}];document.getElementById("analyzeProgressionBtn").addEventListener("click",()=>this.analyze())}parseChord(str){const match=str.trim().match(/^([A-G][#b]?)(.*)/);if(!match)return null;let root=match[1].replace("b","#"),quality="major";return match[2].includes("m")&&!match[2].includes("maj")&&(quality="minor"),(match[2].includes("dim")||match[2].includes("°"))&&(quality="diminished"),{root:root,type:quality,original:str.trim()}}getScaleNotes(rootNote){const rootIndex=this.notes.indexOf(rootNote);return this.majorScaleIntervals.map(i=>this.notes[(rootIndex+i)%12])}analyze(){const resultDiv=document.getElementById("progressionResult"),chords=document.getElementById("progressionInput").value.split(/[\s,|]+/).filter(c=>c).map(c=>this.parseChord(c)).filter(Boolean);if(chords.length===0)return void(resultDiv.innerHTML="<p>Por favor, introduce una progresión válida.</p>");let bestKey={key:null,score:-1};this.notes.forEach(keyNote=>{const scaleNotes=this.getScaleNotes(keyNote),harmonicField=this.majorScaleDegrees.map((d,i)=>({...d,root:scaleNotes[i]}));let score=0;chords.forEach(chord=>{harmonicField.some(fc=>fc.root===chord.root&&fc.type===chord.type)&&score++});score>bestKey.score&&(bestKey={key:keyNote,score:score})});if(bestKey.key&&bestKey.score>0){const key=bestKey.key,romanNumerals=chords.map(chord=>{const scaleNotes=this.getScaleNotes(key),hf=this.majorScaleDegrees.map((d,i)=>({...d,root:scaleNotes[i]})),fc=hf.find(f=>f.root===chord.root&&f.type===chord.type);return fc?`<span class="roman-numeral-pill">${fc.roman}</span>`:`<span class="roman-numeral-pill error">?</span>`}).join("");resultDiv.innerHTML=`
                <div class="analysis-item"><span class="analysis-label">Tonalidad:</span> <span class="roman-numeral-pill main-key">${key} Mayor</span></div>
                <div class="analysis-item"><span class="analysis-label">Grados:</span> <div class="roman-numeral-progression">${romanNumerals}</div></div>
                <div class="analysis-item"><span class="analysis-label">Escalas:</span> <ul><li>${key} Mayor</li><li>${this.getScaleNotes(key)[5]} Pentatónica menor</li></ul></div>`}else resultDiv.innerHTML="<p>No se pudo determinar una tonalidad clara.</p>"}}

// =================================================================================
// RECORDER
// =================================================================================
class IdeaRecorder { /* ...código sin cambios... */ constructor(app){this.app=app;this.recBtn=document.getElementById("recBtn");this.recTime=document.getElementById("recTime");this.recList=document.getElementById("recList");this.recStatus=document.getElementById("recStatus");this.mediaRecorder=null;this.isRecording=!1;this.chunks=[];this.timerInterval=null;this.startTime=0;this.setupEvents()}setupEvents(){this.recBtn.addEventListener("click",()=>this.toggleRecording())}async toggleRecording(){this.isRecording?this.stopRecording():await this.startRecording()}async startRecording(){try{const stream=await navigator.mediaDevices.getUserMedia({audio:!0});this.mediaRecorder=new MediaRecorder(stream);this.mediaRecorder.ondataavailable=e=>this.chunks.push(e.data);this.mediaRecorder.onstop=()=>this.saveRecording();this.chunks=[];this.mediaRecorder.start();this.isRecording=!0;this.recBtn.textContent="■ Detener";this.recBtn.classList.add("recording");this.recStatus.textContent="Grabando...";this.startTimer()}catch(err){this.recStatus.textContent="Error: No se pudo acceder al micrófono."}}stopRecording(){this.mediaRecorder&&this.isRecording&&(this.mediaRecorder.stop(),this.mediaRecorder.stream.getTracks().forEach(track=>track.stop()),this.isRecording=!1,this.recBtn.textContent="● Grabar",this.recBtn.classList.remove("recording"),this.recStatus.textContent="Procesando...",this.stopTimer())}startTimer(){this.startTime=Date.now();this.timerInterval=setInterval(()=>{const elapsed=Math.floor((Date.now()-this.startTime)/1e3),m=String(Math.floor(elapsed/60)).padStart(2,"0"),s=String(elapsed%60).padStart(2,"0");this.recTime.textContent=`${m}:${s}`},1e3)}stopTimer(){clearInterval(this.timerInterval);this.recTime.textContent="00:00"}saveRecording(){const blob=new Blob(this.chunks,{type:"audio/webm"}),reader=new FileReader;reader.onloadend=()=>{const rec={id:`rec_${Date.now()}`,name:`Grabación ${new Date().toLocaleString()}`,dataUrl:reader.result};this.app.appData.recordings.unshift(rec);this.app.saveData();this.renderRecordings();this.chunks=[];this.recStatus.textContent="Grabación guardada."};reader.readAsDataURL(blob)}renderRecordings(){this.recList.innerHTML="";this.app.appData.recordings.forEach(rec=>{const li=document.createElement("li");li.innerHTML=`<div class="rec-info"><input type="text" value="${rec.name}" data-id="${rec.id}" class="rec-name-input" /><audio controls src="${rec.dataUrl}"></audio></div><button class="button small-btn-danger delete-rec" data-id="${rec.id}">🗑️</button>`;this.recList.appendChild(li)});this.recList.querySelectorAll(".rec-name-input").forEach(i=>i.addEventListener("change",e=>this.updateRecordingName(e.target.dataset.id,e.target.value)));this.recList.querySelectorAll(".delete-rec").forEach(b=>b.addEventListener("click",e=>this.deleteRecording(e.target.dataset.id)))}updateRecordingName(id,name){const rec=this.app.appData.recordings.find(r=>r.id===id);rec&&(rec.name=name,this.app.saveData())}deleteRecording(id){this.app.showConfirmation("¿Seguro que quieres borrar esta grabación?",()=>{this.app.appData.recordings=this.app.appData.recordings.filter(r=>r.id!==id);this.app.saveData();this.renderRecordings()})}}

// =================================================================================
// SCALE VISUALIZER 2.0 (FUNCIONALIDAD COMPLETA)
// =================================================================================
class ScaleVisualizer {
    constructor(app) {
        this.app = app;
        this.notes = "C C# D D# E F F# G G# A A# B".split(" ");
        this.tuning = [4, 9, 2, 7, 11, 4];
        
        this.scales = {
            major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
            "pentatonic-major": [0, 2, 4, 7, 9], "pentatonic-minor": [0, 3, 5, 7, 10],
            "harmonic-minor": [0, 2, 3, 5, 7, 8, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
            dorian: [0, 2, 3, 5, 7, 9, 10]
        };

        this.harmonicFields = {
            major: [{r:"I",t:""},{r:"ii",t:"m"},{r:"iii",t:"m"},{r:"IV",t:""},{r:"V",t:""},{r:"vi",t:"m"},{r:"vii",t:"dim"}],
            minor: [{r:"i",t:"m"},{r:"ii",t:"dim"},{r:"III",t:""},{r:"iv",t:"m"},{r:"v",t:"m"},{r:"VI",t:""},{r:"VII",t:""}],
            dorian: [{r:"i",t:"m"},{r:"ii",t:"m"},{r:"III",t:""},{r:"IV",t:""},{r:"v",t:"m"},{r:"vi",t:"dim"},{r:"VII",t:""}],
            mixolydian: [{r:"I",t:""},{r:"ii",t:"m"},{r:"iii",t:"dim"},{r:"IV",t:""},{r:"v",t:"m"},{r:"vi",t:"m"},{r:"VII",t:""}]
        };
        
        this.rootSelect = document.getElementById('rootNoteSelect');
        this.scaleSelect = document.getElementById('scaleTypeSelect');
        this.fretboardContainer = document.getElementById('fretboardVisualizer');
        this.harmonicFieldContainer = document.getElementById('harmonicFieldContainer');
        this.viewSwitcher = document.getElementById('scaleViewSwitcher');

        this.rootSelect.addEventListener('change', () => this.render());
        this.scaleSelect.addEventListener('change', () => this.render());
        this.viewSwitcher.addEventListener('change', () => this.render());
    }

    render() {
        const rootNoteName = this.rootSelect.value.split('/')[0].trim();
        const rootIndex = this.notes.indexOf(rootNoteName);
        const scaleKey = this.scaleSelect.value;
        const scaleIntervals = this.scales[scaleKey];
        const currentView = this.viewSwitcher.querySelector('input:checked').value;
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
                
                notesToShow.add(degreeRoot); notesToShow.add(third); notesToShow.add(fifth);
                noteClasses[degreeRoot] = 'triad-note';
                noteClasses[third] = 'triad-note';
                noteClasses[fifth] = 'triad-note';

                if (currentView === 'arpeggios') {
                    const seventh = scaleNoteIndexes[(i + 6) % 7];
                    notesToShow.add(seventh);
                    noteClasses[degreeRoot] = 'arpeggio-note';
                    noteClasses[third] = 'arpeggio-note';
                    noteClasses[fifth] = 'arpeggio-note';
                    noteClasses[seventh] = 'arpeggio-note';
                }
            }
        }
        
        this.fretboardContainer.innerHTML = '';
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
        
        this.tuning.slice().reverse().forEach(openNoteIndex => {
            grid.appendChild(Object.assign(document.createElement('div'), {className:'string-label', textContent:this.notes[openNoteIndex]}));
            for (let fret = 0; fret <= 12; fret++) {
                const cell = document.createElement('div');
                cell.className = 'fret-cell';
                const noteIndex = (openNoteIndex + fret) % 12;
                if (notesToShow.has(noteIndex)) {
                    const dot = document.createElement('div');
                    dot.className = 'note-dot';
                    dot.textContent = this.notes[noteIndex];
                    dot.classList.add(noteClasses[noteIndex]);
                    if (noteIndex === rootIndex) dot.classList.add('root-note');
                    cell.appendChild(dot);
                }
                grid.appendChild(cell);
            }
        });
        this.fretboardContainer.appendChild(grid);
        this.renderHarmonicField(rootIndex, scaleKey, scaleIntervals);
    }
    
    renderHarmonicField(rootIndex, scaleKey, scaleIntervals) {
        this.harmonicFieldContainer.innerHTML = '';
        const degrees = this.harmonicFields[scaleKey];
        if (!degrees) return;
        
        this.harmonicFieldContainer.appendChild(Object.assign(document.createElement('h4'), {textContent:'Campo Armónico (Acordes de la Escala)'}));
        const chordsContainer = document.createElement('div');
        chordsContainer.className = 'roman-numeral-progression';

        degrees.forEach((degree, i) => {
            const noteIndex = (rootIndex + scaleIntervals[i]) % 12;
            const chordName = this.notes[noteIndex] + degree.t;
            const pill = document.createElement('span');
            pill.className = 'roman-numeral-pill';
            pill.innerHTML = `<span class="degree-roman">${degree.r}</span> ${chordName}`;
            chordsContainer.appendChild(pill);
        });
        
        this.harmonicFieldContainer.appendChild(chordsContainer);
    }
}

// =================================================================================
// INITIALIZATION
// =================================================================================
new GuitarWorshipTrainer();