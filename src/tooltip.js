import * as THREE from 'three';
import { state, layoutNodes, renderer, camera } from './state.js';

// ==================== Tooltip System ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let tooltipEl = null;
let lastHoveredPath = null;
let lastHoveredAuthor = null;

export function initTooltip() {
    tooltipEl = document.getElementById('tooltip');

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseleave', hideTooltip);
    renderer.domElement.addEventListener('click', onCanvasClick);
}

function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check file nodes
    const fileMeshes = Array.from(layoutNodes.values())
        .filter(n => n.visible && n.isFile && n.mesh)
        .map(n => n.mesh);

    const fileIntersects = raycaster.intersectObjects(fileMeshes);

    if (fileIntersects.length > 0) {
        const path = fileIntersects[0].object.userData.path;
        showTooltip(path + ' (click to copy)', event.clientX, event.clientY);
        lastHoveredPath = path;
        renderer.domElement.style.cursor = 'pointer';
        return;
    }

    // Check author sprites
    const authorSprites = Array.from(state.authors.values())
        .filter(a => a.sprite && a.sprite.material.opacity > 0.1)
        .map(a => a.sprite);

    const authorIntersects = raycaster.intersectObjects(authorSprites);

    if (authorIntersects.length > 0) {
        // Find author by sprite
        for (const author of state.authors.values()) {
            if (author.sprite === authorIntersects[0].object) {
                showTooltip(author.name + ' (click to copy)', event.clientX, event.clientY);
                lastHoveredAuthor = author.name;
                lastHoveredPath = null;
                renderer.domElement.style.cursor = 'pointer';
                return;
            }
        }
    }

    lastHoveredPath = null;
    lastHoveredAuthor = null;
    renderer.domElement.style.cursor = 'default';
    hideTooltip();
}

function onCanvasClick(event) {
    const textToCopy = lastHoveredPath || lastHoveredAuthor;
    if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            tooltipEl.textContent = 'Copied!';
            setTimeout(() => {
                if (lastHoveredPath) {
                    tooltipEl.textContent = lastHoveredPath + ' (click to copy)';
                } else if (lastHoveredAuthor) {
                    tooltipEl.textContent = lastHoveredAuthor + ' (click to copy)';
                }
            }, 1000);
        });
    }
}

function showTooltip(text, x, y) {
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');
    tooltipEl.style.left = (x + 12) + 'px';
    tooltipEl.style.top = (y + 12) + 'px';
}

function hideTooltip() {
    tooltipEl.classList.remove('visible');
}
