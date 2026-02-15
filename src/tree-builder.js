import * as THREE from 'three';

export function buildTreeFromCommits(commits) {
    const allPaths = new Set();

    for (const commit of commits) {
        for (const file of commit.files) {
            allPaths.add(file.path);
            // Also add parent directories
            const parts = file.path.split('/');
            for (let i = 1; i < parts.length; i++) {
                allPaths.add(parts.slice(0, i).join('/'));
            }
        }
    }

    const root = {
        path: '',
        name: 'root',
        isFile: false,
        children: new Map(),
        depth: 0
    };

    for (const path of allPaths) {
        const parts = path.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const currentPath = parts.slice(0, i + 1).join('/');
            const isFile = i === parts.length - 1 && !allPaths.has(currentPath + '/');

            if (!current.children.has(part)) {
                current.children.set(part, {
                    path: currentPath,
                    name: part,
                    isFile: !Array.from(allPaths).some(p => p.startsWith(currentPath + '/')),
                    children: new Map(),
                    depth: i + 1
                });
            }
            current = current.children.get(part);
        }
    }

    return root;
}

export function collectAuthors(commits) {
    const authors = new Map();
    const colors = [
        new THREE.Color(0x00d4ff),
        new THREE.Color(0x7b2dff),
        new THREE.Color(0xff6b9d),
        new THREE.Color(0x00ff88),
        new THREE.Color(0xffaa00),
        new THREE.Color(0xff3366),
        new THREE.Color(0x00ffcc),
        new THREE.Color(0xff8844),
    ];

    let colorIndex = 0;
    for (const commit of commits) {
        const email = commit.author.email;
        if (!authors.has(email)) {
            authors.set(email, {
                name: commit.author.name,
                email,
                color: colors[colorIndex % colors.length],
                sprite: null,
                position: new THREE.Vector3(0, 0, 50),
                targetPosition: new THREE.Vector3(0, 0, 50),
                lastActiveTime: 0
            });
            colorIndex++;
        }
    }

    return authors;
}
