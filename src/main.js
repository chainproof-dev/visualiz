import { initThree } from './renderer.js';
import { initEvents } from './events.js';
import { initSettings } from './settings.js';

// ==================== Entry Point ====================
// Wire all modules
initEvents();
initSettings();
initThree();
