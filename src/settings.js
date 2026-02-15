import * as THREE from 'three';
import { themeConfig } from './constants.js';
import { scene, layoutNodes, bloomPass } from './state.js';
import { getExtensionColor } from './visualization.js';

// ==================== Settings & Themes ====================
export function initSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsOverlay = document.getElementById('settings-overlay');
    const closeSettings = document.getElementById('close-settings');

    function toggleSettings() {
        const isVisible = settingsModal.classList.contains('visible');
        if (isVisible) {
            settingsModal.classList.remove('visible');
            settingsOverlay.classList.remove('visible');
        } else {
            settingsModal.classList.add('visible');
            settingsOverlay.classList.add('visible');
        }
    }

    settingsBtn.addEventListener('click', toggleSettings);
    closeSettings.addEventListener('click', toggleSettings);
    settingsOverlay.addEventListener('click', toggleSettings);

    // Color Inputs
    const bgColorPicker = document.getElementById('bg-color-picker');
    const dirColorPicker = document.getElementById('dir-color-picker');
    const textColorPicker = document.getElementById('text-color-picker');

    function updateThemeColors() {
        // Update CSS variables
        document.documentElement.style.setProperty('--theme-bg', themeConfig.bgColor);
        document.documentElement.style.setProperty('--theme-text', themeConfig.textColor);
        document.documentElement.style.setProperty('--theme-dir', themeConfig.dirColor);

        // Update Three.js
        if (scene) {
            scene.background = new THREE.Color(themeConfig.bgColor);
        }

        // Update existing directory nodes
        const dirColor = new THREE.Color(themeConfig.dirColor);
        for (const node of layoutNodes.values()) {
            if (!node.isFile && node.mesh) {
                node.mesh.material.color.copy(dirColor);
            }
        }
    }

    bgColorPicker.addEventListener('input', (e) => {
        themeConfig.bgColor = e.target.value;
        updateThemeColors();
    });

    dirColorPicker.addEventListener('input', (e) => {
        themeConfig.dirColor = e.target.value;
        updateThemeColors();
    });

    textColorPicker.addEventListener('input', (e) => {
        themeConfig.textColor = e.target.value;
        updateThemeColors();
    });

    // Padding Slider
    const paddingSlider = document.getElementById('padding-slider');
    const paddingValue = document.getElementById('padding-value');

    paddingSlider.addEventListener('input', (e) => {
        themeConfig.cameraPadding = parseFloat(e.target.value);
        paddingValue.textContent = themeConfig.cameraPadding;
    });

    // Bloom Settings
    const bloomToggle = document.getElementById('bloom-toggle');
    const bloomSlider = document.getElementById('bloom-slider');
    const bloomValue = document.getElementById('bloom-value');

    bloomToggle.addEventListener('change', (e) => {
        themeConfig.bloomEnabled = e.target.checked;
        if (bloomPass) bloomPass.enabled = themeConfig.bloomEnabled;
    });

    bloomSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        themeConfig.bloomStrength = val;
        bloomValue.textContent = val;
        if (bloomPass) bloomPass.strength = val;
    });

    // Extension Colors Toggle
    const extColorsToggle = document.getElementById('ext-colors-toggle');

    extColorsToggle.addEventListener('change', (e) => {
        themeConfig.extensionColors = e.target.checked;

        // Re-colorize existing file nodes
        for (const node of layoutNodes.values()) {
            if (node.isFile && node.mesh) {
                const newColor = new THREE.Color(getExtensionColor(node.path));
                node.mesh.material.color.copy(newColor);
            }
        }
    });

    // Theme Presets - Museum Dusk & Variants
    const themes = {
        default: { bg: '#0b0d12', text: '#e8e3dc', dir: '#d4956c' },
        light: { bg: '#f5f3f0', text: '#2a2420', dir: '#b87a4d' },
        midnight: { bg: '#000000', text: '#b8afa5', dir: '#c77d7d' },
        hacker: { bg: '#0d1117', text: '#82a886', dir: '#82a886' }
    };

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const themeName = btn.dataset.theme;
            const theme = themes[themeName];
            if (theme) {
                themeConfig.bgColor = theme.bg;
                themeConfig.textColor = theme.text;
                themeConfig.dirColor = theme.dir;

                bgColorPicker.value = theme.bg;
                textColorPicker.value = theme.text;
                dirColorPicker.value = theme.dir;

                updateThemeColors();
            }
        });
    });
}
