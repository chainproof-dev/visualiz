import {
    state, layoutNodes, treeGroup, edgeLines,
    skippedFolders, setForceSimulationActive, setLayoutAlpha, setEdgeLines
} from './state.js';
import { addFileToVisualization, removeFileFromVisualization, createNodeMesh, updateEdgeLines } from './visualization.js';
import { showAuthorForFiles } from './authors.js';
import { createLaserBeam } from './laser-beams.js';

// ==================== Playback ====================
export function updatePlayback(deltaTime) {
    state.timeSinceLastCommit += deltaTime * state.playSpeed;

    const commitDuration = 0.5;

    if (state.timeSinceLastCommit >= commitDuration) {
        state.timeSinceLastCommit = 0;

        // Find next commit with file changes (skip empty commits)
        let nextIndex = state.currentCommitIndex + 1;
        while (nextIndex < state.commits.length && state.commits[nextIndex].files.length === 0) {
            nextIndex++;
        }

        if (nextIndex >= state.commits.length) {
            state.currentCommitIndex = state.commits.length - 1;
            state.isPlaying = false;
            document.getElementById('play-btn').textContent = '▶';
            return;
        }

        state.currentCommitIndex = nextIndex;
        processCommit(state.commits[state.currentCommitIndex]);
        updateUI();
    }
}

export function processCommit(commit) {
    const avatarEl = document.getElementById('author-avatar');
    avatarEl.textContent = commit.author.name[0].toUpperCase();
    avatarEl.style.background = '';

    const author = state.authors.get(commit.author.email);
    if (author) {
        const color = author.color;
        avatarEl.style.background = `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`;
    }

    document.getElementById('author-name').textContent = commit.author.name;
    document.getElementById('commit-message').textContent = commit.message;

    const filesEl = document.getElementById('commit-files');
    filesEl.innerHTML = '';
    const maxFiles = 5;
    const files = commit.files.slice(0, maxFiles);

    // Calculate commit totals
    let commitAdded = 0;
    let commitDeleted = 0;
    for (const file of commit.files) {
        commitAdded += file.linesAdded || 0;
        commitDeleted += file.linesDeleted || 0;
    }

    for (const file of files) {
        const div = document.createElement('div');
        div.className = `file-change ${file.status}`;

        const fileName = document.createElement('span');
        fileName.textContent = file.path.split('/').pop();
        div.appendChild(fileName);

        // Only show line stats if we have actual data (not from old name-status format)
        if (file.linesAdded > 0 || file.linesDeleted > 0) {
            const stats = document.createElement('span');
            stats.className = 'line-stats';
            const parts = [];
            if (file.linesAdded > 0) parts.push(`<span class="added">+${file.linesAdded}</span>`);
            if (file.linesDeleted > 0) parts.push(`<span class="deleted">-${file.linesDeleted}</span>`);
            stats.innerHTML = parts.join(' ');
            div.appendChild(stats);
        }

        filesEl.appendChild(div);
    }
    if (commit.files.length > maxFiles) {
        const div = document.createElement('div');
        div.className = 'file-change';
        div.textContent = `+${commit.files.length - maxFiles} more`;
        div.style.opacity = '0.6';
        filesEl.appendChild(div);
    }

    // Add commit summary (only show non-zero values)
    if (commitAdded > 0 || commitDeleted > 0) {
        const summary = document.createElement('div');
        summary.className = 'commit-line-summary';
        const parts = [];
        if (commitAdded > 0) parts.push(`<span class="added">+${commitAdded}</span>`);
        if (commitDeleted > 0) parts.push(`<span class="deleted">-${commitDeleted}</span>`);
        summary.innerHTML = parts.join(' ');
        filesEl.appendChild(summary);
    }

    // Update cumulative totals (only during playback, jumpToCommit recalculates)
    state.totalLinesAdded += commitAdded;
    state.totalLinesDeleted += commitDeleted;
    document.getElementById('stat-lines-added').textContent = state.totalLinesAdded.toLocaleString();
    document.getElementById('stat-lines-deleted').textContent = state.totalLinesDeleted.toLocaleString();

    const activeFiles = [];  // Collect active file nodes for author positioning

    for (const file of commit.files) {
        const node = layoutNodes.get(file.path);
        if (!node) continue;

        if (file.status === 'added' || file.status === 'modified' || file.status === 'renamed') {
            addFileToVisualization(file.path);
            if (node.visible && node.isFile) {
                activeFiles.push(node);
            }
        } else if (file.status === 'deleted') {
            // Create delete laser before removing (need node position)
            if (author && node.visible) {
                createLaserBeam(author, node, true);  // true = delete laser (fixed position)
            }
            removeFileFromVisualization(file.path);
        }
    }

    // Update author position once based on all files (using median for outlier resistance)
    if (author && activeFiles.length > 0) {
        showAuthorForFiles(author, activeFiles);
    }
}

export function updateUI() {
    const commit = state.commits[state.currentCommitIndex];
    if (!commit) return;

    // Gource-style long date: "Monday, 15 February, 2026"
    const dateOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };
    const longDate = commit.timestamp.toLocaleDateString('en-US', dateOptions);

    // Update date display (top-center, Gource-style)
    const dateDisplay = document.getElementById('date-display');
    if (dateDisplay) {
        dateDisplay.textContent = longDate;
        dateDisplay.classList.add('visible');
    }

    document.getElementById('timeline-date').textContent = commit.timestamp.toLocaleDateString();
    document.getElementById('timeline-commit').textContent =
        `Commit ${state.currentCommitIndex + 1} / ${state.commits.length}`;

    const slider = document.getElementById('timeline-slider');
    slider.max = state.commits.length - 1;
    slider.value = state.currentCommitIndex;

    document.getElementById('stat-commits').textContent = `${state.currentCommitIndex + 1} / ${state.commits.length}`;
    document.getElementById('stat-files').textContent = state.visibleFiles.size;
    document.getElementById('stat-lines-added').textContent = state.totalLinesAdded.toLocaleString();
    document.getElementById('stat-lines-deleted').textContent = state.totalLinesDeleted.toLocaleString();
}

export function jumpToCommit(index) {
    for (const node of layoutNodes.values()) {
        if (node.mesh) {
            treeGroup.remove(node.mesh);
            node.mesh = null;
        }
        node.visible = false;
    }
    state.visibleFiles.clear();

    for (const line of edgeLines) {
        treeGroup.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    }
    setEdgeLines([]);

    for (let i = 0; i <= index; i++) {
        const commit = state.commits[i];
        for (const file of commit.files) {
            if (file.status === 'added' || file.status === 'modified' || file.status === 'renamed') {
                const node = layoutNodes.get(file.path);
                if (node) {
                    // Set parent folders visible (skip compressed folders)
                    const parts = file.path.split('/');
                    for (let j = 0; j < parts.length; j++) {
                        const parentPath = parts.slice(0, j).join('/');
                        if (skippedFolders.has(parentPath)) continue;
                        const parentNode = layoutNodes.get(parentPath);
                        if (parentNode) parentNode.visible = true;
                    }
                    node.visible = true;
                    state.visibleFiles.add(file.path);
                }
            } else if (file.status === 'deleted') {
                const node = layoutNodes.get(file.path);
                if (node) {
                    node.visible = false;
                    state.visibleFiles.delete(file.path);
                }
            }
        }
    }

    // Create meshes for visible nodes (skip compressed folders)
    for (const node of layoutNodes.values()) {
        if (node.visible && !node.mesh) {
            // Only create mesh for files and non-skipped folders
            if (node.isFile || !skippedFolders.has(node.path)) {
                node.mesh = createNodeMesh(node);
                node.mesh.position.copy(node.position);
                // Only show files, hide folder nodes
                if (node.isFile) {
                    node.mesh.material.opacity = 1.0;
                } else {
                    node.mesh.material.opacity = 0;
                    node.mesh.scale.setScalar(0);
                }
                treeGroup.add(node.mesh);
            }
        }
    }

    updateEdgeLines();
    setForceSimulationActive(true);
    setLayoutAlpha(0.5);

    // Recalculate cumulative line stats up to (but not including) this commit
    // processCommit will add the current commit's stats
    state.totalLinesAdded = 0;
    state.totalLinesDeleted = 0;
    for (let i = 0; i < index; i++) {
        for (const file of state.commits[i].files) {
            state.totalLinesAdded += file.linesAdded || 0;
            state.totalLinesDeleted += file.linesDeleted || 0;
        }
    }

    state.currentCommitIndex = index;
    state.timeSinceLastCommit = 0;
    updateUI();

    if (state.commits[index]) {
        processCommit(state.commits[index]);
    }
}
