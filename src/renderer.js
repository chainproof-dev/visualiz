import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { themeConfig, CAMERA_PADDING } from './constants.js';
import {
    state, layoutNodes, forceSimulationActive, layoutAlpha, camera,
    setScene, setCamera, setRenderer, setControls, setComposer, setBloomPass,
    setTreeGroup, setAuthorGroup
} from './state.js';
import { initParticleSystem, updateParticles } from './particles.js';
import { initTooltip } from './tooltip.js';
import { updateForceLayout } from './force-layout.js';
import { updateEdgeLines } from './visualization.js';
import { updateAuthors } from './authors.js';
import { updateLaserBeams } from './laser-beams.js';
import { updatePlayback } from './playback.js';

// ==================== Three.js Setup ====================
let localScene, localCamera, localRenderer;
let localComposer, localBloomPass;

// Gource-style ZoomCamera state
const cameraState = {
    dest: new THREE.Vector3(0, 0, -800),     // Target position (Gource convention: z is negative distance)
    pos: new THREE.Vector3(0, 0, 800),       // Current camera position
    speed: 1.0,
    padding: 1.1,
    minDistance: 200,
    maxDistance: 5000,
    fov: 60,
    manualZoom: false,
    manualZoomTimeout: null,
    isPanning: false,
    panStart: new THREE.Vector2(),
    lastMouse: new THREE.Vector2(),
};

// ==================== Gource-Style Camera Logic ====================
// Ported from Gource's ZoomCamera::adjust() and ZoomCamera::logic()

function cameraAdjust(bounds) {
    // Center camera on bounds (like Gource ZoomCamera::adjust)
    const centre = bounds.center;
    cameraState.dest.x = centre.x;
    cameraState.dest.y = centre.y;

    // Scale by padding so content isn't right at screen edge
    const width = bounds.width * cameraState.padding;
    const height = bounds.height * cameraState.padding;

    const aspect = localCamera.aspect;

    // Calc visible width at distance=1 for this FOV (Gource: tan(fov*0.5) * 2)
    const toa = Math.tan(cameraState.fov * 0.5 * Math.PI / 180) * 2.0;

    // Use the larger dimension to determine distance
    let distance;
    if (width >= height) {
        distance = width / toa;
    } else {
        distance = height / toa;
    }

    // Adjust for aspect ratio
    if (aspect < 1.0) {
        distance = Math.max(distance, (height / aspect) / toa);
    } else {
        distance = Math.max(distance, (width / aspect) / toa);
    }

    // Clamp to min/max
    distance = Math.max(cameraState.minDistance, Math.min(cameraState.maxDistance, distance));

    cameraState.dest.z = distance; // We store as positive, apply as camera.position.z
}

function cameraLogic(dt) {
    // Gource ZoomCamera::logic() - exponential smooth interpolation
    const dp = new THREE.Vector3().subVectors(
        new THREE.Vector3(cameraState.dest.x, cameraState.dest.y, cameraState.dest.z),
        cameraState.pos
    );

    // Smooth damping: move fraction of remaining distance per frame
    const smoothFactor = 1 - Math.exp(-2.0 * cameraState.speed * dt);
    const dpt = dp.multiplyScalar(smoothFactor);

    // Don't overshoot
    if (dpt.lengthSq() > dp.lengthSq()) {
        cameraState.pos.copy(new THREE.Vector3(cameraState.dest.x, cameraState.dest.y, cameraState.dest.z));
    } else {
        cameraState.pos.add(dpt);
    }

    // Apply to Three.js camera
    localCamera.position.set(cameraState.pos.x, cameraState.pos.y, cameraState.pos.z);
    localCamera.lookAt(cameraState.pos.x, cameraState.pos.y, 0);
}

function updateCameraFollow(deltaTime) {
    // If manual zoom is active, don't auto-adjust distance
    if (cameraState.manualZoom) return;

    const visibleNodes = Array.from(layoutNodes.values()).filter(n => n.visible);
    if (visibleNodes.length === 0) return;

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const node of visibleNodes) {
        minX = Math.min(minX, node.position.x);
        maxX = Math.max(maxX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxY = Math.max(maxY, node.position.y);
    }

    const bounds = {
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        width: maxX - minX + CAMERA_PADDING * 2,
        height: maxY - minY + CAMERA_PADDING * 2
    };

    cameraAdjust(bounds);
    cameraLogic(deltaTime);
}

// ==================== Mouse/Wheel Handlers ====================

function onWheel(e) {
    e.preventDefault();

    cameraState.manualZoom = true;

    // Clear previous timeout
    if (cameraState.manualZoomTimeout) clearTimeout(cameraState.manualZoomTimeout);

    // Like Gource: zoom multiplicative
    const zoomMulti = 1.1;
    let distance = cameraState.dest.z;

    if (e.deltaY < 0) {
        // Zoom in
        distance /= zoomMulti;
        if (distance < cameraState.minDistance) distance = cameraState.minDistance;
    } else {
        // Zoom out
        distance *= zoomMulti;
        if (distance > cameraState.maxDistance) distance = cameraState.maxDistance;
    }

    cameraState.dest.z = distance;

    // Return to auto-follow after 3 seconds of no manual zoom
    cameraState.manualZoomTimeout = setTimeout(() => {
        cameraState.manualZoom = false;
    }, 3000);
}

function onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // Middle click or shift+left = pan
        cameraState.isPanning = true;
        cameraState.panStart.set(e.clientX, e.clientY);
        cameraState.manualZoom = true;
        e.preventDefault();
    }
}

function onMouseMove(e) {
    if (cameraState.isPanning) {
        const dx = e.clientX - cameraState.panStart.x;
        const dy = e.clientY - cameraState.panStart.y;

        // Scale pan by camera distance for consistent feel
        const scale = cameraState.pos.z / 800;
        cameraState.dest.x -= dx * scale;
        cameraState.dest.y += dy * scale; // Invert Y

        cameraState.panStart.set(e.clientX, e.clientY);

        if (cameraState.manualZoomTimeout) clearTimeout(cameraState.manualZoomTimeout);
        cameraState.manualZoomTimeout = setTimeout(() => {
            cameraState.manualZoom = false;
        }, 3000);
    }
}

function onMouseUp(e) {
    if (cameraState.isPanning) {
        cameraState.isPanning = false;
    }
}

// ==================== Animation Loop ====================

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaTime = Math.min((now - state.lastFrameTime) / 1000, 0.1);
    state.lastFrameTime = now;

    if (forceSimulationActive) {
        updateForceLayout();
        updateEdgeLines();
    }

    if (state.isPlaying && state.commits.length > 0) {
        updatePlayback(deltaTime);
    }

    updateCameraFollow(deltaTime);
    updateParticles(deltaTime);
    updateAuthors(deltaTime);
    updateLaserBeams();

    localComposer.render();
}

function onWindowResize() {
    localCamera.aspect = window.innerWidth / window.innerHeight;
    localCamera.updateProjectionMatrix();
    localRenderer.setSize(window.innerWidth, window.innerHeight);
    localComposer.setSize(window.innerWidth, window.innerHeight);
}

export function initThree() {
    localScene = new THREE.Scene();
    localScene.background = new THREE.Color(themeConfig.bgColor);

    localCamera = new THREE.PerspectiveCamera(cameraState.fov, window.innerWidth / window.innerHeight, 1, 10000);
    localCamera.position.set(0, 0, 800);
    cameraState.pos.set(0, 0, 800);

    localRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    localRenderer.setSize(window.innerWidth, window.innerHeight);
    localRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const container = document.getElementById('canvas-container');
    container.appendChild(localRenderer.domElement);

    // Gource-style camera controls (scroll zoom + middle-drag pan)
    const canvas = localRenderer.domElement;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    const treeGroup = new THREE.Group();
    localScene.add(treeGroup);
    const authorGroup = new THREE.Group();
    localScene.add(authorGroup);

    // Set shared state
    setScene(localScene);
    setCamera(localCamera);
    setRenderer(localRenderer);
    setControls(null); // No OrbitControls needed
    setTreeGroup(treeGroup);
    setAuthorGroup(authorGroup);

    initParticleSystem(localScene);

    // Post-processing
    const renderScene = new RenderPass(localScene, localCamera);

    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    localBloomPass = new UnrealBloomPass(resolution, themeConfig.bloomStrength, 0.4, 0.85);
    localBloomPass.enabled = themeConfig.bloomEnabled;

    const outputPass = new OutputPass();

    localComposer = new EffectComposer(localRenderer);
    localComposer.addPass(renderScene);
    localComposer.addPass(localBloomPass);
    localComposer.addPass(outputPass);

    setComposer(localComposer);
    setBloomPass(localBloomPass);

    // Resize handler
    window.addEventListener('resize', onWindowResize, false);
    state.lastFrameTime = performance.now();

    // Init tooltip after renderer is ready
    initTooltip();

    animate();
}

// Export for video recorder
export { localRenderer, localComposer, localCamera, localScene, cameraState };
