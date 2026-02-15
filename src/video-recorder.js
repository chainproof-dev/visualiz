import { state, layoutNodes } from './state.js';
import { localRenderer, localComposer, cameraState } from './renderer.js';

// ==================== Video Recorder ====================
// One-click download: captures visualization as 60fps WebM video
// Smart duration: auto-adjusts playback speed based on commit count

let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let originalPlaySpeed = 1;
let recordingStartCommitIndex = 0;

// Calculate optimal video duration based on commit count
// Short repos: longer per-commit time. Large repos: compressed.
function calculateVideoDuration(commitCount) {
    if (commitCount <= 50) return 30;        // Small repos: 30s
    if (commitCount <= 200) return 45;       // Medium: 45s
    if (commitCount <= 500) return 60;       // Large: 60s
    if (commitCount <= 2000) return 90;      // Very large: 90s
    return 120;                               // Huge repos: 2min cap
}

// Calculate the playback speed needed to fit all commits into target duration
function calculatePlaySpeed(commitCount, targetDurationSec) {
    const baseCommitDuration = 0.5; // seconds per commit at 1x speed
    const totalTimeAt1x = commitCount * baseCommitDuration;
    const requiredSpeed = totalTimeAt1x / targetDurationSec;
    return Math.max(1, requiredSpeed); // Never slower than 1x
}

export function startVideoDownload() {
    if (isRecording || !localRenderer || state.commits.length === 0) return;

    const canvas = localRenderer.domElement;
    const stream = canvas.captureStream(60); // 60 FPS

    // Try VP9 first, fall back to VP8
    const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];

    let selectedMime = 'video/webm';
    for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
            selectedMime = mime;
            break;
        }
    }

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 8000000 // 8 Mbps for quality
    });

    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };

    mediaRecorder.onstop = () => {
        // Restore original speed
        state.playSpeed = originalPlaySpeed;
        isRecording = false;

        // Create downloadable file
        const blob = new Blob(recordedChunks, { type: selectedMime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `git-visualization-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Update UI
        updateRecordingUI(false);
    };

    // Calculate optimal speed
    const commitCount = state.commits.length;
    const targetDuration = calculateVideoDuration(commitCount);
    const recordSpeed = calculatePlaySpeed(commitCount, targetDuration);

    // Save current state
    originalPlaySpeed = state.playSpeed;
    recordingStartCommitIndex = state.currentCommitIndex;

    // Jump to beginning and set speed
    // Import jumpToCommit dynamically to avoid circular dependency
    import('./playback.js').then(({ jumpToCommit }) => {
        jumpToCommit(0);

        state.playSpeed = recordSpeed;
        state.isPlaying = true;
        document.getElementById('play-btn').textContent = '⏸';

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        isRecording = true;

        updateRecordingUI(true, targetDuration);

        // Monitor for completion
        checkRecordingComplete(targetDuration);
    });
}

function checkRecordingComplete(targetDuration) {
    if (!isRecording) return;

    // Stop when playback reaches the end
    if (state.currentCommitIndex >= state.commits.length - 1 || !state.isPlaying) {
        // Wait a brief moment for the final frame
        setTimeout(() => {
            stopRecording();
        }, 500);
        return;
    }

    requestAnimationFrame(() => checkRecordingComplete(targetDuration));
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

function updateRecordingUI(recording, targetDuration = 0) {
    const btn = document.getElementById('download-btn');
    const indicator = document.getElementById('recording-indicator');

    if (recording) {
        if (btn) {
            btn.textContent = '⏹ Stop';
            btn.classList.add('recording');
        }
        if (indicator) {
            indicator.classList.add('active');
            indicator.querySelector('.recording-text').textContent =
                `Recording (~${targetDuration}s)`;
        }
    } else {
        if (btn) {
            btn.textContent = '⬇ Download';
            btn.classList.remove('recording');
        }
        if (indicator) {
            indicator.classList.remove('active');
        }
    }
}

export function isCurrentlyRecording() {
    return isRecording;
}

// Allow manual stop
export function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startVideoDownload();
    }
}
