// Perlin Noise Implementation
class PerlinNoise {
    constructor(seed = 0) {
        this.seed = seed;
        this.permutation = this.generatePermutation(seed);
        this.p = [...this.permutation, ...this.permutation];
    }

    // Generate permutation table based on seed
    generatePermutation(seed) {
        const p = Array.from({length: 256}, (_, i) => i);
        
        // Seeded shuffle (using seed for deterministic randomness)
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(((Math.sin(seed + i) + 1) / 2) * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        return p;
    }

    // Gradient vectors for 2D (8 possible directions)
    getGradient(hash) {
        const gradients = [
            [1, 1], [-1, 1], [1, -1], [-1, -1],
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ];
        return gradients[hash & 7];
    }

    // Smoothstep interpolation: 3t² - 2t³
    smoothstep(t) {
        return t * t * (3 - 2 * t);
    }

    // Linear interpolation
    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // Dot product of gradient and distance vector
    dotGradient(gridX, gridY, x, z) {
        const hash = this.p[this.p[gridX & 255] + (gridY & 255)];
        const gradient = this.getGradient(hash);
        const dx = x - gridX;
        const dz = z - gridY;
        return gradient[0] * dx + gradient[1] * dz;
    }

    // 2D Perlin noise
    noise2D(x, z) {
        // Find grid cell coordinates
        const gridX = Math.floor(x);
        const gridY = Math.floor(z);

        // Fractional parts
        const fx = x - gridX;
        const fz = z - gridY;

        // Smooth curve interpolation
        const u = this.smoothstep(fx);
        const v = this.smoothstep(fz);

        // Get dot products at each corner
        const n00 = this.dotGradient(gridX, gridY, x, z);
        const n10 = this.dotGradient(gridX + 1, gridY, x, z);
        const n01 = this.dotGradient(gridX, gridY + 1, x, z);
        const n11 = this.dotGradient(gridX + 1, gridY + 1, x, z);

        // Interpolate
        const nx0 = this.lerp(n00, n10, u);
        const nx1 = this.lerp(n01, n11, u);
        const result = this.lerp(nx0, nx1, v);

        return result;
    }
}
