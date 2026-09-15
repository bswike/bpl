// Map coordinates and terrain heights are meters; no vertical exaggeration.
export function mapToGeographic(projection, x, z) {
  const g = projection.georeference;
  if (!g) return null;
  const rx = x + g.minX,
    ry = g.maxY - z;
  return [
    g.tee[0] + (-rx * g.sin + ry * g.cos) / 111320,
    g.tee[1] + (rx * g.cos + ry * g.sin) / g.metersPerDegreeLng,
  ];
}

export function gridElevation(grid, lat, lng) {
  const x = Math.max(
    0,
    Math.min(
      grid.cols - 1,
      ((lng - grid.west) / (grid.east - grid.west)) * (grid.cols - 1),
    ),
  );
  const y = Math.max(
    0,
    Math.min(
      grid.rows - 1,
      ((lat - grid.south) / (grid.north - grid.south)) * (grid.rows - 1),
    ),
  );
  const x0 = Math.min(grid.cols - 2, Math.floor(x)),
    y0 = Math.min(grid.rows - 2, Math.floor(y));
  const tx = x - x0,
    ty = y - y0;
  const a = grid.heights[y0 * grid.cols + x0],
    b = grid.heights[y0 * grid.cols + x0 + 1];
  const c = grid.heights[(y0 + 1) * grid.cols + x0],
    d = grid.heights[(y0 + 1) * grid.cols + x0 + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export function createTerrainSampler(projection, grid) {
  if (!grid || !projection.georeference) return () => 0;
  const absolute = (x, z) =>
    gridElevation(grid, ...mapToGeographic(projection, x, z));
  const datum = absolute(...projection.tee);
  return (x, z) => absolute(x, z) - datum;
}
