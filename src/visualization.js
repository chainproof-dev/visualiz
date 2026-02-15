import * as THREE from 'three';
import { themeConfig, extensionColorCache, FILE_TYPE_COLORS } from './constants.js';
import {
    state, layoutNodes, treeGroup, edgeLines, effectiveParentMap, skippedFolders,
    setEdgeLines, setForceSimulationActive, setLayoutAlpha, layoutAlpha
} from './state.js';

// ==================== Extension Color ====================
export function getExtensionColor(filename) {
    if (!themeConfig.extensionColors) return '#ffffff';

    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';

    if (!ext) return '#aaaaaa'; // No extension

    if (extensionColorCache.has(ext)) {
        return extensionColorCache.get(ext);
    }

    // Generate vibrant color using Golden Ratio hash
    let hash = 0;
    for (let i = 0; i < ext.length; i++) {
        hash = ext.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Gource style: map hash to hue, high saturation/lightness
    const hue = Math.abs(hash % 360);
    const color = `hsl(${hue}, 80%, 60%)`;

    extensionColorCache.set(ext, color);
    return color;
}

export function getFileColor(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    return FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.default;
}

// ==================== Node Meshes ====================
export function createNodeMesh(node) {
    const isDir = !node.isFile;
    const size = isDir ? 8 : 4;
    // Use configured directory color or extension color
    let colorVal;
    if (isDir) {
        colorVal = themeConfig.dirColor;
    } else {
        colorVal = getExtensionColor(node.path);
    }
    const color = new THREE.Color(colorVal);

    const geometry = new THREE.CircleGeometry(size, isDir ? 32 : 16);
    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0 // Start invisible
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { isNode: true, path: node.path, isFile: node.isFile, isDir };

    return mesh;
}

export function addFileToVisualization(path) {
    const node = layoutNodes.get(path);
    if (!node || node.visible) return;

    // Also add parent directories (skip compressed folders)
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join('/');
        // Skip compressed folders - they don't get visibility or mesh
        if (skippedFolders.has(parentPath)) continue;

        const parentNode = layoutNodes.get(parentPath);
        if (parentNode && !parentNode.visible) {
            parentNode.visible = true;
            if (!parentNode.mesh) {
                parentNode.mesh = createNodeMesh(parentNode);
                parentNode.mesh.position.copy(parentNode.position);
                treeGroup.add(parentNode.mesh);
            }
            animateNodeIn(parentNode.mesh);
        }
    }

    node.visible = true;
    if (!node.mesh) {
        node.mesh = createNodeMesh(node);
        node.mesh.position.copy(node.position);
        treeGroup.add(node.mesh);
    }
    animateNodeIn(node.mesh);

    state.visibleFiles.add(path);
    setForceSimulationActive(true);
    setLayoutAlpha(Math.max(layoutAlpha, 0.5));
}

export function removeFileFromVisualization(path) {
    const node = layoutNodes.get(path);
    if (!node || !node.visible) return;

    node.visible = false;
    if (node.mesh) {
        animateNodeOut(node.mesh, () => {
            treeGroup.remove(node.mesh);
            node.mesh = null;
        });
    }

    state.visibleFiles.delete(path);
}

export function animateNodeIn(mesh) {
    // Hide folder nodes - only show files
    const isDir = mesh.userData.isDir;
    if (isDir) {
        mesh.material.opacity = 0;
        mesh.scale.setScalar(0);
        return;
    }

    mesh.scale.setScalar(0.1);
    mesh.material.opacity = 0;

    const startTime = performance.now();
    const duration = 300;

    function animate() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);

        mesh.scale.setScalar(0.1 + eased * 0.9);
        mesh.material.opacity = eased * 1.0;

        if (t < 1) requestAnimationFrame(animate);
    }
    animate();
}

export function animateNodeOut(mesh, onComplete) {
    const startTime = performance.now();
    const duration = 200;

    function animate() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        mesh.scale.setScalar(1 - t * 0.9);
        mesh.material.opacity = (1 - t) * 1.0;

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            onComplete();
        }
    }
    animate();
}

export function updateEdgeLines() {
    // 1. Find folders to render (walk up effectiveParentMap from visible files)
    const foldersToRender = new Set();
    const files = Array.from(layoutNodes.values()).filter(n => n.visible && n.isFile);

    for (const file of files) {
        // Walk up the effective parent chain (skips compressed folders)
        let current = effectiveParentMap.get(file.path);
        while (current !== undefined && current !== '') {
            foldersToRender.add(current);
            current = effectiveParentMap.get(current);
        }
    }
    foldersToRender.add(''); // root always included

    // 2. Clean up old lines
    for (const line of edgeLines) {
        treeGroup.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    }
    setEdgeLines([]);

    // 3. Draw edges: from each folder to its effectiveParent
    const newEdgeLines = [];
    for (const folderPath of foldersToRender) {
        if (folderPath === '') continue;

        const node = layoutNodes.get(folderPath);
        if (!node || !node.visible) continue;

        const effectiveParent = effectiveParentMap.get(folderPath);
        if (effectiveParent === undefined) continue;

        const source = layoutNodes.get(effectiveParent);
        if (!source) continue;
        if (!source.visible && effectiveParent !== '') continue;

        const geometry = new THREE.BufferGeometry().setFromPoints([
            source.position,
            node.position
        ]);
        const material = new THREE.LineBasicMaterial({
            color: 0x6080b0,
            transparent: true,
            opacity: 1.0
        });
        const line = new THREE.Line(geometry, material);
        treeGroup.add(line);
        newEdgeLines.push(line);
    }
    setEdgeLines(newEdgeLines);
}
