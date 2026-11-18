/** Six ratings as a hexagon; the outer ring is 99. */
export function Radar({ ratings, color }: { ratings: { key: string; label: string; value: number }[]; color: string }) {
  const R = 100;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / ratings.length - Math.PI / 2;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  const ring = (f: number) => ratings.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const shape = ratings.map((r, i) => pt(i, R * Math.max(0.12, (r.value - 30) / 69)).join(",")).join(" ");
  return (
    <svg viewBox="-168 -142 336 286" className="w-full max-w-[340px]" role="img" aria-label={ratings.map((r) => `${r.label} ${r.value}`).join(", ")}>
      {[1, 0.75, 0.5, 0.25].map((f) => (
        <polygon key={f} points={ring(f)} fill={f === 1 ? "var(--muted)" : "none"} stroke="var(--border)" strokeWidth={1} />
      ))}
      {ratings.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
      })}
      <polygon points={shape} fill={color} fillOpacity={0.28} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {ratings.map((r, i) => {
        const [x, y] = pt(i, R * Math.max(0.12, (r.value - 30) / 69));
        return <circle key={r.key} cx={x} cy={y} r={3.5} fill={color} />;
      })}
      {ratings.map((r, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <g key={r.key} transform={`translate(${x},${y})`}>
            <text textAnchor="middle" y={-3} className="fill-muted-foreground font-heading text-[11px] font-bold tracking-wider uppercase">
              {r.label}
            </text>
            <text textAnchor="middle" y={13} className="fill-foreground font-heading text-[15px] font-extrabold">
              {r.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
