// ==================== Optimization (Spatial Hash) ====================
export class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }

    clear() {
        this.buckets.clear();
    }

    getKey(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(node) {
        const key = this.getKey(node.position.x, node.position.y);
        if (!this.buckets.has(key)) {
            this.buckets.set(key, []);
        }
        this.buckets.get(key).push(node);
    }

    getNearby(node) {
        const cx = Math.floor(node.position.x / this.cellSize);
        const cy = Math.floor(node.position.y / this.cellSize);
        const nearby = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                if (this.buckets.has(key)) {
                    const bucket = this.buckets.get(key);
                    for (let i = 0; i < bucket.length; i++) {
                        nearby.push(bucket[i]);
                    }
                }
            }
        }
        return nearby;
    }
}
