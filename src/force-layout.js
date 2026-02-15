import * as THREE from 'three';
import { SpatialHash } from './spatial-hash.js';
import { FOLDER_DISTANCE, FILE_CLUSTER_RADIUS } from './constants.js';
import {
    layoutNodes, layoutEdges, parentMap, effectiveParentMap, skippedFolders,
    setLayoutNodes, setLayoutEdges, setForceSimulationActive, setLayoutAlpha,
    layoutAlpha, forceSimulationActive
} from './state.js';

// ==================== Force-Directed Layout ====================

let spatialHash = new SpatialHash(150); // Cell size ~ 2 * FOLDER_DISTANCE

export function initForceLayout(tree) {
    layoutNodes.clear();
    setLayoutEdges([]);
    parentMap.clear();

    function addNode(node, parentPath = null) {
        // Give each node a random angle for initial spread
        const angle = Math.random() * Math.PI * 2;
        const radius = node.depth * 50 + Math.random() * 30;

        const nodeData = {
            path: node.path,
            name: node.name,
            isFile: node.isFile,
            depth: node.depth,
            position: new THREE.Vector3(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0
            ),
            velocity: new THREE.Vector3(0, 0, 0),
            mesh: null,
            visible: false,
            clusterAngle: Math.random() * Math.PI * 2, // For file clustering
            clusterRadius: Math.random() * FILE_CLUSTER_RADIUS
        };

        if (node.path === '') {
            nodeData.position.set(0, 0, 0);
        }

        layoutNodes.set(node.path, nodeData);

        if (parentPath !== null) {
            parentMap.set(node.path, parentPath);
            // Only add edges between folders (not files)
            if (!node.isFile) {
                layoutEdges.push({ source: parentPath, target: node.path });
            }
        }

        if (node.children) {
            for (const child of node.children.values()) {
                addNode(child, node.path);
            }
        }
    }

    addNode(tree);

    // Compute path compression after tree is built
    computePathCompression();

    setLayoutAlpha(1);
    setForceSimulationActive(true);
}

// Compute which folders should be compressed (skipped in visualization)
// A folder is skipped if: it has exactly 1 child folder AND 0 direct files
export function computePathCompression() {
    effectiveParentMap.clear();
    skippedFolders.clear();

    // Step 1: Count children for each folder
    const childrenCount = new Map(); // folderPath → { folders: n, files: n }
    for (const [path, node] of layoutNodes) {
        if (path === '') continue;
        const parent = parentMap.get(path);
        if (parent === undefined) continue;

        if (!childrenCount.has(parent)) {
            childrenCount.set(parent, { folders: 0, files: 0 });
        }
        const counts = childrenCount.get(parent);
        if (node.isFile) {
            counts.files++;
        } else {
            counts.folders++;
        }
    }

    // Step 2: Mark folders to skip (single-child chains with no direct files)
    // Never skip root - it's the anchor of the tree
    for (const [folderPath, counts] of childrenCount) {
        if (folderPath === '') continue;
        if (counts.folders === 1 && counts.files === 0) {
            skippedFolders.add(folderPath);
        }
    }

    // Step 3: Build effective parent map (skip compressed folders)
    for (const [path, node] of layoutNodes) {
        if (path === '') continue;
        let parent = parentMap.get(path);
        // Walk up until we find a non-skipped folder (or root)
        while (parent && skippedFolders.has(parent)) {
            parent = parentMap.get(parent);
        }
        effectiveParentMap.set(path, parent !== undefined ? parent : '');
    }
}

export function updateForceLayout() {
    // Minimum alpha floor to prevent complete freeze - overlapping nodes will slowly separate
    const effectiveAlpha = Math.max(layoutAlpha, 0.1);

    // Only non-skipped folders participate in force simulation
    const folders = Array.from(layoutNodes.values()).filter(n =>
        (n.visible || n.path === '') && !n.isFile && !skippedFolders.has(n.path)
    );
    const files = Array.from(layoutNodes.values()).filter(n => n.visible && n.isFile);

    if (folders.length < 1) return;

    // 1. Repulsion between folders (Spatial Hash Optimized)
    const repulsionStrength = 4000;

    // Rebuild spatial hash
    spatialHash.clear();
    for (const node of folders) {
        spatialHash.insert(node);
    }

    for (const nodeA of folders) {
        // Get nearby nodes from spatial hash
        const neighbors = spatialHash.getNearby(nodeA);

        for (const nodeB of neighbors) {
            if (nodeA === nodeB) continue;

            const delta = new THREE.Vector3().subVectors(nodeA.position, nodeB.position);
            const distSq = delta.lengthSq();

            if (distSq < 0.1) continue;

            const dist = Math.sqrt(distSq);
            const force = repulsionStrength / distSq;
            const forceVec = delta.normalize().multiplyScalar(force * effectiveAlpha);

            if (nodeA.path !== '') nodeA.velocity.add(forceVec);
        }
    }

    // 2. Spring force between folders (using effectiveParentMap for compressed paths)
    const springStrength = 0.15;
    const processedSprings = new Set();
    for (const folder of folders) {
        if (folder.path === '') continue;

        const effectiveParent = effectiveParentMap.get(folder.path);
        if (effectiveParent === undefined) continue;

        // Avoid duplicate springs
        const springKey = `${effectiveParent}|${folder.path}`;
        if (processedSprings.has(springKey)) continue;
        processedSprings.add(springKey);

        const source = layoutNodes.get(effectiveParent);
        if (!source) continue;
        if (!source.visible && source.path !== '') continue;

        const restLength = source.path === '' ? FOLDER_DISTANCE * 1.2 : FOLDER_DISTANCE;

        const delta = new THREE.Vector3().subVectors(folder.position, source.position);
        const dist = delta.length();
        const force = (dist - restLength) * springStrength;
        const forceVec = delta.normalize().multiplyScalar(force * effectiveAlpha);

        if (source.path !== '') source.velocity.add(forceVec);
        folder.velocity.sub(forceVec);
    }

    // 3. Angular spread for sibling folders (using effectiveParentMap)
    const siblingMap = new Map();
    for (const folder of folders) {
        if (folder.path === '') continue;
        const effectiveParent = effectiveParentMap.get(folder.path) ?? '';
        if (!siblingMap.has(effectiveParent)) {
            siblingMap.set(effectiveParent, []);
        }
        siblingMap.get(effectiveParent).push(folder);
    }

    // Spread siblings in a fan pattern
    for (const [parentPath, siblings] of siblingMap) {
        if (siblings.length < 2) continue;
        const parent = layoutNodes.get(parentPath);
        if (!parent) continue;

        const angularRepulsion = 800;
        for (let i = 0; i < siblings.length; i++) {
            for (let j = i + 1; j < siblings.length; j++) {
                const nodeA = siblings[i];
                const nodeB = siblings[j];
                const delta = new THREE.Vector3().subVectors(nodeA.position, nodeB.position);
                const dist = Math.max(delta.length(), 1);
                const force = angularRepulsion / (dist * dist);
                const forceVec = delta.normalize().multiplyScalar(force * effectiveAlpha);
                nodeA.velocity.add(forceVec);
                nodeB.velocity.sub(forceVec);
            }
        }
    }

    // 4. Outward expansion force - pushes nodes away from center to fill space
    const centerExpansion = 80;
    for (const node of folders) {
        if (node.path === '') continue;
        const dist = node.position.length();
        if (dist > 1) {
            const expansionForce = centerExpansion / (dist + 10);
            const outwardForce = node.position.clone().normalize()
                .multiplyScalar(expansionForce * effectiveAlpha);
            node.velocity.add(outwardForce);
        }
    }

    // 5. Apply velocity with damping for folders
    const damping = 0.7;
    for (const node of folders) {
        if (node.path === '') continue;
        node.velocity.multiplyScalar(damping);
        node.position.add(node.velocity);

        if (node.mesh) {
            node.mesh.position.copy(node.position);
        }
    }

    // 6. Position files using gravity trap model (attract to center + repel each other)
    const filesByParent = new Map();
    for (const file of files) {
        const parentPath = effectiveParentMap.get(file.path);
        if (!filesByParent.has(parentPath)) {
            filesByParent.set(parentPath, []);
        }
        filesByParent.get(parentPath).push(file);
    }

    const maxFileDistance = FILE_CLUSTER_RADIUS * 2.5;  // Hard boundary

    for (const [parentPath, siblingFiles] of filesByParent) {
        const parent = parentPath !== undefined ? layoutNodes.get(parentPath) : null;
        if (!parent) continue;

        // Single file: center directly on parent (no physics needed)
        if (siblingFiles.length === 1) {
            const file = siblingFiles[0];
            file.position.x += (parent.position.x - file.position.x) * 0.3;
            file.position.y += (parent.position.y - file.position.y) * 0.3;
            if (file.mesh) file.mesh.position.copy(file.position);
            continue;
        }

        // Multiple files: gravity trap model
        for (const file of siblingFiles) {
            const toParent = new THREE.Vector3().subVectors(parent.position, file.position);
            const distToParent = toParent.length();

            // Hard boundary: force pull back if too far
            if (distToParent > maxFileDistance) {
                const pullBack = toParent.normalize().multiplyScalar((distToParent - maxFileDistance) * 0.5);
                file.position.add(pullBack);
            }

            // 1. Attraction - proportional to distance (stronger when farther)
            if (distToParent > 5) {
                const attractForce = toParent.normalize().multiplyScalar(distToParent * 0.05);
                file.velocity.add(attractForce);
            }

            // 2. Repulsion from sibling files (reduced strength)
            for (const other of siblingFiles) {
                if (file === other) continue;
                const delta = new THREE.Vector3().subVectors(file.position, other.position);
                const dist = Math.max(delta.length(), 3);  // Min dist 3 to avoid extreme forces
                const repelForce = delta.normalize().multiplyScalar(20 / (dist * dist));
                file.velocity.add(repelForce);
            }

            // 3. Apply with damping (no layoutAlpha dependency)
            file.velocity.multiplyScalar(0.6);
            file.position.add(file.velocity);

            if (file.mesh) {
                file.mesh.position.copy(file.position);
            }
        }
    }

    if (layoutAlpha > 0.001) {
        setLayoutAlpha(layoutAlpha * 0.98);
    }
}
