// Least-squares similarity: uniform scale, rotation and translation, never shear.
export function fitSimilarity(source, target) {
    if (source.length !== 3 || target.length !== 3)
        throw Error('Marque tres puntos en la imagen y tres en la pared.');
    for (const points of [source, target]) {
        if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
            throw Error('Los puntos no son válidos.');
        const [a, b, c] = points;
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
        const spread = Math.max(
            ...points.flatMap((p) => points.map((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2)),
        );
        if (spread < 1e-10 || area / spread < 0.02)
            throw Error('Elija puntos separados que formen un triángulo amplio.');
    }
    const center = (points) => ({
        x: points.reduce((n, p) => n + p.x, 0) / 3,
        y: points.reduce((n, p) => n + p.y, 0) / 3,
    });
    const s = center(source),
        t = center(target);
    let dot = 0,
        cross = 0,
        variance = 0;
    for (let i = 0; i < 3; i++) {
        const x = source[i].x - s.x,
            y = source[i].y - s.y,
            u = target[i].x - t.x,
            v = target[i].y - t.y;
        dot += x * u + y * v;
        cross += x * v - y * u;
        variance += x * x + y * y;
    }
    const a = dot / variance,
        b = cross / variance,
        scale = Math.hypot(a, b);
    if (scale < 1e-6) throw Error('No se puede encajar: compruebe el orden de los puntos.');
    const x = t.x - a * s.x + b * s.y,
        y = t.y - b * s.x - a * s.y;
    const errors = source.map((p, i) =>
        Math.hypot(a * p.x - b * p.y + x - target[i].x, b * p.x + a * p.y + y - target[i].y),
    );
    return { x, y, scale, angle: Math.atan2(b, a), maxError: Math.max(...errors), errors };
}

export function intersectSelectedPlane(origin, direction, plane) {
    const denominator =
        direction.x * plane.normal.x + direction.y * plane.normal.y + direction.z * plane.normal.z;
    if (Math.abs(denominator) < 1e-6) return null;
    const distance =
        ((plane.position.x - origin.x) * plane.normal.x +
            (plane.position.y - origin.y) * plane.normal.y +
            (plane.position.z - origin.z) * plane.normal.z) /
        denominator;
    if (distance <= 0 || distance > 10) return null;
    return {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
        z: origin.z + direction.z * distance,
    };
}
