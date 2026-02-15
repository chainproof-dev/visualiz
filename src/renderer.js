import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
let localScene, localCamera, localRenderer, localControls;
let localComposer, localBloomPass;

let targetCameraZ = 800;

function updateCameraFollow(deltaTime = 0.016) {
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

    const width = maxX - minX + CAMERA_PADDING * 2 * themeConfig.cameraPadding;
    const height = maxY - minY + CAMERA_PADDING * 2 * themeConfig.cameraPadding;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate required camera distance to fit content
    const fov = localCamera.fov * Math.PI / 180;
    const aspect = localCamera.aspect;
    const distForHeight = height / (2 * Math.tan(fov / 2));
    const distForWidth = width / (2 * Math.tan(fov / 2) * aspect);
    const requiredZ = Math.max(distForHeight, distForWidth, 300);

    targetCameraZ = requiredZ;

    // Improved Smooth camera movement (Time-based damping)
    const damping = 2.0;
    const dt = Math.min(0.1, (performance.now() - state.lastFrameTime) / 1000);
    const smoothFactor = 1 - Math.exp(-damping * dt);
}

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaTime = (now - state.lastFrameTime) / 1000;
    state.lastFrameTime = now;

    localControls.update();

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

    localCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    localCamera.position.set(0, 0, 800);

    localRenderer = new THREE.WebGLRenderer({ antialias: true });
    localRenderer.setSize(window.innerWidth, window.innerHeight);
    localRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(localRenderer.domElement);

    localControls = new OrbitControls(localCamera, localRenderer.domElement);
    localControls.enableDamping = true;
    localControls.dampingFactor = 0.05;
    localControls.minDistance = 150;
    localControls.maxDistance = 5000;
    localControls.enableZoom = true;
    localControls.zoomSpeed = 1.2;
    localControls.enablePan = true;
    localControls.screenSpacePanning = true;
    localControls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
    localControls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    const treeGroup = new THREE.Group();
    localScene.add(treeGroup);
    const authorGroup = new THREE.Group();
    localScene.add(authorGroup);

    // Set shared state
    setScene(localScene);
    setCamera(localCamera);
    setRenderer(localRenderer);
    setControls(localControls);
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
