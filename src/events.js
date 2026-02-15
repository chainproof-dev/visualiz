import { state } from './state.js';
import { loadFile } from './file-loader.js';
import { jumpToCommit } from './playback.js';

// ==================== Event Listeners ====================
export function initEvents() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            loadFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadFile(e.target.files[0]);
        }
    });

    // Copy command
    document.getElementById('command-text').addEventListener('click', async () => {
        const command = document.getElementById('command-text').textContent;
        try {
            await navigator.clipboard.writeText(command);
            const feedback = document.getElementById('copy-feedback');
            feedback.classList.add('show');
            setTimeout(() => feedback.classList.remove('show'), 1500);
        } catch (e) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = command;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    });

    // Play button
    document.getElementById('play-btn').addEventListener('click', () => {
        if (state.commits.length === 0) return;

        state.isPlaying = !state.isPlaying;
        document.getElementById('play-btn').textContent = state.isPlaying ? '⏸' : '▶';

        if (state.isPlaying) {
            state.lastFrameTime = performance.now();
            state.timeSinceLastCommit = 0;
        }

        if (state.currentCommitIndex >= state.commits.length - 1 && state.isPlaying) {
            jumpToCommit(0);
        }
    });

    // Timeline slider
    document.getElementById('timeline-slider').addEventListener('input', (e) => {
        const index = parseInt(e.target.value);
        state.isPlaying = false;
        document.getElementById('play-btn').textContent = '▶';
        jumpToCommit(index);
    });

    // Speed buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.playSpeed = parseFloat(btn.dataset.speed);
        });
    });

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        location.reload();
    });
}
