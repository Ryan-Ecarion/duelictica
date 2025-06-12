/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- Interfaces ---
type PlayerRole = 'Proposisi' | 'Oposisi';
type GamePhase = 
    'BERANDA' | 
    'GAME_SETUP' | 
    'AI_OPPOSITION_SELECTING_TOPIC' | 
    'PLAYER_OPPOSITION_SELECTING_TOPIC' | 
    'MOTION_GENERATION' |
    'MOTION_REVEAL' | 
    'COUNTDOWN_TO_ARGUE' |
    'ARGUMENT_INPUT' | 
    'AI_GENERATING_ARGUMENT' |
    'PLAYER_READING_AI_ARGUMENT' |
    'SCORING' | 
    'GAME_RESULTS' |
    'RIWAYAT' |
    'STATISTIK' |
    'PROFIL' |
    'PENGATURAN';

type AIDifficultyLevel = 'Amatir' | 'Pelajar' | 'Guru' | 'Profesor';

interface Player {
    id: 'player' | 'ai';
    role: PlayerRole | null;
    name: string;
}

interface Argument {
    playerId: Player['id'];
    role: PlayerRole;
    turn: number; 
    text: string;
    timestamp: number;
    analysis?: string; // Analisis AI untuk argumen ini
}

interface Scores {
    logic: number;
    rhetoric: number;
    relevance: number;
}

interface Debate {
    id: string;
    motion: string | null;
    topic: string | null;
    player: Player;
    aiOpponent: Player;
    aiDifficulty: AIDifficultyLevel;
    arguments: Argument[];
    playerScores?: Scores;
    aiScores?: Scores;
    winner?: Player['name'] | 'Seri' | null;
    analysis?: string; // Analisis keseluruhan debat
    startTime: number;
    durationSettingMinutes: number;
    currentTurn: number; 
    currentPhase: GamePhase;
    activePlayerId: Player['id'] | null; 
    countdownValue: number;
    timerValue: number; 
    lastAiArgument: string | null; 
}

interface GameHistoryItem extends Debate {
    endTime: number;
}

// --- Constants ---
const API_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';
const DEFAULT_ARGUMENT_DURATION_MINUTES = 3;
const DEFAULT_AI_DIFFICULTY: AIDifficultyLevel = 'Pelajar';
const COUNTDOWN_TO_ARGUE_SECONDS = 10;
const TOPICS = ["Filsafat", "Moralitas", "Hukum", "Sejarah", "Isu Global Kontemporer", "Teknologi dan Masyarakat", "Sains dan Etika"];
const LOCAL_STORAGE_HISTORY_KEY = 'duelecticaGameHistory';
const LOCAL_STORAGE_DEBATE_FONT_LEVEL_KEY = 'duelecticaDebateFontLevel';
const DEBATE_FONT_SCALE_LEVELS = [-5, -4, -3, -2, -1, 0, 1, 2];
const DEFAULT_DEBATE_FONT_LEVEL = 0;
const FONT_SCALES_MAP: { [level: number]: number } = {
    '-5': 0.65,
    '-4': 0.7,
    '-3': 0.75,
    '-2': 0.8,
    '-1': 0.9,
    '0': 1,
    '1': 1.1,
    '2': 1.2
};


// --- Global State ---
let ai: GoogleGenAI;
let currentDebate: Debate | null = null;
let gameHistory: GameHistoryItem[] = [];
let activeTimers: { countdown?: number, argument?: number, reading?: number } = {};
let currentDebateFontLevel: number = DEFAULT_DEBATE_FONT_LEVEL;


// --- DOM Elements (Cached) ---
let navLinks: NodeListOf<HTMLAnchorElement>;
let pageSections: NodeListOf<HTMLElement>;
let navItems: NodeListOf<HTMLElement>;

// Beranda
let startGameBtn: HTMLButtonElement | null;

// Game Setup
let playerRoleSelect: HTMLSelectElement | null;
let argumentDurationSelect: HTMLSelectElement | null;
let aiDifficultySelect: HTMLSelectElement | null;
let initiateDuelBtn: HTMLButtonElement | null;

// Game Arena
let gameArenaContentDiv: HTMLDivElement | null; 

// Game Results
let resultsMotion: HTMLSpanElement | null;
let resultsWinner: HTMLSpanElement | null;
let resultsAnalysisText: HTMLParagraphElement | null;
let resultsTableBody: HTMLTableSectionElement | null;
let playAgainBtn: HTMLButtonElement | null;
let backToHomeBtn: HTMLButtonElement | null;

// Riwayat
let riwayatContentContainer: HTMLDivElement | null;
let noRiwayatMessage: HTMLParagraphElement | null;

// Statistik
let statistikContentContainer: HTMLDivElement | null;
let statsFilterSelect: HTMLSelectElement | null;
let statsCardsGrid: HTMLDivElement | null;
let noStatistikMessage: HTMLParagraphElement | null;
let statWinRate: HTMLParagraphElement | null;
let statTotalWins: HTMLParagraphElement | null;
let statTotalLosses: HTMLParagraphElement | null;
let statTotalDraws: HTMLParagraphElement | null;
let statAvgLogic: HTMLParagraphElement | null;
let statAvgRhetoric: HTMLParagraphElement | null;
let statAvgRelevance: HTMLParagraphElement | null;
let statTotalGames: HTMLParagraphElement | null;

// Pengaturan
let decreaseFontBtn: HTMLButtonElement | null;
let resetFontBtn: HTMLButtonElement | null;
let increaseFontBtn: HTMLButtonElement | null;
let currentFontLevelIndicator: HTMLParagraphElement | null;
let fontSizePreviewArea: HTMLDivElement | null; 
let exportDataBtn: HTMLButtonElement | null;
let importFileInput: HTMLInputElement | null;
let importDataBtnLabel: HTMLLabelElement | null; 
let resetDataBtn: HTMLButtonElement | null;


function App() {
    console.log("Duelectica App Loaded.");
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    navLinks = document.querySelectorAll('.nav-item a');
    pageSections = document.querySelectorAll('.page-section');
    navItems = document.querySelectorAll('.nav-item');

    startGameBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;
    
    playerRoleSelect = document.getElementById('player-role-select') as HTMLSelectElement | null;
    argumentDurationSelect = document.getElementById('argument-duration-select') as HTMLSelectElement | null;
    aiDifficultySelect = document.getElementById('ai-difficulty-select') as HTMLSelectElement | null;
    initiateDuelBtn = document.getElementById('initiate-duel-btn') as HTMLButtonElement | null;

    gameArenaContentDiv = document.getElementById('game-arena-content') as HTMLDivElement | null;

    resultsMotion = document.getElementById('results-motion') as HTMLSpanElement | null;
    resultsWinner = document.getElementById('results-winner') as HTMLSpanElement | null;
    resultsAnalysisText = document.getElementById('results-analysis-text') as HTMLParagraphElement | null;
    resultsTableBody = document.getElementById('results-table-body') as HTMLTableSectionElement | null;
    playAgainBtn = document.getElementById('play-again-btn') as HTMLButtonElement | null;
    backToHomeBtn = document.getElementById('back-to-home-btn') as HTMLButtonElement | null;

    riwayatContentContainer = document.getElementById('riwayat-content-container') as HTMLDivElement | null;
    noRiwayatMessage = document.getElementById('no-riwayat-message') as HTMLParagraphElement | null;

    statistikContentContainer = document.getElementById('statistik-content-container') as HTMLDivElement | null;
    statsFilterSelect = document.getElementById('stats-filter-select') as HTMLSelectElement | null;
    statsCardsGrid = document.getElementById('stats-cards-grid') as HTMLDivElement | null;
    noStatistikMessage = document.getElementById('no-statistik-message') as HTMLParagraphElement | null;
    statWinRate = document.getElementById('stat-win-rate') as HTMLParagraphElement | null;
    statTotalWins = document.getElementById('stat-total-wins') as HTMLParagraphElement | null;
    statTotalLosses = document.getElementById('stat-total-losses') as HTMLParagraphElement | null;
    statTotalDraws = document.getElementById('stat-total-draws') as HTMLParagraphElement | null;
    statAvgLogic = document.getElementById('stat-avg-logic') as HTMLParagraphElement | null;
    statAvgRhetoric = document.getElementById('stat-avg-rhetoric') as HTMLParagraphElement | null;
    statAvgRelevance = document.getElementById('stat-avg-relevance') as HTMLParagraphElement | null;
    statTotalGames = document.getElementById('stat-total-games') as HTMLParagraphElement | null;

    decreaseFontBtn = document.getElementById('decrease-font-btn') as HTMLButtonElement | null;
    resetFontBtn = document.getElementById('reset-font-btn') as HTMLButtonElement | null;
    increaseFontBtn = document.getElementById('increase-font-btn') as HTMLButtonElement | null;
    currentFontLevelIndicator = document.getElementById('current-font-level-indicator') as HTMLParagraphElement | null;
    fontSizePreviewArea = document.getElementById('font-size-preview-area') as HTMLDivElement | null; 
    exportDataBtn = document.getElementById('export-data-btn') as HTMLButtonElement | null;
    importFileInput = document.getElementById('import-file-input') as HTMLInputElement | null;
    importDataBtnLabel = document.querySelector('label[for="import-file-input"]') as HTMLLabelElement | null;
    resetDataBtn = document.getElementById('reset-data-btn') as HTMLButtonElement | null;
    
    loadGameHistory();
    loadDebateFontPreference();
    setupEventListeners();
    navigateTo('BERANDA');
}

function setupEventListeners() {
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = (link as HTMLAnchorElement).getAttribute('href')?.substring(1);
            if (targetId) {
                let phase: GamePhase = 'BERANDA';
                if (targetId === 'riwayat') phase = 'RIWAYAT';
                else if (targetId === 'statistik') phase = 'STATISTIK';
                else if (targetId === 'profil') phase = 'PROFIL';
                else if (targetId === 'pengaturan') phase = 'PENGATURAN';
                else if (targetId === 'beranda') phase = 'BERANDA';
                navigateTo(phase);
            }
        });
    });

    if (startGameBtn) startGameBtn.onclick = () => navigateTo('GAME_SETUP');
    if (initiateDuelBtn) initiateDuelBtn.onclick = handleInitiateDuel;
    if (playAgainBtn) playAgainBtn.onclick = () => navigateTo('GAME_SETUP');
    if (backToHomeBtn) backToHomeBtn.onclick = () => navigateTo('BERANDA');
    if (statsFilterSelect) statsFilterSelect.onchange = (event) => calculateAndRenderStatistics((event.target as HTMLSelectElement).value as 'all' | PlayerRole);

    if (decreaseFontBtn) decreaseFontBtn.onclick = () => adjustDebateFontSize(-1);
    if (resetFontBtn) resetFontBtn.onclick = resetDebateFontSize;
    if (increaseFontBtn) increaseFontBtn.onclick = () => adjustDebateFontSize(1);
    if (exportDataBtn) exportDataBtn.onclick = exportGameData;
    if (importFileInput) importFileInput.onchange = handleImportData;
    if (resetDataBtn) resetDataBtn.onclick = resetGameData;
}

function navigateTo(phase: GamePhase) {
    console.log(`Navigating to phase: ${phase}`);
    const activeGamePlayPhases: GamePhase[] = ['AI_OPPOSITION_SELECTING_TOPIC', 'PLAYER_OPPOSITION_SELECTING_TOPIC', 'MOTION_GENERATION', 'MOTION_REVEAL', 'COUNTDOWN_TO_ARGUE', 'ARGUMENT_INPUT', 'AI_GENERATING_ARGUMENT', 'PLAYER_READING_AI_ARGUMENT', 'SCORING'];
    const isGameCurrentlyInProgress = currentDebate && activeGamePlayPhases.includes(currentDebate.currentPhase);
    const isTargetAuxiliaryPage = ['RIWAYAT', 'STATISTIK', 'PROFIL', 'PENGATURAN'].includes(phase);

    if (isGameCurrentlyInProgress && isTargetAuxiliaryPage) {
        alert("Selesaikan duel yang sedang berlangsung sebelum berpindah ke bagian ini. Anda dapat kembali ke Beranda untuk memulai ulang jika diperlukan.");
        return; 
    }
    
    clearAllTimers(); 
    const gameOrPostGamePhases: GamePhase[] = [...activeGamePlayPhases, 'GAME_RESULTS'];
    if (currentDebate && gameOrPostGamePhases.includes(currentDebate.currentPhase) && (phase === 'BERANDA' || phase === 'GAME_SETUP')) {
        currentDebate = null;
    }
    
    if (currentDebate && phase !== currentDebate.currentPhase) currentDebate.currentPhase = phase;
    else if (!currentDebate && activeGamePlayPhases.includes(phase) || phase === 'GAME_RESULTS') {
        if (phase !== 'GAME_RESULTS' && activeGamePlayPhases.includes(phase)) {
            phase = 'BERANDA';
        }
    }

    pageSections.forEach(section => section.style.display = 'none');
    navItems.forEach(item => item.classList.remove('active'));

    let sectionToShowId: string = 'beranda'; 
    let navLinkToActivateHref: string = '#beranda'; 

    switch (phase) {
        case 'BERANDA': sectionToShowId = 'beranda'; navLinkToActivateHref = '#beranda'; renderBeranda(); break;
        case 'GAME_SETUP': sectionToShowId = 'game-setup'; navLinkToActivateHref = '#beranda'; renderGameSetup(); break; 
        case 'RIWAYAT': sectionToShowId = 'riwayat'; navLinkToActivateHref = '#riwayat'; renderRiwayat(); break;
        case 'STATISTIK': sectionToShowId = 'statistik'; navLinkToActivateHref = '#statistik'; renderStatistik(); break;
        case 'PROFIL': sectionToShowId = 'profil'; navLinkToActivateHref = '#profil'; renderProfil(); break;
        case 'PENGATURAN': sectionToShowId = 'pengaturan'; navLinkToActivateHref = '#pengaturan'; renderPengaturan(); break;
        case 'AI_OPPOSITION_SELECTING_TOPIC': case 'PLAYER_OPPOSITION_SELECTING_TOPIC': case 'MOTION_GENERATION': case 'MOTION_REVEAL': case 'COUNTDOWN_TO_ARGUE': case 'ARGUMENT_INPUT': case 'AI_GENERATING_ARGUMENT': case 'PLAYER_READING_AI_ARGUMENT': case 'SCORING':
            sectionToShowId = 'game-arena'; navLinkToActivateHref = '#beranda'; renderGameArena(); break; 
        case 'GAME_RESULTS': sectionToShowId = 'game-results'; navLinkToActivateHref = '#beranda'; renderGameResults(); break; 
        default: sectionToShowId = 'beranda'; navLinkToActivateHref = '#beranda'; renderBeranda();
    }
    
    const sectionElement = document.getElementById(sectionToShowId);
    if (sectionElement) sectionElement.style.display = 'flex';

    const activeNavLink = document.querySelector(`.nav-item a[href="${navLinkToActivateHref}"]`);
    activeNavLink?.parentElement?.classList.add('active');
}

// --- Rendering Functions ---
function renderBeranda() { /* Static */ }
function renderGameSetup() {
    if (playerRoleSelect) playerRoleSelect.value = 'Acak';
    if (argumentDurationSelect) argumentDurationSelect.value = String(DEFAULT_ARGUMENT_DURATION_MINUTES);
    if (aiDifficultySelect) aiDifficultySelect.value = DEFAULT_AI_DIFFICULTY;
}
function renderProfil() { /* Placeholder */ }

function renderPengaturan() {
    updateFontLevelIndicator();
    if (fontSizePreviewArea && !fontSizePreviewArea.textContent?.trim()) { // Check if effectively empty
        fontSizePreviewArea.textContent = "Ini adalah contoh teks pratinjau. Ukuran font ini akan berubah sesuai pengaturan di atas. Mosi: Keadilan lebih penting daripada ketertiban.";
    }
    applyDebateFontSize(); 
}

function updateFontLevelIndicator() {
    if (currentFontLevelIndicator) {
        let levelText = "Normal";
        if (currentDebateFontLevel < 0) levelText = `Kecil (${currentDebateFontLevel})`;
        else if (currentDebateFontLevel > 0) levelText = `Besar (+${currentDebateFontLevel})`;
        currentFontLevelIndicator.textContent = `Ukuran Saat Ini: ${levelText}`;
    }
}


function renderRiwayat() {
    if (!riwayatContentContainer || !noRiwayatMessage) return;
    riwayatContentContainer.innerHTML = ''; 
    if (gameHistory.length === 0) {
        noRiwayatMessage.style.display = 'block';
        riwayatContentContainer.appendChild(noRiwayatMessage);
        return;
    }
    noRiwayatMessage.style.display = 'none';
    gameHistory.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('history-item-card');
        card.dataset.debateId = item.id;
        const motionTitle = document.createElement('h4');
        motionTitle.textContent = item.motion || "Mosi Tidak Diketahui";
        const playerRoleP = document.createElement('p');
        playerRoleP.textContent = `Anda sebagai: ${item.player.role}`;
        const aiDifficultyP = document.createElement('p');
        aiDifficultyP.textContent = `Kesulitan AI: ${item.aiDifficulty}`;
        const winnerP = document.createElement('p');
        let winnerText = `Pemenang: ${item.winner || 'Belum Ditentukan'}`;
        let winnerClass = '';
        if (item.winner === item.player.name) { winnerText = `Pemenang: Anda (${item.player.role})`; winnerClass = 'player-win';}
        else if (item.winner === item.aiOpponent.name) { winnerText = `Pemenang: AI Lawan (${item.aiOpponent.role})`; winnerClass = 'ai-win';}
        else if (item.winner === 'Seri') { winnerText = "Hasil: Seri"; winnerClass = 'draw';}
        else if (item.winner && item.winner.startsWith('Error:')) winnerClass = 'error';
        winnerP.innerHTML = `<strong>${winnerText}</strong>`;
        winnerP.classList.add('winner');
        if (winnerClass) winnerP.classList.add(winnerClass);
        const dateP = document.createElement('p');
        dateP.textContent = `Tanggal: ${new Date(item.endTime).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour:'2-digit', minute:'2-digit' })}`;
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('history-item-actions');
        const detailsButton = document.createElement('button');
        detailsButton.classList.add('btn', 'btn-secondary', 'btn-small');
        detailsButton.textContent = 'Lihat Detail';
        detailsButton.onclick = () => {
            const debateToView = gameHistory.find(d => d.id === item.id);
            if (debateToView) { currentDebate = { ...debateToView }; navigateTo('GAME_RESULTS'); }
        };
        actionsDiv.appendChild(detailsButton);
        card.append(motionTitle, playerRoleP, aiDifficultyP, winnerP, dateP, actionsDiv);
        riwayatContentContainer.appendChild(card);
    });
}

function renderStatistik() {
    if (!statsFilterSelect) return;
    calculateAndRenderStatistics(statsFilterSelect.value as 'all' | PlayerRole);
}

function calculateAndRenderStatistics(filter: 'all' | PlayerRole) {
    if (!statWinRate || !statTotalWins || !statTotalLosses || !statTotalDraws || !statAvgLogic || !statAvgRhetoric || !statAvgRelevance || !statTotalGames || !noStatistikMessage || !statsCardsGrid) return;
    const filteredHistory = gameHistory.filter(item => filter === 'all' || item.player.role === filter);
    if (filteredHistory.length === 0) {
        noStatistikMessage.style.display = 'block'; statsCardsGrid.style.display = 'none';
        statWinRate.textContent = "- %"; statTotalWins.textContent = "-"; statTotalLosses.textContent = "-"; statTotalDraws.textContent = "-"; statAvgLogic.textContent = "-"; statAvgRhetoric.textContent = "-"; statAvgRelevance.textContent = "-"; statTotalGames.textContent = "0";
        return;
    }
    noStatistikMessage.style.display = 'none'; statsCardsGrid.style.display = 'grid';
    let wins = 0, losses = 0, draws = 0, totalLogic = 0, totalRhetoric = 0, totalRelevance = 0, gamesWithScores = 0;
    filteredHistory.forEach(item => {
        if (item.winner === item.player.name) wins++;
        else if (item.winner === item.aiOpponent.name) losses++;
        else if (item.winner === 'Seri') draws++;
        if (item.playerScores) { totalLogic += item.playerScores.logic; totalRhetoric += item.playerScores.rhetoric; totalRelevance += item.playerScores.relevance; gamesWithScores++; }
    });
    const totalGamesPlayed = filteredHistory.length;
    statWinRate.textContent = `${(totalGamesPlayed > 0 ? (wins / totalGamesPlayed) * 100 : 0).toFixed(1)} %`;
    statTotalWins.textContent = String(wins); statTotalLosses.textContent = String(losses); statTotalDraws.textContent = String(draws); statTotalGames.textContent = String(totalGamesPlayed);
    statAvgLogic.textContent = gamesWithScores > 0 ? (totalLogic / gamesWithScores).toFixed(1) : "-";
    statAvgRhetoric.textContent = gamesWithScores > 0 ? (totalRhetoric / gamesWithScores).toFixed(1) : "-";
    statAvgRelevance.textContent = gamesWithScores > 0 ? (totalRelevance / gamesWithScores).toFixed(1) : "-";
}

// --- Pengaturan Logic ---

function adjustDebateFontSize(levelChange: number) {
    const currentIndex = DEBATE_FONT_SCALE_LEVELS.indexOf(currentDebateFontLevel);
    let newIndex = currentIndex + levelChange;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= DEBATE_FONT_SCALE_LEVELS.length) newIndex = DEBATE_FONT_SCALE_LEVELS.length - 1;
    currentDebateFontLevel = DEBATE_FONT_SCALE_LEVELS[newIndex];
    applyDebateFontSize();
    localStorage.setItem(LOCAL_STORAGE_DEBATE_FONT_LEVEL_KEY, String(currentDebateFontLevel));
    updateFontLevelIndicator();
}

function resetDebateFontSize() {
    currentDebateFontLevel = DEFAULT_DEBATE_FONT_LEVEL;
    applyDebateFontSize();
    localStorage.setItem(LOCAL_STORAGE_DEBATE_FONT_LEVEL_KEY, String(currentDebateFontLevel));
    updateFontLevelIndicator();
}

function applyDebateFontSize() {
    const scaleFactor = FONT_SCALES_MAP[currentDebateFontLevel] || 1;
    document.documentElement.style.setProperty('--debate-font-scale-factor', String(scaleFactor));
    if (fontSizePreviewArea) {
        fontSizePreviewArea.style.fontSize = `${scaleFactor}em`; 
    }
}

function loadDebateFontPreference() {
    const storedLevel = localStorage.getItem(LOCAL_STORAGE_DEBATE_FONT_LEVEL_KEY);
    currentDebateFontLevel = storedLevel ? parseInt(storedLevel) : DEFAULT_DEBATE_FONT_LEVEL;
    if (!DEBATE_FONT_SCALE_LEVELS.includes(currentDebateFontLevel)) {
        currentDebateFontLevel = DEFAULT_DEBATE_FONT_LEVEL;
    }
    applyDebateFontSize();
    updateFontLevelIndicator();
}

function exportGameData() {
    if (gameHistory.length === 0) {
        alert("Tidak ada data riwayat untuk diekspor.");
        return;
    }
    const jsonData = JSON.stringify(gameHistory, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duelectica_history.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Data riwayat telah diekspor!");
}

function handleImportData(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target?.result as string);
            if (Array.isArray(importedData) && importedData.every(item => typeof item.id === 'string' && item.motion && item.player)) { 
                if (!confirm("Apakah Anda yakin ingin mengganti riwayat saat ini dengan data yang diimpor? Tindakan ini tidak dapat diurungkan.")) {
                    if(importFileInput) importFileInput.value = ''; 
                    return;
                }
                gameHistory = importedData as GameHistoryItem[];
                localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(gameHistory));
                alert("Data riwayat berhasil diimpor!");
                if (document.querySelector('.page-section[id="riwayat"][style*="display: flex"]')) renderRiwayat();
                if (document.querySelector('.page-section[id="statistik"][style*="display: flex"]')) renderStatistik();
            } else {
                alert("Format file tidak valid atau data korup.");
            }
        } catch (error) {
            console.error("Error importing data:", error);
            alert("Gagal mengimpor data. Pastikan file JSON valid.");
        } finally {
            if(importFileInput) importFileInput.value = ''; 
        }
    };
    reader.readAsText(file);
}

function resetGameData() {
    if (!confirm("Apakah Anda yakin ingin mereset semua data riwayat dan statistik? Tindakan ini tidak dapat diurungkan.")) {
        return;
    }
    gameHistory = [];
    localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    alert("Semua data riwayat dan statistik telah direset.");
    if (document.querySelector('.page-section[id="riwayat"][style*="display: flex"]')) renderRiwayat();
    if (document.querySelector('.page-section[id="statistik"][style*="display: flex"]')) renderStatistik();
}


// --- Gemini API Functions ---
async function generateMotionFromAI(topic: string): Promise<string> {
    try {
        const prompt = `Anda adalah sistem pembuat mosi debat. Berdasarkan topik "${topic}", buatlah satu mosi debat dalam Bahasa Indonesia. Mosi harus singkat, jelas (satu kalimat inti), kontroversial namun seimbang, menarik, dan mudah dipahami. Langsung kembalikan HANYA teks mosi debatnya saja, tanpa kalimat pembuka, tanpa kata "Mosi:", dan tanpa format markdown (seperti **). Contoh output: "Pendidikan gratis seharusnya sepenuhnya didanai oleh pajak."`;
        const response: GenerateContentResponse = await ai.models.generateContent({ model: API_MODEL_TEXT, contents: prompt });
        let motionText = response.text.trim().replace(/^.*\b(adalah|yaitu|berikut|ini)\s*(mosi|pernyataan debat|mosi debat)\s*:\s*/i, '').replace(/^\s*(mosi debat|mosi)\s*:\s*/i, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        if (!motionText) throw new Error("AI failed to generate a valid motion text.");
        return motionText;
    } catch (error) { console.error("Error generating motion:", error); return `Error: Gagal membuat mosi untuk topik "${topic}".`; }
}

async function generateArgumentFromAI(debate: Debate, currentTurnForAI: number): Promise<string> {
    if (!debate.motion) return "Error: Mosi tidak ditemukan.";
    const { motion, aiOpponent, player, arguments: prevArgs, aiDifficulty, durationSettingMinutes } = debate;
    const aiRole = aiOpponent.role; const playerRole = player.role;

    let lengthInstruction = "";
    if (durationSettingMinutes <= 1) lengthInstruction = "Buat argumen yang sangat singkat, sekitar 30-60 kata. Hindari poin-poin bernomor atau bullet list.";
    else if (durationSettingMinutes <= 3) lengthInstruction = "Buat argumen sekitar 70-120 kata. Boleh menggunakan poin singkat jika sangat relevan, namun utamakan bentuk paragraf.";
    else lengthInstruction = "Buat argumen yang lebih komprehensif, sekitar 130-180 kata. Boleh menggunakan poin jika perlu untuk struktur, namun utamakan bentuk paragraf.";

    let difficultyInstruction = "";
    switch(aiDifficulty) {
        case 'Amatir': difficultyInstruction = "Anda adalah AI lawan Amatir. Gunakan bahasa sederhana, argumen lugas, dan mungkin mengandung beberapa generalisasi berlebihan atau kesalahan logika minor. Jangan terlalu canggih atau terstruktur. "; break;
        case 'Pelajar': difficultyInstruction = "Anda adalah AI lawan Pelajar. Tunjukkan pemahaman baik, struktur argumen jelas, sanggahan relevan. "; break;
        case 'Guru': difficultyInstruction = "Anda adalah AI lawan Guru. Berikan argumen mendalam, kritis, retorika canggih, analisis tajam. "; break;
        case 'Profesor': difficultyInstruction = "Anda adalah AI lawan Profesor. Analisis sangat tajam, argumen berlapis, sanggahan detail, bahasa formal dan presisi. "; break;
    }

    let prompt = `${difficultyInstruction} ${lengthInstruction} Jangan gunakan format markdown seperti **bold** atau *italic*. Berikan teks argumen murni sebagai paragraf atau poin-poin sederhana jika diminta.\n`;
    
    const getArg = (role: PlayerRole, turn: number) => prevArgs.find(arg => arg.role === role && arg.turn === turn)?.text || "";
    const playerOpeningArg = getArg(playerRole!, 1); const aiOpeningArg = getArg(aiRole!, 1);
    const playerRebuttalArg = getArg(playerRole!, 2); const aiRebuttalArg = getArg(aiRole!, 2);
    const playerCounterArg = getArg(playerRole!, 3);

    if (aiRole === 'Proposisi') {
        if (currentTurnForAI === 1) prompt += `Anda Kubu Proposisi, dukung mosi: "${motion}". Berikan argumen pembuka. Fokus kejelasan dan struktur. Bahasa Indonesia.`;
        else if (currentTurnForAI === 3) prompt += `Anda Kubu Proposisi. Mosi: "${motion}". Argumen pembuka Anda: "${aiOpeningArg}". Sanggahan Oposisi: "${playerRebuttalArg}". Balas sanggahan Oposisi, perkuat argumen awal Anda, dan serang balik kelemahan Oposisi. Bahasa Indonesia.`;
    } else { // AI is Opposition
        if (currentTurnForAI === 2) prompt += `Anda Kubu Oposisi, tentang mosi: "${motion}". Argumen pembuka Proposisi: "${playerOpeningArg}". Sanggah argumen Proposisi tersebut, tunjukkan kelemahannya, dan perkuat posisi Oposisi. Fokus pada logika. Bahasa Indonesia.`;
        else if (currentTurnForAI === 4) prompt += `Anda Kubu Oposisi. Mosi: "${motion}". Berikan pernyataan penutup Anda. Rangkum poin terkuat Oposisi, tunjukkan mengapa mosi seharusnya ditolak, dan berikan kesan akhir yang kuat. Alur debat sejauh ini: Proposisi Pembuka: "${playerOpeningArg}"; Oposisi Sanggahan Anda: "${aiRebuttalArg}"; Proposisi Sanggahan Balik: "${playerCounterArg}". Bahasa Indonesia.`;
    }

    if (prompt === `${difficultyInstruction} ${lengthInstruction} Jangan gunakan format markdown seperti **bold** atau *italic*. Berikan teks argumen murni sebagai paragraf atau poin-poin sederhana jika diminta.\n`) {
        return "Error: Gagal membuat prompt AI untuk giliran ini.";
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: API_MODEL_TEXT, contents: prompt });
        let argumentText = response.text.trim();
        // Pembersihan tambahan untuk markdown (walaupun sudah diinstruksikan)
        argumentText = argumentText.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        if (!argumentText) throw new Error("AI failed to generate an argument.");
        return argumentText;
    } catch (error) { console.error("Error generating AI argument:", error); return "Error: AI gagal menghasilkan argumen."; }
}


async function analyzeSingleArgumentWithAI(argumentText: string, motion: string, role: PlayerRole, turn: number, difficulty: AIDifficultyLevel): Promise<string> {
    if (!argumentText || !motion) return "Analisis tidak tersedia.";
    try {
        const prompt = `Anda adalah AI penganalisis argumen yang objektif dan netral. Mosi debat adalah: "${motion}". Diberikan sebuah argumen dari kubu ${role} pada giliran ke-${turn}. Argumen tersebut adalah: "${argumentText}". Berikan analisis singkat (maksimum 30-40 kata) terhadap argumen ini. Fokus pada kejelasan, relevansi terhadap mosi, dan potensi kekuatan atau kelemahan logisnya. Jangan memihak. Sampaikan analisis dalam Bahasa Indonesia.`;
        const response: GenerateContentResponse = await ai.models.generateContent({ model: API_MODEL_TEXT, contents: prompt });
        const analysis = response.text.trim();
        return analysis || "Gagal mendapatkan analisis argumen.";
    } catch (error) {
        console.error("Error analyzing single argument:", error);
        return "Analisis AI tidak tersedia saat ini.";
    }
}


async function evaluateDebateWithAI(debate: Debate): Promise<Partial<Debate>> {
    if (!debate.motion || debate.arguments.length < 4) return { winner: 'Error', analysis: 'Debat tidak lengkap untuk dinilai.' };
    
    const { motion, arguments: allArgs, player, aiOpponent } = debate;
    const propOpen = allArgs.find(a => a.role === 'Proposisi' && a.turn === 1)?.text || "N/A";
    const oppRebuttal = allArgs.find(a => a.role === 'Oposisi' && a.turn === 2)?.text || "N/A";
    const propCounter = allArgs.find(a => a.role === 'Proposisi' && a.turn === 3)?.text || "N/A";
    const oppClose = allArgs.find(a => a.role === 'Oposisi' && a.turn === 4)?.text || "N/A";

    const judgeInstruction = `Anda adalah juri debat AI yang benar-benar objektif dan netral. Jangan memihak Proposisi atau Oposisi.`;
    const prompt = `${judgeInstruction}\n Mosi Debat: "${motion}"\n\nArgumen Proposisi (Pembuka):\n${propOpen}\n\nArgumen Oposisi (Sanggahan):\n${oppRebuttal}\n\nArgumen Proposisi (Sanggahan Balik):\n${propCounter}\n\nArgumen Oposisi (Penutup):\n${oppClose}\n\nTugas Anda:\n1. Berikan skor (skala 1.0-10.0, satu desimal) untuk masing-masing pihak (Proposisi dan Oposisi) berdasarkan tiga kriteria: Logika, Retorika, dan Relevansi terhadap mosi.\n2. Berikan analisis singkat (maksimum 150 kata) mengenai keseluruhan jalannya debat, menyoroti kekuatan dan kelemahan utama dari kedua belah pihak secara seimbang.\n3. Tentukan pemenang debat (Proposisi, Oposisi, atau Seri) berdasarkan penilaian Anda.\n\nKembalikan respons HANYA dalam format JSON berikut:\n{\n  "proposisi_scores": {"logic": 0.0, "rhetoric": 0.0, "relevance": 0.0},\n  "oposisi_scores": {"logic": 0.0, "rhetoric": 0.0, "relevance": 0.0},\n  "analysis": "...",\n  "winner": "Proposisi|Oposisi|Seri"\n}`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: API_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" } });
        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) jsonStr = match[2].trim();
        
        const result = JSON.parse(jsonStr);
        
        const playerIsProposisi = player.role === 'Proposisi';
        return {
            playerScores: playerIsProposisi ? result.proposisi_scores : result.oposisi_scores,
            aiScores: playerIsProposisi ? result.oposisi_scores : result.proposisi_scores,
            analysis: result.analysis,
            winner: result.winner === player.role ? player.name : result.winner === aiOpponent.role ? aiOpponent.name : (result.winner === 'Seri' ? 'Seri' : `Error: Pemenang tidak valid (${result.winner})`)
        };
    } catch (error) { 
        console.error("Error evaluating debate:", error); 
        return { 
            winner: 'Error', 
            analysis: 'Gagal mendapatkan penilaian AI komprehensif. Pastikan AI mengembalikan format JSON yang benar.',
            playerScores: { logic: 0, rhetoric: 0, relevance: 0 },
            aiScores: { logic: 0, rhetoric: 0, relevance: 0 }
        }; 
    }
}

// --- Game Flow & Logic ---
function handleInitiateDuel() {
    if (!playerRoleSelect || !argumentDurationSelect || !aiDifficultySelect) return;
    const roleChoice = playerRoleSelect.value as 'Acak' | PlayerRole;
    const durationMinutes = parseInt(argumentDurationSelect.value);
    const difficulty = aiDifficultySelect.value as AIDifficultyLevel;
    let playerRole: PlayerRole = roleChoice === 'Acak' ? (Math.random() < 0.5 ? 'Proposisi' : 'Oposisi') : roleChoice;
    let aiRole: PlayerRole = playerRole === 'Proposisi' ? 'Oposisi' : 'Proposisi';
    currentDebate = { id: `debate-${Date.now()}`, motion: null, topic: null, player: { id: 'player', role: playerRole, name: 'Pemain' }, aiOpponent: { id: 'ai', role: aiRole, name: 'AI Lawan' }, aiDifficulty: difficulty, arguments: [], startTime: Date.now(), durationSettingMinutes: durationMinutes, currentTurn: 1, currentPhase: playerRole === 'Oposisi' ? 'PLAYER_OPPOSITION_SELECTING_TOPIC' : 'AI_OPPOSITION_SELECTING_TOPIC', activePlayerId: playerRole === 'Oposisi' ? 'player' : 'ai', countdownValue: COUNTDOWN_TO_ARGUE_SECONDS, timerValue: durationMinutes * 60, lastAiArgument: null };
    navigateTo(currentDebate.currentPhase); processGamePhase(); 
}

async function processGamePhase() {
    if (!currentDebate) return;
    console.log(`Processing phase: ${currentDebate.currentPhase} turn ${currentDebate.currentTurn}`);
    renderGameArena(); 
    switch (currentDebate.currentPhase) {
        case 'AI_OPPOSITION_SELECTING_TOPIC':
            currentDebate.topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
            currentDebate.currentPhase = 'MOTION_GENERATION'; await processGamePhase(); break;
        case 'PLAYER_OPPOSITION_SELECTING_TOPIC': currentDebate.activePlayerId = 'player'; break;
        case 'MOTION_GENERATION':
            if (!currentDebate.topic) { currentDebate.currentPhase = currentDebate.player.role === 'Oposisi' ? 'PLAYER_OPPOSITION_SELECTING_TOPIC' : 'AI_OPPOSITION_SELECTING_TOPIC'; await processGamePhase(); return; }
            currentDebate.motion = await generateMotionFromAI(currentDebate.topic);
            currentDebate.currentPhase = 'MOTION_REVEAL'; await processGamePhase(); break;
        case 'MOTION_REVEAL':
            setTimeout(async () => {
                if (!currentDebate || currentDebate.currentPhase !== 'MOTION_REVEAL') return; 
                const playerRoleForTurn = (currentDebate.currentTurn === 1 || currentDebate.currentTurn === 3) ? 'Proposisi' : 'Oposisi';
                currentDebate.activePlayerId = currentDebate.player.role === playerRoleForTurn ? 'player' : 'ai';
                currentDebate.currentPhase = currentDebate.activePlayerId === 'player' ? 'COUNTDOWN_TO_ARGUE' : 'AI_GENERATING_ARGUMENT';
                navigateTo(currentDebate.currentPhase); await processGamePhase();
            }, 2000); break;
        case 'COUNTDOWN_TO_ARGUE':
            startCountdownTimer(COUNTDOWN_TO_ARGUE_SECONDS, () => { if (!currentDebate) return; currentDebate.currentPhase = 'ARGUMENT_INPUT'; navigateTo('ARGUMENT_INPUT'); processGamePhase(); }); break;
        case 'ARGUMENT_INPUT':
            if (currentDebate.activePlayerId !== 'player') { currentDebate.activePlayerId = 'ai'; currentDebate.currentPhase = 'AI_GENERATING_ARGUMENT'; navigateTo(currentDebate.currentPhase); await processGamePhase(); return; }
            startArgumentTimer(currentDebate.durationSettingMinutes * 60, handlePlayerArgumentSubmit); break;
        case 'AI_GENERATING_ARGUMENT':
            const aiArg = await generateArgumentFromAI(currentDebate, currentDebate.currentTurn);
            await recordArgument('ai', currentDebate.aiOpponent.role!, currentDebate.currentTurn, aiArg);
            currentDebate.lastAiArgument = aiArg;
            const isAiLastTurn = (currentDebate.currentTurn === 4 && currentDebate.aiOpponent.role === 'Oposisi') || (currentDebate.currentTurn === 3 && currentDebate.aiOpponent.role === 'Proposisi');
            currentDebate.currentPhase = isAiLastTurn ? 'SCORING' : 'PLAYER_READING_AI_ARGUMENT';
            navigateTo(currentDebate.currentPhase); await processGamePhase(); break;
        case 'PLAYER_READING_AI_ARGUMENT':
            startReadingTimer((currentDebate.durationSettingMinutes * 60) / 2, async () => { 
                if (!currentDebate) return; currentDebate.currentTurn++;
                if (currentDebate.currentTurn > 4) currentDebate.currentPhase = 'SCORING';
                else {
                    const nextTurnPlayerRole = (currentDebate.currentTurn === 1 || currentDebate.currentTurn === 3) ? 'Proposisi' : 'Oposisi';
                    currentDebate.activePlayerId = currentDebate.player.role === nextTurnPlayerRole ? 'player' : 'ai'; 
                    currentDebate.currentPhase = 'COUNTDOWN_TO_ARGUE';
                }
                navigateTo(currentDebate.currentPhase); await processGamePhase();
            }); break;
        case 'SCORING':
            const evalResults = await evaluateDebateWithAI(currentDebate);
            let finalWinner = evalResults.winner;
            let finalAnalysis = evalResults.analysis;
            let finalPlayerScores: Scores = evalResults.playerScores ? { ...evalResults.playerScores } : { logic: 1, rhetoric: 1, relevance: 1 };
            let finalAiScores: Scores = evalResults.aiScores ? { ...evalResults.aiScores } : { logic: 1, rhetoric: 1, relevance: 1 };

            const difficulty = currentDebate.aiDifficulty;
            const playerName = currentDebate.player.name;
            let winOverridden = false;

            const calculateTotal = (s: Scores | undefined): number => (s?.logic || 0) + (s?.rhetoric || 0) + (s?.relevance || 0);
            
            const sanitizeScoreValue = (value: number): number => parseFloat(Math.min(10, Math.max(1, value)).toFixed(1));
            const sanitizeScores = (scores: Scores): Scores => ({
                logic: sanitizeScoreValue(scores.logic),
                rhetoric: sanitizeScoreValue(scores.rhetoric),
                relevance: sanitizeScoreValue(scores.relevance),
            });

            if (difficulty === 'Amatir') {
                const targetWinProbability = 0.8;
                if (Math.random() < targetWinProbability && finalWinner !== playerName) {
                    finalWinner = playerName;
                    finalAnalysis = `Catatan Juri Tambahan: Berdasarkan tingkat kesulitan Amatir, kemenangan diberikan kepada Pemain untuk tujuan pembelajaran.\n\nAnalisis Asli AI:\n${evalResults.analysis || 'Tidak ada analisis.'}`;
                    winOverridden = true;
                }
            } else if (difficulty === 'Pelajar') {
                const targetWinProbability = 0.6;
                if (Math.random() < targetWinProbability && finalWinner !== playerName) {
                    finalWinner = playerName;
                    finalAnalysis = `Catatan Juri Tambahan: Berdasarkan tingkat kesulitan Pelajar, kemenangan disesuaikan untuk Pemain guna mendorong partisipasi.\n\nAnalisis Asli AI:\n${evalResults.analysis || 'Tidak ada analisis.'}`;
                    winOverridden = true;
                }
            }

            if (winOverridden && finalWinner === playerName) {
                // Use original AI-evaluated scores as a base for adjustment
                const originalPlayerTotal = calculateTotal(evalResults.playerScores);
                const originalAiTotal = calculateTotal(evalResults.aiScores);

                if (originalPlayerTotal <= originalAiTotal) {
                    // Player needs a score boost. Set player scores to be slightly and plausibly higher than AI's.
                    const aiAvg = (evalResults.aiScores?.logic || 6.5 + evalResults.aiScores?.rhetoric || 6.5 + evalResults.aiScores?.relevance || 6.5) / 3;
                    
                    finalPlayerScores = {
                        logic: aiAvg + 0.3 + (Math.random() * 0.5), // e.g. AI avg + 0.3 to 0.8
                        rhetoric: aiAvg + 0.2 + (Math.random() * 0.5),
                        relevance: aiAvg + 0.1 + (Math.random() * 0.6)
                    };
                    
                    // Keep AI scores from original eval or slightly adjust if they were too high/low
                    finalAiScores = {
                         logic: evalResults.aiScores?.logic || 6.8,
                         rhetoric: evalResults.aiScores?.rhetoric || 6.8,
                         relevance: evalResults.aiScores?.relevance || 6.8
                    };
                }
                // If player was already winning numerically in original eval, their scores (finalPlayerScores from evalResults) will be used.
            }
            
            finalPlayerScores = sanitizeScores(finalPlayerScores);
            finalAiScores = sanitizeScores(finalAiScores);

            // Final check: if player is winner, ensure their total score is higher.
            if (finalWinner === playerName && calculateTotal(finalPlayerScores) <= calculateTotal(finalAiScores)) {
                 finalPlayerScores.logic = Math.min(10, (finalAiScores.logic) + 0.5);
                 finalPlayerScores.rhetoric = Math.min(10, (finalAiScores.rhetoric)); // Keep one potentially same
                 finalPlayerScores.relevance = Math.min(10, (finalAiScores.relevance) + 0.3);
                 finalPlayerScores = sanitizeScores(finalPlayerScores); // Re-sanitize
                 // If still not enough, make a more drastic adjustment on one metric
                 if (calculateTotal(finalPlayerScores) <= calculateTotal(finalAiScores)) {
                     finalPlayerScores.logic = Math.min(10, finalPlayerScores.logic + 0.5);
                     finalPlayerScores = sanitizeScores(finalPlayerScores);
                 }
            }


            Object.assign(currentDebate, {
                winner: finalWinner,
                analysis: finalAnalysis,
                playerScores: finalPlayerScores,
                aiScores: finalAiScores
            });
            saveGameToHistory(currentDebate as GameHistoryItem); 
            currentDebate.currentPhase = 'GAME_RESULTS'; navigateTo('GAME_RESULTS'); break;
    }
}

function handleTopicConfirmed(topic: string) {
    if (!currentDebate || currentDebate.currentPhase !== 'PLAYER_OPPOSITION_SELECTING_TOPIC') return;
    currentDebate.topic = topic; currentDebate.currentPhase = 'MOTION_GENERATION';
    navigateTo(currentDebate.currentPhase); processGamePhase(); 
}

async function handlePlayerArgumentSubmit(argumentText?: string) { 
    clearAllTimers(); if (!currentDebate || currentDebate.activePlayerId !== 'player') return;
    const finalArg = argumentText || (document.getElementById('argument-textarea') as HTMLTextAreaElement)?.value || "Argumen tidak diserahkan.";
    await recordArgument('player', currentDebate.player.role!, currentDebate.currentTurn, finalArg);
    const isPlayerLastTurn = (currentDebate.player.role === 'Oposisi' && currentDebate.currentTurn === 4) || (currentDebate.player.role === 'Proposisi' && currentDebate.currentTurn === 3 && currentDebate.aiOpponent.role === 'Oposisi');
    if (isPlayerLastTurn) {
        if (currentDebate.player.role === 'Proposisi' && currentDebate.currentTurn === 3) { 
            currentDebate.currentTurn++; currentDebate.activePlayerId = 'ai'; currentDebate.currentPhase = 'AI_GENERATING_ARGUMENT';
        } else { 
             currentDebate.currentPhase = 'SCORING';
        }
    } else { 
        currentDebate.currentTurn++; currentDebate.activePlayerId = 'ai'; currentDebate.currentPhase = 'AI_GENERATING_ARGUMENT';
    }
    navigateTo(currentDebate.currentPhase); await processGamePhase();
}

async function handleFinishReading() {
    clearAllTimers(); if(!currentDebate || currentDebate.currentPhase !== 'PLAYER_READING_AI_ARGUMENT') return;
    currentDebate.currentTurn++; 
    if (currentDebate.currentTurn > 4) currentDebate.currentPhase = 'SCORING';
    else {
        const nextTurnPlayerRole = (currentDebate.currentTurn === 1 || currentDebate.currentTurn === 3) ? 'Proposisi' : 'Oposisi';
        currentDebate.activePlayerId = currentDebate.player.role === nextTurnPlayerRole ? 'player' : 'ai';
        currentDebate.currentPhase = 'COUNTDOWN_TO_ARGUE';
    }
    navigateTo(currentDebate.currentPhase); await processGamePhase();
}

async function recordArgument(playerId: Player['id'], role: PlayerRole, turn: number, text: string) {
    if (!currentDebate) return;
    let analysisText = "Analisis AI sedang diproses...";
    try {
        // Still generate per-argument analysis, but it will only be shown in results.
        analysisText = await analyzeSingleArgumentWithAI(text, currentDebate.motion || "Mosi belum ditetapkan", role, turn, currentDebate.aiDifficulty);
    } catch (e) {
        console.error("Failed to get single argument analysis", e);
        analysisText = "Gagal memuat analisis untuk argumen ini.";
    }
    currentDebate.arguments.push({ playerId, role, turn, text, timestamp: Date.now(), analysis: analysisText });
    renderArgumentHistory(); 
}

// --- UI Rendering for Game Arena ---
function renderGameArena() {
    if (!gameArenaContentDiv || !currentDebate) { if(gameArenaContentDiv) gameArenaContentDiv.innerHTML = "<p>Error: Sesi debat tidak aktif.</p>"; return; }
    let html = '';
    if (currentDebate.motion) html += `<div id="motion-display" class="motion-display-class"><strong>Mosi:</strong> ${currentDebate.motion}</div>`;
    else if (currentDebate.currentPhase === 'MOTION_GENERATION') html += `<div id="opponent-status-display" class="opponent-status-class">AI membuat mosi dari topik: "${currentDebate.topic || 'Dipilih AI'}"...</div>`;
    else if (currentDebate.currentPhase === 'AI_OPPOSITION_SELECTING_TOPIC') html += `<div id="opponent-status-display" class="opponent-status-class">AI Lawan (Oposisi - ${currentDebate.aiDifficulty}) memilih topik...</div>`;
    else if (currentDebate.currentPhase === 'PLAYER_OPPOSITION_SELECTING_TOPIC') html += `<div id="opponent-status-display" class="opponent-status-class">Pilih topik debat.</div>`;
    html += `<div id="player-role-indicator" class="player-role-indicator-class">Anda sebagai: <strong>${currentDebate.player.role}</strong> (Giliran ${currentDebate.currentTurn}/4)</div>`;
    html += `<div id="argument-history-container" class="argument-history-class"></div>`;
    switch (currentDebate.currentPhase) {
        case 'PLAYER_OPPOSITION_SELECTING_TOPIC': html += `<div id="topic-selection-container"><label for="topic-select">Pilih Topik (Oposisi):</label><select id="topic-select" class="form-control">${TOPICS.map(t => `<option value="${t}">${t}</option>`).join('')}</select><button id="confirm-topic-btn" class="btn btn-primary">Konfirmasi</button></div>`; break;
        case 'MOTION_REVEAL': html += `<div id="opponent-status-display" class="opponent-status-class">Mosi ditetapkan! Bersiap berargumen.</div>`; break;
        case 'COUNTDOWN_TO_ARGUE': html += `<div id="opponent-status-display" class="opponent-status-class">Giliran Anda! Mulai dalam <span id="countdown-value-inline">${currentDebate.countdownValue}</span>s...</div>`; break;
        case 'ARGUMENT_INPUT': html += `<div id="timer-display" class="timer-display-class">Sisa Waktu: <span id="timer-value-span">${formatTime(currentDebate.timerValue)}</span></div><div id="argument-input-container"><label for="argument-textarea" id="argument-label">${getArgumentPrompt(currentDebate.player.role!, currentDebate.currentTurn)}</label><textarea id="argument-textarea" rows="10" placeholder="Ketik argumen..."></textarea><button id="submit-argument-btn" class="btn btn-primary btn-full-width">Kirim</button></div>`; break;
        case 'AI_GENERATING_ARGUMENT': html += `<div id="opponent-status-display" class="opponent-status-class">AI Lawan (${currentDebate.aiOpponent.role} - ${currentDebate.aiDifficulty}) menyusun argumen (Giliran ${currentDebate.currentTurn})...</div>`; break;
        case 'PLAYER_READING_AI_ARGUMENT': html += `<div id="timer-display" class="timer-display-class">Waktu Membaca: <span id="timer-value-span">${formatTime(currentDebate.timerValue)}</span></div><div id="reading-phase-container"><p>Argumen AI (${currentDebate.aiOpponent.role} - Giliran ${currentDebate.arguments.find(a=>a.playerId==='ai'&&a.text===currentDebate.lastAiArgument)?.turn || 'sblm'}):</p><div id="reading-argument-text" style="white-space: pre-wrap;">${currentDebate.lastAiArgument||"N/A"}</div><button id="finish-reading-btn" class="btn btn-secondary">Lanjutkan</button></div>`; break;
        case 'SCORING': html += `<div id="opponent-status-display" class="opponent-status-class">Debat selesai. AI Juri (${currentDebate.aiDifficulty}) menilai...</div>`; break;
        default: html += `<div id="opponent-status-display" class="opponent-status-class">Memuat...</div>`;
    }
    gameArenaContentDiv.innerHTML = html; renderArgumentHistory();
    if (currentDebate.currentPhase === 'PLAYER_OPPOSITION_SELECTING_TOPIC') document.getElementById('confirm-topic-btn')?.addEventListener('click', () => handleTopicConfirmed((document.getElementById('topic-select') as HTMLSelectElement).value));
    else if (currentDebate.currentPhase === 'ARGUMENT_INPUT') { document.getElementById('submit-argument-btn')?.addEventListener('click', () => handlePlayerArgumentSubmit()); (document.getElementById('argument-textarea') as HTMLTextAreaElement)?.focus(); }
    else if (currentDebate.currentPhase === 'PLAYER_READING_AI_ARGUMENT') document.getElementById('finish-reading-btn')?.addEventListener('click', handleFinishReading);
    const cdValEl = document.getElementById('countdown-value'), cdValInlineEl = document.getElementById('countdown-value-inline'), cdDispEl = document.getElementById('countdown-display');
    if (currentDebate.currentPhase === 'COUNTDOWN_TO_ARGUE') { if (!cdDispEl) { const newCdEl = document.createElement('div'); newCdEl.id = 'countdown-display'; newCdEl.classList.add('countdown-display-class'); newCdEl.innerHTML = `Mulai dalam: <span id="countdown-value">${currentDebate.countdownValue}</span>s`; document.body.appendChild(newCdEl); newCdEl.style.display='flex';} else { cdDispEl.style.display='flex';} if(cdValEl)cdValEl.textContent=String(currentDebate.countdownValue); if(cdValInlineEl)cdValInlineEl.textContent=String(currentDebate.countdownValue); }
    else if (cdDispEl) cdDispEl.style.display = 'none';
}

function getArgumentPrompt(role: PlayerRole, turn: number): string {
    if (role === 'Proposisi') return turn === 1 ? "Argumen Pembuka (dukung mosi):" : "Sanggahan Balik (balas Oposisi, perkuat argumen):";
    return turn === 2 ? "Sanggahan (tentang argumen Proposisi):" : "Pernyataan Penutup (rangkum poin Oposisi):";
}

function renderArgumentHistory() {
    const container = document.getElementById('argument-history-container'); if (!container || !currentDebate) return;
    container.innerHTML = currentDebate.arguments.length === 0 ? '<p style="text-align:center; color:#777;">Belum ada argumen.</p>' : '';
    currentDebate.arguments.forEach(arg => {
        const bubble = document.createElement('div'); bubble.classList.add('argument-bubble', arg.playerId === 'player' ? 'player' : 'opponent');
        let turnName = arg.role === 'Proposisi' ? (arg.turn === 1 ? 'Pembuka' : 'Sanggahan Balik') : (arg.turn === 2 ? 'Sanggahan' : 'Penutup');
        
        // Per-argument analysis is NOT displayed here anymore. It's only in results.
        let argTextHTML = `<p style="white-space: pre-wrap;">${arg.text}</p>`;

        bubble.innerHTML = `<strong>${arg.role} (${arg.playerId==='player'?currentDebate!.player.name:currentDebate!.aiOpponent.name}) - ${turnName} (G-${arg.turn}):</strong>${argTextHTML}`;
        container.appendChild(bubble);
    }); container.scrollTop = container.scrollHeight; 
}

function renderGameResults() {
    if (!currentDebate || !resultsMotion || !resultsWinner || !resultsAnalysisText || !resultsTableBody) return;
    resultsMotion.textContent = currentDebate.motion || "N/A";
    let winnerText = currentDebate.winner || "N/A"; let winnerClass = 'error'; 
    if (currentDebate.winner === currentDebate.player.name) winnerClass = 'player-win';
    else if (currentDebate.winner === currentDebate.aiOpponent.name) winnerClass = 'ai-win';
    else if (currentDebate.winner === 'Seri') winnerClass = 'draw';
    resultsWinner.textContent = winnerText; resultsWinner.className = `winner-text ${winnerClass}`;
    resultsAnalysisText.innerHTML = (currentDebate.analysis || "N/A").replace(/\n/g, "<br>"); // Use innerHTML for line breaks
    resultsTableBody.innerHTML = ''; 
    const pIsProp = currentDebate.player.role === 'Proposisi';
    const propS = pIsProp ? currentDebate.playerScores : currentDebate.aiScores; const oppS = pIsProp ? currentDebate.aiScores : currentDebate.playerScores;
    const propN = pIsProp ? currentDebate.player.name : currentDebate.aiOpponent.name; const oppN = pIsProp ? currentDebate.aiOpponent.name : currentDebate.player.name;
    [{r:'Proposisi',n:propN,t:'Pembuka',tn:1,s:propS},{r:'Oposisi',n:oppN,t:'Sanggahan',tn:2,s:oppS},{r:'Proposisi',n:propN,t:'Sanggahan Balik',tn:3,s:propS},{r:'Oposisi',n:oppN,t:'Penutup',tn:4,s:oppS}].forEach(d=>{
        const arg = currentDebate!.arguments.find(a => a.role === d.r && a.turn === d.tn); const row = resultsTableBody.insertRow();
        row.insertCell().textContent = `${d.r} (${d.n})`; row.insertCell().textContent = d.t; const ac = row.insertCell(); ac.textContent = arg?arg.text:"N/A"; ac.classList.add('argument-col');
        
        const analysisCell = row.insertCell(); // New cell for per-argument analysis
        if (arg?.analysis) {
            analysisCell.textContent = arg.analysis;
            analysisCell.classList.add('analysis-col');
        } else {
             analysisCell.textContent = "-";
             analysisCell.classList.add('analysis-col');
        }

        row.insertCell().textContent = (d.s?.logic?.toFixed(1)) ?? "-"; 
        row.insertCell().textContent = (d.s?.rhetoric?.toFixed(1)) ?? "-"; 
        row.insertCell().textContent = (d.s?.relevance?.toFixed(1)) ?? "-";
    });
}

// --- Timer Functions ---
function clearAllTimers() { Object.values(activeTimers).forEach(timerId => clearInterval(timerId)); activeTimers = {}; const cd = document.getElementById('countdown-display'); if (cd) cd.style.display = 'none'; }
function startCountdownTimer(duration:number,onEnd:()=>void){ clearAllTimers();if(!currentDebate)return;currentDebate.countdownValue=duration;const cdD=document.getElementById('countdown-display'),cdV=document.getElementById('countdown-value'),cdVI=document.getElementById('countdown-value-inline');if(cdD){cdD.style.display='flex';if(cdV)cdV.textContent=String(currentDebate.countdownValue);}if(cdVI)cdVI.textContent=String(currentDebate.countdownValue);activeTimers.countdown=window.setInterval(()=>{if(!currentDebate){clearAllTimers();return}currentDebate.countdownValue--;if(cdV)cdV.textContent=String(currentDebate.countdownValue);if(cdVI)cdVI.textContent=String(currentDebate.countdownValue);if(currentDebate.countdownValue<=0){clearAllTimers();onEnd()}},1000)}
function startArgumentTimer(duration:number,onEnd:(arg?:string)=>void){clearAllTimers();if(!currentDebate)return;currentDebate.timerValue=duration;const tVS=document.getElementById('timer-value-span');if(tVS)tVS.textContent=formatTime(currentDebate.timerValue);activeTimers.argument=window.setInterval(()=>{if(!currentDebate){clearAllTimers();return}currentDebate.timerValue--;if(tVS)tVS.textContent=formatTime(currentDebate.timerValue);if(currentDebate.timerValue<=0){clearAllTimers();onEnd((document.getElementById('argument-textarea')as HTMLTextAreaElement)?.value||"Waktu habis.")}},1000)}
function startReadingTimer(duration:number,onEnd:()=>void){clearAllTimers();if(!currentDebate)return;currentDebate.timerValue=duration;const tVS=document.getElementById('timer-value-span');if(tVS)tVS.textContent=formatTime(currentDebate.timerValue);activeTimers.reading=window.setInterval(()=>{if(!currentDebate){clearAllTimers();return}currentDebate.timerValue--;if(tVS)tVS.textContent=formatTime(currentDebate.timerValue);if(currentDebate.timerValue<=0){clearAllTimers();onEnd()}},1000)}
function formatTime(s:number):string{const m=Math.floor(s/60);const sec=s%60;return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}

// --- LocalStorage for Game History ---
function saveGameToHistory(debate: GameHistoryItem) { 
    if(!debate.winner) return; if (!debate.endTime) debate.endTime = Date.now();
    const existingIndex = gameHistory.findIndex(item => item.id === debate.id);
    if (existingIndex > -1) gameHistory[existingIndex] = debate; else gameHistory.unshift(debate); 
    if (gameHistory.length > 20) gameHistory.length = 20; 
    try { localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(gameHistory)); } catch (e) { console.error("Error saving history:", e); }
    const activeSection = document.querySelector<HTMLElement>('.page-section[style*="display: flex"]');
    if (activeSection?.id === 'riwayat') renderRiwayat(); if (activeSection?.id === 'statistik') renderStatistik();
}
function loadGameHistory() { try { const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY); if (stored) gameHistory = JSON.parse(stored); } catch (e) { console.error("Error loading history:", e); gameHistory = []; } }

App();