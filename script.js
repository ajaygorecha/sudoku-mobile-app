/**
 * Sudoku Game Logic
 * Contains Generator, Game State Management, and UI Interaction
 */

// --- Constants & Config ---
const DIFFICULTY = {
    easy: { removed: 30, multiplier: 1 },
    medium: { removed: 40, multiplier: 1.5 },
    hard: { removed: 50, multiplier: 2 },
    expert: { removed: 55, multiplier: 3 } // Hidden option if needed, or just handle 3
};

const HINT_COST = 50;
const MAX_MISTAKES = 3;

// --- State Management ---
let state = {
    grid: [],         // The current state of the grid (0 for empty)
    solution: [],     // The full solved grid
    initial: [],      // The grid state at start (to know which are fixed)
    notes: [],        // 9x9 array of Sets/Arrays for notes
    selectedCell: null, // {r, c}
    score: 0,
    timer: 0,
    timerInterval: null,
    mistakes: 0,
    level: 'easy',
    isNoteMode: false,
    history: [],      // For Undo: {type: 'input'|'note', r, c, val, prevVal}
    isPaused: false,
    isGameOver: false
};

// --- Sudoku Generator Class ---
class SudokuGenerator {
    constructor() {
        this.grid = Array.from({ length: 9 }, () => Array(9).fill(0));
    }

    isValid(grid, row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (grid[row][x] === num) return false;
            if (grid[x][col] === num) return false;
        }
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[startRow + i][startCol + j] === num) return false;
            }
        }
        return true;
    }

    fillGrid(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
                    for (let num of nums) {
                        if (this.isValid(grid, row, col, num)) {
                            grid[row][col] = num;
                            if (this.fillGrid(grid)) return true;
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    generate(difficulty) {
        // Reset
        this.grid = Array.from({ length: 9 }, () => Array(9).fill(0));
        // Fill Diagonal 3x3 boxes first (independent) for randomness
        for (let i = 0; i < 9; i = i + 3) {
            this.fillBox(i, i);
        }
        // Fill rest
        this.fillGrid(this.grid);

        const solution = JSON.parse(JSON.stringify(this.grid));

        // Remove numbers
        const attempts = DIFFICULTY[difficulty] ? DIFFICULTY[difficulty].removed : 30;
        let count = attempts;
        while (count > 0) {
            let r = Math.floor(Math.random() * 9);
            let c = Math.floor(Math.random() * 9);
            if (this.grid[r][c] !== 0) {
                this.grid[r][c] = 0;
                count--;
            }
        }

        return {
            initial: JSON.parse(JSON.stringify(this.grid)),
            solution: solution
        };
    }

    fillBox(row, col) {
        let num;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                do {
                    num = Math.floor(Math.random() * 9) + 1;
                } while (!this.isSafeBox(row, col, num));
                this.grid[row + i][col + j] = num;
            }
        }
    }

    isSafeBox(rowStart, colStart, num) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.grid[rowStart + i][colStart + j] === num) return false;
            }
        }
        return true;
    }
}

// --- Game Control ---

function initGame() {
    loadState(); // Check if saved game exists
    // If no saved game or starting fresh handled by UI
}

function startGame(level) {
    state.level = level;
    state.score = 0;
    state.mistakes = 0;
    state.timer = 0;
    state.isGameOver = false;
    state.isPaused = false;
    state.history = [];
    state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

    const generator = new SudokuGenerator();
    const data = generator.generate(level);

    state.initial = data.initial;
    state.grid = JSON.parse(JSON.stringify(data.initial));
    state.solution = data.solution;

    // Clear previous save
    localStorage.removeItem('sudoku_save');

    showScreen('game-screen');
    renderBoard();
    updateStats();
    startTimer();
}

function resumeGame() {
    const saved = localStorage.getItem('sudoku_save');
    if (saved) {
        state = JSON.parse(saved);
        // Date objects or sets need re-parsing if used, but we use simple arrays
        // Re-start timer

        // Ensure notes are valid arrays
        if (!state.notes) state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

        showScreen('game-screen');
        renderBoard();
        updateStats();
        startTimer();
    }
}

function saveGame() {
    if (!state.isGameOver) {
        localStorage.setItem('sudoku_save', JSON.stringify(state));
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'home-screen') {
        checkResumeAvailable();
    }
}

function checkResumeAvailable() {
    const saved = localStorage.getItem('sudoku_save');
    const resumeBtn = document.getElementById('resume-btn-container');
    if (saved) {
        resumeBtn.style.display = 'block';
    } else {
        resumeBtn.style.display = 'none';
    }
}

function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
        if (!state.isPaused && !state.isGameOver) {
            state.timer++;
            document.getElementById('timer').textContent = formatTime(state.timer);
            if (state.timer % 10 === 0) saveGame(); // Auto-save periodically
        }
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// --- UI Rendering ---

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    // Count current numbers to update numpad
    const counts = Array(10).fill(0);

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.r = r;
            cell.dataset.c = c;

            // Grid lines classes
            if (c === 2 || c === 5) cell.classList.add('box-right');
            if (r === 2 || r === 5) cell.classList.add('box-bottom');

            // Value or Notes
            const val = state.grid[r][c];
            if (val !== 0) {
                cell.textContent = val;
                counts[val]++;
                if (state.initial[r][c] !== 0) {
                    cell.classList.add('fixed');
                } else {
                    cell.classList.add('editable');
                }
            } else {
                // Render Notes
                const notes = state.notes[r][c];
                if (notes && notes.length > 0) {
                    const noteContainer = document.createElement('div');
                    noteContainer.className = 'cell-notes';
                    for (let i = 1; i <= 9; i++) {
                        const noteEl = document.createElement('div');
                        noteEl.className = 'note-num';
                        if (notes.includes(i)) noteEl.textContent = i;
                        noteContainer.appendChild(noteEl);
                    }
                    cell.appendChild(noteContainer);
                }
            }

            cell.onclick = () => selectCell(r, c);
            board.appendChild(cell);
        }
    }
    highlightBoard();
    updateNumpad(counts);
}

function updateNumpad(counts) {
    const btns = document.querySelectorAll('.numpad-btn');
    btns.forEach((btn, index) => {
        const num = index + 1;
        if (counts[num] >= 9) {
            btn.classList.add('completed');
        } else {
            btn.classList.remove('completed');
        }
    });
}


function highlightBoard() {
    // Clear highlights
    document.querySelectorAll('.sudoku-cell').forEach(c => {
        c.classList.remove('selected', 'related', 'same-num', 'error');
    });

    if (!state.selectedCell) return;
    const { r, c } = state.selectedCell;
    const val = state.grid[r][c];

    // Select grid cells
    const cells = document.querySelectorAll('.sudoku-cell');

    cells.forEach(cell => {
        const tr = parseInt(cell.dataset.r);
        const tc = parseInt(cell.dataset.c);
        const tval = state.grid[tr][tc];

        // Selected
        if (tr === r && tc === c) {
            cell.classList.add('selected');
        }
        // Related (Row, Col, Box)
        else if (tr === r || tc === c || (Math.floor(tr / 3) === Math.floor(r / 3) && Math.floor(tc / 3) === Math.floor(c / 3))) {
            cell.classList.add('related');
        }

        // Same Number
        if (val !== 0 && tval === val) {
            cell.classList.add('same-num');
        }
    });
}

function selectCell(r, c) {
    if (state.isGameOver) return;
    state.selectedCell = { r, c };
    highlightBoard();
}

// --- Interaction ---

function inputNumber(num) {
    if (state.isGameOver || !state.selectedCell) return;
    const { r, c } = state.selectedCell;

    // Cannot edit initial cells
    if (state.initial[r][c] !== 0) return;

    if (state.isNoteMode) {
        toggleNoteValue(r, c, num);
    } else {
        // Normal Input
        const prevVal = state.grid[r][c];
        if (prevVal === num) return; // No change

        // Save history
        addToHistory({ type: 'input', r, c, val: num, prevVal });

        state.grid[r][c] = num;

        // Validate Move
        if (num !== 0) {
            if (num !== state.solution[r][c]) {
                // Mistake
                handleMistake(r, c);
            } else {
                // Correct
                checkCompletion();
                clearNotesForMove(r, c, num);
            }
        }

        renderBoard();
        saveGame();
    }
}

function handleMistake(r, c) {
    state.mistakes++;
    document.getElementById('mistake-count').textContent = state.mistakes;

    // Vibrate / Shake effect (Can add class)
    const cellIdx = r * 9 + c;
    const cell = document.querySelectorAll('.sudoku-cell')[cellIdx];
    cell.classList.add('error');
    setTimeout(() => cell.classList.remove('error'), 500);

    if (state.mistakes >= MAX_MISTAKES) {
        gameOver(false);
    } else {
        // Penalty?
        state.score = Math.max(0, state.score - 50);
        updateStats();
    }
}

function addToHistory(action) {
    if (state.history.length > 20) state.history.shift(); // Limit history
    state.history.push(action);
}

function undo() {
    if (state.history.length === 0 || state.isGameOver) return;
    const action = state.history.pop();

    if (action.type === 'input') {
        state.grid[action.r][action.c] = action.prevVal;
    } else if (action.type === 'note') {
        // Just revert notes not Implemented for simplicity in history tracking perfectly yet
        // For now let's just assume input undo. 
        // If we want Note undo, we need to save note state.
        // Let's keep it simple: History only tracks 'input' for now.
    }
    renderBoard();
    selectCell(action.r, action.c);
}

function erase() {
    if (state.isGameOver || !state.selectedCell) return;
    const { r, c } = state.selectedCell;
    if (state.initial[r][c] !== 0) return;

    inputNumber(0); // 0 clears
}

function toggleNotes() {
    state.isNoteMode = !state.isNoteMode;
    const btn = document.getElementById('btn-note');
    const ind = document.getElementById('note-indicator');
    if (state.isNoteMode) {
        btn.classList.add('active');
        ind.style.display = 'inline';
    } else {
        btn.classList.remove('active');
        ind.style.display = 'none';
    }
}

function toggleNoteValue(r, c, num) {
    if (!state.notes[r][c]) state.notes[r][c] = [];
    const idx = state.notes[r][c].indexOf(num);
    if (idx > -1) {
        state.notes[r][c].splice(idx, 1);
    } else {
        state.notes[r][c].push(num);
    }
    renderBoard();
}

function clearNotesForMove(r, c, num) {
    // Basic auto-clear: Clear this number from notes in same Row, Col, Box
    // 1. Clear notes in this cell (it's filled now)
    state.notes[r][c] = [];

    // 2. Remove 'num' from notes in related cells
    // Row
    for (let i = 0; i < 9; i++) {
        removeNote(r, i, num);
    }
    // Col
    for (let i = 0; i < 9; i++) {
        removeNote(i, c, num);
    }
    // Box
    const startRow = Math.floor(r / 3) * 3;
    const startCol = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            removeNote(startRow + i, startCol + j, num);
        }
    }
}

function removeNote(r, c, num) {
    if (state.notes[r][c]) {
        const idx = state.notes[r][c].indexOf(num);
        if (idx > -1) state.notes[r][c].splice(idx, 1);
    }
}

function useHint() {
    if (state.isGameOver) return;

    if (state.score < HINT_COST) {
        alert("Not enough points! Need " + HINT_COST);
        return;
    }

    // Check if cell is selected and empty
    if (!state.selectedCell) {
        // Find a random empty cell
        // Or just alert user to select one
        alert("Select a cell first");
        return;
    }

    const { r, c } = state.selectedCell;
    if (state.grid[r][c] !== 0) {
        alert("Cell already filled");
        return;
    }

    // Apply Hint
    state.score -= HINT_COST;
    state.grid[r][c] = state.solution[r][c];
    state.initial[r][c] = state.solution[r][c]; // Treat hint as fixed? Or just filled correct.
    // If we treat as filled correct, user can't erase it? Let's make it fixed to prevent accidental clear

    renderBoard();
    updateStats();
    checkCompletion();
}

function updateStats() {
    document.getElementById('score').textContent = state.score;
    document.getElementById('mistake-count').textContent = state.mistakes;
    document.getElementById('level-display').textContent = state.level.toUpperCase();
}

function checkCompletion() {
    // Check if full board matches solution
    // Actually we validate on input, so if no zeros left, we win?
    // Generator solution is one unique solution usually.

    let isFull = true;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (state.grid[r][c] === 0) {
                isFull = false;
                break;
            }
        }
    }

    if (isFull) {
        // Double check correctness just in case
        let isCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (state.grid[r][c] !== state.solution[r][c]) {
                    isCorrect = false;
                    break;
                }
            }
        }
        if (isCorrect) gameOver(true);
    }

    // Also give points for correct move?
    state.score += 10;
    updateStats();
}

function gameOver(isWin) {
    state.isGameOver = true;
    stopTimer();
    localStorage.removeItem('sudoku_save');

    const modal = document.getElementById('custom-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    modal.classList.add('show');
    if (isWin) {
        title.textContent = "Victory!";
        title.className = "mb-3 text-success";
        saveHighScore(state.score);
    } else {
        title.textContent = "Game Over";
        title.className = "mb-3 text-danger";
    }

    body.innerHTML = `
        <p class="fs-4">Score: ${state.score}</p>
        <p class="text-muted">Time: ${formatTime(state.timer)}</p>
    `;
}

function pauseGame() {
    if (state.isGameOver) return;
    state.isPaused = true;

    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = "Paused";
    document.getElementById('modal-title').className = "mb-3";

    document.getElementById('modal-body').innerHTML = `
        <button class="btn btn-success rounded-pill px-4" onclick="resumeFromPause()">Resume</button>
    `;

    modal.classList.add('show');
}

function resumeFromPause() {
    state.isPaused = false;
    document.getElementById('custom-modal').classList.remove('show');
}

function showHome() {
    stopTimer();
    showScreen('home-screen');
    document.getElementById('custom-modal').classList.remove('show');
}


// --- High Score System ---
function saveHighScore(score) {
    let scores = JSON.parse(localStorage.getItem('sudoku_highscores')) || [];
    scores.push({
        score: score,
        date: new Date().toLocaleDateString(),
        level: state.level
    });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 5); // Keep top 5
    localStorage.setItem('sudoku_highscores', JSON.stringify(scores));
}

// --- PWA Install ---
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'block';
});

function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((result) => {
        if (result.outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        if (installBtn) installBtn.style.display = 'none';
    });
}

function showHighScores() {
    const scores = JSON.parse(localStorage.getItem('sudoku_highscores')) || [];
    let html = '<ul class="list-group text-start d-inline-block w-100">';
    if (scores.length === 0) {
        html += '<li class="list-group-item text-center">No scores yet!</li>';
    } else {
        scores.forEach((s, i) => {
            html += `<li class="list-group-item d-flex justify-content-between">
                <span>${i + 1}. ${s.level.toUpperCase()}</span>
                <span class="fw-bold">${s.score}</span>
            </li>`;
        });
    }
    html += '</ul>';

    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = "High Scores";
    document.getElementById('modal-body').innerHTML = html;

    // Replace footer with specific close button
    const footer = modal.querySelector('.d-grid');
    footer.innerHTML = `<button class="btn btn-secondary-custom" onclick="closeModal()">Close</button>`;

    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('custom-modal').classList.remove('show');
}

// Initialize
window.addEventListener('load', () => {
    // Basic startup checks
    checkResumeAvailable();
});
