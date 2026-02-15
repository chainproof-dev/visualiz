import * as THREE from 'three';
import { MAX_PARTICLES } from './constants.js';
import { scene } from './state.js';

// ==================== Particle System ====================
let particlePositions, particleColors, particleVelocities, particleLifetimes, particleSizes;
let particleGeometry, particleMaterial, particlePoints;

export function initParticleSystem(targetScene) {
    particlePositions = new Float32Array(MAX_PARTICLES * 3);
    particleColors = new Float32Array(MAX_PARTICLES * 3);
    particleVelocities = [];
    particleLifetimes = new Float32Array(MAX_PARTICLES);
    particleSizes = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
        particleVelocities.push({ x: 0, y: 0, z: 0 });
        particleLifetimes[i] = 0;
    }

    particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    particleMaterial = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
          attribute float size;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            float r = length(gl_PointCoord - vec2(0.5));
            if (r > 0.5) discard;
            float alpha = smoothstep(0.5, 0.0, r);
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    targetScene.add(particlePoints);
}

export function emitParticles(position, color, count = 20) {
    for (let i = 0; i < count; i++) {
        let idx = -1;
        for (let j = 0; j < MAX_PARTICLES; j++) {
            if (particleLifetimes[j] <= 0) {
                idx = j;
                break;
            }
        }
        if (idx === -1) return;

        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 40;

        particlePositions[idx * 3] = position.x + (Math.random() - 0.5) * 10;
        particlePositions[idx * 3 + 1] = position.y + (Math.random() - 0.5) * 10;
        particlePositions[idx * 3 + 2] = position.z;

        particleColors[idx * 3] = color.r;
        particleColors[idx * 3 + 1] = color.g;
        particleColors[idx * 3 + 2] = color.b;

        particleVelocities[idx] = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
            z: (Math.random() - 0.5) * speed * 0.5
        };

        particleLifetimes[idx] = 1.0;
        particleSizes[idx] = 4 + Math.random() * 4;
    }
}

export function updateParticles(deltaTime) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
        if (particleLifetimes[i] <= 0) continue;

        particlePositions[i * 3] += particleVelocities[i].x * deltaTime;
        particlePositions[i * 3 + 1] += particleVelocities[i].y * deltaTime;
        particlePositions[i * 3 + 2] += particleVelocities[i].z * deltaTime;

        particleVelocities[i].x *= 0.98;
        particleVelocities[i].y *= 0.98;
        particleVelocities[i].z *= 0.98;

        particleLifetimes[i] -= deltaTime * 0.8;
        particleSizes[i] *= 0.99;
    }

    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    particleGeometry.attributes.size.needsUpdate = true;
}
