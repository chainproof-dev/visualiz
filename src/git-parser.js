// ==================== Git Log Parser ====================
export function parseGitLog(content) {
    // Normalize line endings: CRLF → LF, CR → LF (Windows compatibility)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    const commits = [];
    let currentCommit = null;

    for (const line of lines) {
        if (line.startsWith('COMMIT|')) {
            // Save previous commit
            if (currentCommit) {
                commits.push(currentCommit);
            }

            // Parse new commit
            const parts = line.split('|');
            if (parts.length >= 6) {
                currentCommit = {
                    sha: parts[1],
                    author: {
                        name: parts[2],
                        email: parts[3]
                    },
                    timestamp: new Date(parts[4]),
                    message: parts.slice(5).join('|'), // In case message contains |
                    files: []
                };
            }
        } else if (currentCommit && line.trim()) {
            // Try numstat format first (e.g., "10\t5\tsrc/file.js" or "-\t-\tbinary.png")
            const numstatMatch = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
            const statusMatch = line.match(/^([AMDR])\t(.+)$/); // For --name-status format

            if (numstatMatch) {
                const added = numstatMatch[1] === '-' ? 0 : parseInt(numstatMatch[1], 10);
                const deleted = numstatMatch[2] === '-' ? 0 : parseInt(numstatMatch[2], 10);
                let path = numstatMatch[3];

                // Handle renames: "old => new" or "prefix{old => new}suffix"
                if (path.includes(' => ')) {
                    // Handle {old => new} pattern - can appear anywhere in path
                    // e.g., "{scripts/compute => compute}/file.py" -> "compute/file.py"
                    // e.g., "src/{old => new}.js" -> "src/new.js"
                    while (path.includes('{') && path.includes(' => ')) {
                        path = path.replace(/\{[^{}]* => ([^{}]*)\}/, '$1');
                    }
                    // Handle simple "old => new" pattern (full path rename)
                    if (path.includes(' => ')) {
                        path = path.split(' => ').pop();
                    }
                }

                // Infer status from line changes (heuristic)
                let status = 'modified';
                if (added > 0 && deleted === 0) {
                    status = 'added';  // Likely a new file
                } else if (added === 0 && deleted > 0) {
                    status = 'deleted';  // Likely a deleted file
                }

                currentCommit.files.push({
                    path: path,
                    status: status,
                    linesAdded: added,
                    linesDeleted: deleted
                });
                continue;
            }

            // Fallback: try name-status format (e.g., "M\tsrc/file.js") for backward compatibility
            const nameStatusMatch = line.match(/^([AMDRT])\d*\t(.+)$/);
            if (nameStatusMatch) {
                const statusMap = {
                    'A': 'added',
                    'M': 'modified',
                    'D': 'deleted',
                    'R': 'renamed',
                    'T': 'modified'
                };
                let path = nameStatusMatch[2];
                // Handle renames (old\tnew) - take the new path
                if (path.includes('\t')) {
                    path = path.split('\t').pop();
                }

                currentCommit.files.push({
                    path: path,
                    status: statusMap[nameStatusMatch[1]] || 'modified',
                    linesAdded: 0,
                    linesDeleted: 0
                });
            }
        }
    }

    // Don't forget the last commit
    if (currentCommit) {
        commits.push(currentCommit);
    }

    return commits;
}
