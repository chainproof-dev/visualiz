import * as THREE from 'three';
import { state, authorGroup, camera } from './state.js';
import { createLaserBeam } from './laser-beams.js';

// ==================== Author Sprites ====================
export function createAuthorSprite(author) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const centerX = 64;
    const centerY = 64;

    const r = Math.floor(author.color.r * 255);
    const g = Math.floor(author.color.g * 255);
    const b = Math.floor(author.color.b * 255);

    // Subtle outer glow (reduced from original for natural look)
    const glowLayers = [
        { radius: 40, alpha: 0.02 },
        { radius: 34, alpha: 0.05 },
        { radius: 28, alpha: 0.08 }
    ];

    for (const layer of glowLayers) {
        const gradient = ctx.createRadialGradient(centerX, centerY, layer.radius * 0.5, centerX, centerY, layer.radius);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${layer.alpha})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, layer.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw main circle (radius reduced by 1/5: 28 * 0.8 = 22)
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, Math.PI * 2);
    ctx.fill();

    // Draw white border (width doubled: 2 -> 4)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, Math.PI * 2);
    ctx.stroke();

    // Draw initial letter
    ctx.fillStyle = '#000';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(author.name[0].toUpperCase(), centerX, centerY);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false  // Prevent transparent areas from blocking other objects
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(53);  // 35 * 1.5

    return sprite;
}

// Median helper function (resistant to outliers)
export function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function showAuthorForFiles(author, files) {
    // Use camera distance for relative positioning (adapts to view scale)
    const spawnRadius = camera.position.z * 0.08;  // ~8% of view width
    const wanderDist = spawnRadius * 0.3;

    // Create sprite on first appearance
    if (!author.sprite) {
        author.sprite = createAuthorSprite(author);
        // Initial position near first file
        const firstFile = files[0];
        const outwardDir = new THREE.Vector3(firstFile.position.x, firstFile.position.y, 0).normalize();
        if (outwardDir.length() < 0.1) {
            const angle = Math.random() * Math.PI * 2;
            outwardDir.set(Math.cos(angle), Math.sin(angle), 0);
        }
        author.position.set(
            firstFile.position.x + outwardDir.x * spawnRadius,
            firstFile.position.y + outwardDir.y * spawnRadius,
            20
        );
        author.sprite.position.copy(author.position);
        authorGroup.add(author.sprite);
    }

    // Create laser for each file
    for (const file of files) {
        createLaserBeam(author, file);
    }

    // Calculate center using median (resistant to outliers)
    const xs = files.map(f => f.position.x);
    const ys = files.map(f => f.position.y);
    const centerX = median(xs);
    const centerY = median(ys);

    // Target position: center outer side + small wander
    const outwardDir = new THREE.Vector3(centerX, centerY, 0).normalize();
    if (outwardDir.length() < 0.1) {
        const angle = Math.random() * Math.PI * 2;
        outwardDir.set(Math.cos(angle), Math.sin(angle), 0);
    }

    const newTargetX = centerX + outwardDir.x * spawnRadius;
    const newTargetY = centerY + outwardDir.y * spawnRadius;

    // Only move if distance change is significant (reduce jitter)
    const currentDist = Math.hypot(
        author.targetPosition.x - newTargetX,
        author.targetPosition.y - newTargetY
    );

    if (currentDist > spawnRadius * 0.5) {
        const wanderAngle = Math.random() * Math.PI * 2;
        author.targetPosition.set(
            newTargetX + Math.cos(wanderAngle) * wanderDist,
            newTargetY + Math.sin(wanderAngle) * wanderDist,
            20
        );
    }

    author.sprite.material.opacity = 1;
    author.lastActiveTime = performance.now() / 1000;
}

export function updateAuthors(deltaTime) {
    const fadeStartDelay = 3 / state.playSpeed;  // Start fading after inactivity
    const fadeSpeed = 0.4 * state.playSpeed;
    const now = performance.now() / 1000;

    // Calculate scale factor to keep contributor sprites at fixed viewport size
    const baseSize = 53;  // 35 * 1.5
    const baseDistance = 800;  // Reference camera distance
    const cameraZ = camera.position.z;
    const scaleFactor = cameraZ / baseDistance;

    for (const author of state.authors.values()) {
        if (!author.sprite) continue;

        const timeSinceActive = now - author.lastActiveTime;

        // Move toward target (deceleration with relative max speed)
        const delta = new THREE.Vector3().subVectors(author.targetPosition, author.position);
        const dist = delta.length();
        if (dist > 0.5) {
            const decelFactor = 1 - Math.pow(0.02, deltaTime * state.playSpeed);
            const moveAmount = dist * decelFactor;
            const maxSpeed = cameraZ * 0.3 * deltaTime;  // Relative to view, independent of playSpeed
            const actualMove = Math.min(moveAmount, maxSpeed);
            author.position.add(delta.normalize().multiplyScalar(actualMove));
            author.sprite.position.copy(author.position);
        }

        // Fade out after inactivity
        if (timeSinceActive > fadeStartDelay) {
            author.sprite.material.opacity -= fadeSpeed * deltaTime;
            if (author.sprite.material.opacity < 0) {
                author.sprite.material.opacity = 0;
            }
        }

        // Keep contributor sprite at fixed viewport size (scales with camera distance)
        author.sprite.scale.setScalar(baseSize * scaleFactor);
    }
}
