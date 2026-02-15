import * as THREE from 'three';
import { scene, laserBeams, setLaserBeams } from './state.js';

// ==================== Laser Beams (Triangle) ====================
export function createLaserBeam(author, targetNode, isDelete = false) {
    // Create triangle: apex at author, base at target
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(9); // 3 vertices * 3 coordinates
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([0, 1, 2]);

    // Muted color with low opacity (red tint for delete)
    const material = new THREE.MeshBasicMaterial({
        color: isDelete ? 0xff4444 : author.color,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = {
        author: author,
        targetNode: isDelete ? null : targetNode,
        // For delete: store fixed position since node will disappear
        fixedTargetPos: isDelete ? targetNode.position.clone() : null,
        startTime: performance.now(),
        duration: 500
    };

    scene.add(mesh);
    laserBeams.push(mesh);
}

export function updateLaserBeams() {
    const now = performance.now();

    for (let i = laserBeams.length - 1; i >= 0; i--) {
        const beam = laserBeams[i];
        const elapsed = now - beam.userData.startTime;
        const t = elapsed / beam.userData.duration;

        if (t >= 1) {
            scene.remove(beam);
            beam.geometry.dispose();
            beam.material.dispose();
            laserBeams.splice(i, 1);
        } else {
            beam.material.opacity = 0.25 * (1 - t);

            // Update triangle vertices
            const authorPos = beam.userData.author.position;
            // Use fixed position for delete lasers, otherwise track node position
            const targetPos = beam.userData.fixedTargetPos || beam.userData.targetNode.position;

            // Direction and perpendicular for base width
            const dir = new THREE.Vector3().subVectors(targetPos, authorPos);
            const length = dir.length();
            const baseWidth = Math.min(length * 0.12, 15); // Triangle base width

            // Perpendicular vector in XY plane
            const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar(baseWidth);

            const positions = beam.geometry.attributes.position.array;
            // Apex (author position)
            positions[0] = authorPos.x;
            positions[1] = authorPos.y;
            positions[2] = authorPos.z;
            // Base left
            positions[3] = targetPos.x + perp.x;
            positions[4] = targetPos.y + perp.y;
            positions[5] = targetPos.z;
            // Base right
            positions[6] = targetPos.x - perp.x;
            positions[7] = targetPos.y - perp.y;
            positions[8] = targetPos.z;

            beam.geometry.attributes.position.needsUpdate = true;
        }
    }
}
