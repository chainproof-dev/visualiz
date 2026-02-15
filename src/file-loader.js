import { state } from './state.js';
import { parseGitLog } from './git-parser.js';
import { buildTreeFromCommits, collectAuthors } from './tree-builder.js';
import { initForceLayout } from './force-layout.js';
import { showLoading, hideLoading, setProgress, showError } from './ui.js';
import { jumpToCommit } from './playback.js';

// ==================== File Loading ====================
export function loadFile(file) {
    showLoading('Reading file...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            processFileContent(content);
        } catch (error) {
            hideLoading();
            showError('Failed to parse file: ' + error.message);
        }
    };
    reader.onerror = () => {
        hideLoading();
        showError('Failed to read file');
    };
    reader.readAsText(file);
}

function processFileContent(content) {
    showLoading('Parsing git history...');
    setProgress(20);

    setTimeout(() => {
        const commits = parseGitLog(content);

        if (commits.length === 0) {
            hideLoading();
            showError('No commits found. Make sure you used the correct git command.');
            return;
        }

        setProgress(50);
        showLoading(`Found ${commits.length} commits...`);

        state.commits = commits;
        const tree = buildTreeFromCommits(commits);
        state.authors = collectAuthors(commits);

        setProgress(70);
        showLoading('Building visualization...');

        initForceLayout(tree);

        document.getElementById('stat-commits').textContent = state.commits.length;
        document.getElementById('stat-authors').textContent = state.authors.size;

        setProgress(100);

        setTimeout(() => {
            document.getElementById('intro-screen').classList.add('hidden');
            document.getElementById('stats-panel').style.display = 'block';
            document.getElementById('commit-panel').style.display = 'block';
            document.getElementById('control-panel').style.display = 'block';
            document.getElementById('reset-btn').style.display = 'block';

            hideLoading();

            if (state.commits.length > 0) {
                state.currentCommitIndex = -1;
                jumpToCommit(0);
            }
        }, 300);
    }, 100);
}
