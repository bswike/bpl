import { readFile, writeFile } from "node:fs/promises";
const service =
  "https://maps.nj.gov/arcgis/rest/services/Elevation/NW_DEM/ImageServer";
const course = JSON.parse(
  await readFile(
    new URL("../public/data/black-bear.json", import.meta.url),
    "utf8",
  ),
);
const metadata = await (await fetch(`${service}?f=json`)).json();
if (metadata.heightModelInfo?.heightUnit !== "us-foot")
  throw new Error("Unexpected elevation units");
// Which holes to survey: `node scripts/fetch-black-bear-terrain.mjs 4 5`
// adds or refreshes those holes and keeps the rest of the file as it is.
const output = new URL(
  "../src/components/golf/tripgame/data/blackBearTerrain.json",
  import.meta.url,
);
const wanted = process.argv.slice(2).map(Number).filter(Number.isFinite);
const existing = await readFile(output, "utf8")
  .then((text) => JSON.parse(text))
  .catch(() => null);
const holes = (existing?.holes || []).filter((h) => !wanted.includes(h.number));
for (const hole of course.holes.filter((h) => (wanted.length ? wanted.includes(h.num) : h.num <= 3))) {
  const points = [
    ...hole.line,
    ...hole.tees.map((t) => t.pos),
    ...course.features
      .filter((f) => Number(f.hole) === hole.num)
      .flatMap((f) => f.coords),
  ];
  const lngScale = 111320 * Math.cos((hole.pin[0] * Math.PI) / 180);
  const south = Math.min(...points.map((p) => p[0])) - 350 / 111320;
  const north = Math.max(...points.map((p) => p[0])) + 350 / 111320;
  const west = Math.min(...points.map((p) => p[1])) - 350 / lngScale;
  const east = Math.max(...points.map((p) => p[1])) + 350 / lngScale;
  const cols = Math.ceil(((east - west) * lngScale) / 6) + 1;
  const rows = Math.ceil(((north - south) * 111320) / 6) + 1;
  const locations = Array.from({ length: rows * cols }, (_, i) => [
    west + ((i % cols) / (cols - 1)) * (east - west),
    south + (Math.floor(i / cols) / (rows - 1)) * (north - south),
  ]);
  const heights = new Array(locations.length);
  // Independent read-only batches, bounded to avoid overloading the service.
  for (let start = 0; start < locations.length; start += 2000) {
    await Promise.all(
      [0, 500, 1000, 1500].map(async (offset) => {
        const index = start + offset,
          batch = locations.slice(index, index + 500);
        if (!batch.length) return;
        const response = await fetch(`${service}/getSamples`, {
          method: "POST",
          signal: AbortSignal.timeout(60000),
          body: new URLSearchParams({
            f: "json",
            geometry: JSON.stringify({
              points: batch,
              spatialReference: { wkid: 4326 },
            }),
            geometryType: "esriGeometryMultipoint",
            returnFirstValueOnly: "true",
            interpolation: "RSP_BilinearInterpolation",
          }),
        });
        const result = await response.json();
        if (
          !response.ok ||
          result.error ||
          result.samples?.length !== batch.length
        )
          throw new Error(
            `Missing terrain batch ${hole.num}/${index}: ${JSON.stringify(result.error)}`,
          );
        result.samples.forEach((sample, j) => {
          const ft = Number(sample.value);
          if (
            !Number.isFinite(ft) ||
            ft < -100 ||
            ft > 2500 ||
            Math.abs(sample.location.x - batch[j][0]) > 1e-6 ||
            Math.abs(sample.location.y - batch[j][1]) > 1e-6
          )
            throw new Error("Invalid terrain sample");
          heights[index + j] = Math.round(((ft * 1200) / 3937) * 100) / 100;
        });
      }),
    );
  }
  holes.push({
    number: hole.num,
    south,
    north,
    west,
    east,
    cols,
    rows,
    heights,
  });
  console.log(
    `Hole ${hole.num}: ${cols} × ${rows} terrain grid (${heights.length} samples)`,
  );
}
holes.sort((a, b) => a.number - b.number);
await writeFile(
  output,
  JSON.stringify({
    schemaVersion: 1,
    course: "black-bear",
    source: {
      name: "NJ 2018 Northwest Lidar Bare Earth DEM",
      url: service,
      collectionYears: [2017, 2018],
      retrievedAt: new Date().toISOString(),
      sourceResolutionFt: metadata.pixelSizeX,
      gridSpacingM: 6,
      verticalUnits: "meters",
      verticalDatum: "NAVD88 (GEOID12B)",
      notes:
        "Bilinear samples from bare-earth lidar. Course polygons from OpenStreetMap; vegetation is illustrative. No vertical exaggeration.",
    },
    holes,
  }) + "\n",
);
