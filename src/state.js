import * as THREE from 'three';

// ==================== State ====================
export const state = {
    commits: [],
    authors: new Map(),
    currentCommitIndex: -1,
    isPlaying: false,
    playSpeed: 1,
    lastFrameTime: 0,
    timeSinceLastCommit: 0,
    visibleFiles: new Set(),
    totalLinesAdded: 0,
    totalLinesDeleted: 0
};

// ==================== Shared Mutable References ====================
// These are set by their respective modules and accessed across modules

export let scene = null;
export let camera = null;
export let renderer = null;
export let controls = null;
export let composer = null;
export let bloomPass = null;
export let treeGroup = null;
export let authorGroup = null;

export let layoutNodes = new Map();
export let layoutEdges = [];
export let forceSimulationActive = false;
export let layoutAlpha = 1;
export let edgeLines = [];

// Laser beams array
export let laserBeams = [];

// Camera auto-follow state
export let targetCameraZ = 800;
export let cameraFollowEnabled = true;

// Parent maps for path compression
export const parentMap = new Map();
export const effectiveParentMap = new Map();
export const skippedFolders = new Set();

// ==================== Setters ====================
// Since ES modules export bindings (not values), we use setter functions
// for reassignable references that are modified by other modules.

export function setScene(s) { scene = s; }
export function setCamera(c) { camera = c; }
export function setRenderer(r) { renderer = r; }
export function setControls(c) { controls = c; }
export function setComposer(c) { composer = c; }
export function setBloomPass(b) { bloomPass = b; }
export function setTreeGroup(g) { treeGroup = g; }
export function setAuthorGroup(g) { authorGroup = g; }

export function setLayoutNodes(m) { layoutNodes = m; }
export function setLayoutEdges(e) { layoutEdges = e; }
export function setForceSimulationActive(v) { forceSimulationActive = v; }
export function setLayoutAlpha(v) { layoutAlpha = v; }
export function setEdgeLines(e) { edgeLines = e; }
export function setLaserBeams(l) { laserBeams = l; }
export function setTargetCameraZ(v) { targetCameraZ = v; }
export function setCameraFollowEnabled(v) { cameraFollowEnabled = v; }
