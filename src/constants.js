// ==================== Constants ====================

// Layout constants
export const FOLDER_DISTANCE = 75;       // Distance between folders (reduced for tighter clustering)
export const FILE_CLUSTER_RADIUS = 20;   // Max distance of files from parent folder
export const CAMERA_PADDING = 150;       // Camera view padding
export const MAX_PARTICLES = 5000;

// File Extension Colors Cache
export const extensionColorCache = new Map();

// Theme Config - Museum Dusk Palette
export const themeConfig = {
    bgColor: '#0b0d12',
    dirColor: '#d4956c',
    textColor: '#e8e3dc',
    cameraPadding: 1.1,
    bloomEnabled: true,
    bloomStrength: 0.6,
    extensionColors: true
};

// File type color mapping
export const FILE_TYPE_COLORS = {
    // Code files
    js: 0xf7df1e,      // JavaScript - yellow
    ts: 0x3178c6,      // TypeScript - blue
    jsx: 0x61dafb,     // React - cyan
    tsx: 0x61dafb,
    vue: 0x42b883,     // Vue - green
    py: 0x3776ab,      // Python - dark blue
    go: 0x00add8,      // Go - cyan blue
    rs: 0xdea584,      // Rust - orange
    java: 0xed8b00,    // Java - orange
    rb: 0xcc342d,      // Ruby - red
    php: 0x777bb4,     // PHP - purple
    c: 0x555555,       // C - gray
    cpp: 0xf34b7d,     // C++ - pink
    cs: 0x178600,      // C# - green
    swift: 0xfa7343,   // Swift - orange
    kt: 0x7f52ff,      // Kotlin - purple
    // Styles
    css: 0x264de4,     // CSS - blue
    scss: 0xc6538c,    // SCSS - pink
    less: 0x1d365d,    // Less - dark blue
    // Markup/Data
    html: 0xe34c26,    // HTML - orange red
    md: 0x083fa1,      // Markdown - blue
    json: 0x292929,    // JSON - dark gray
    yaml: 0xcb171e,    // YAML - red
    yml: 0xcb171e,
    xml: 0x0060ac,     // XML - blue
    // Other
    sh: 0x89e051,      // Shell - green
    default: 0x8888aa  // Default - gray
};
