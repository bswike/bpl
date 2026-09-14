import { readFile, writeFile } from "node:fs/promises";
const service =
  "https://maps.nj.gov/arcgis/rest/services/Elevation/NW_DEM/ImageServer";
const input = new URL("../public/data/black-bear.json", import.meta.url);
const output = new URL(
  "../public/data/black-bear-elevation.json",
  import.meta.url,
);
const course = JSON.parse(await readFile(input, "utf8"));
const metadata = await (
  await fetch(`${service}?f=json`, { signal: AbortSignal.timeout(30000) })
).json();
if (metadata.heightModelInfo?.heightUnit !== "us-foot")
  throw new Error("Unexpected elevation units");
const US_FOOT_M = 1200 / 3937;
const distance = (a, b) =>
  Math.hypot(
    (b[0] - a[0]) * 111320,
    (b[1] - a[1]) * 111320 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180),
  );
const round = (x, n = 2) => Number(x.toFixed(n));
function sample(path) {
  const result = [{ lat: path[0][0], lng: path[0][1], distanceM: 0 }];
  let traveled = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = distance(a, b),
      steps = Math.max(1, Math.ceil(length / 5));
    for (let k = 1; k <= steps; k++)
      result.push({
        lat: a[0] + ((b[0] - a[0]) * k) / steps,
        lng: a[1] + ((b[1] - a[1]) * k) / steps,
        distanceM: traveled + (length * k) / steps,
      });
    traveled += length;
  }
  return result;
}
const holes = [];
for (const hole of course.holes) {
  const tees = (
    hole.tees?.length
      ? hole.tees
      : [{ pos: hole.line[0], yards: hole.yards, path: hole.line }]
  ).map((tee, index) => {
    const path = tee.path?.length ? tee.path : [tee.pos, ...hole.line.slice(1)];
    return { index, yards: tee.yards, points: sample(path) };
  });
  const points = tees.flatMap((t) => t.points);
  const form = new URLSearchParams({
    f: "json",
    geometry: JSON.stringify({
      points: points.map((p) => [p.lng, p.lat]),
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryMultipoint",
    returnFirstValueOnly: "true",
    interpolation: "RSP_BilinearInterpolation",
  });
  const response = await fetch(`${service}/getSamples`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok)
    throw new Error(`Hole ${hole.num}: HTTP ${response.status}`);
  const data = await response.json();
  if (data.error || data.samples?.length !== points.length)
    throw new Error(
      `Hole ${hole.num}: missing samples ${JSON.stringify(data.error || { expected: points.length, received: data.samples?.length })}`,
    );
  data.samples.forEach((entry, i) => {
    const p = points[i],
      elevationFt = Number(entry.value);
    if (
      !Number.isFinite(elevationFt) ||
      elevationFt < -100 ||
      elevationFt > 2500 ||
      Math.abs(entry.location.x - p.lng) > 1e-6 ||
      Math.abs(entry.location.y - p.lat) > 1e-6
    )
      throw new Error(
        `Hole ${hole.num}: invalid or misaligned elevation sample ${i}`,
      );
    p.elevationFt = round(elevationFt);
    p.elevationM = round(elevationFt * US_FOOT_M, 3);
    p.lat = round(p.lat, 8);
    p.lng = round(p.lng, 8);
    p.distanceM = round(p.distanceM);
  });
  tees.forEach((t) => {
    const z = t.points.map((p) => p.elevationFt);
    t.summary = {
      teeElevationFt: z[0],
      greenElevationFt: z.at(-1),
      netChangeFt: round(z.at(-1) - z[0]),
      lowestFt: Math.min(...z),
      highestFt: Math.max(...z),
      routeLengthM: t.points.at(-1).distanceM,
    };
  });
  holes.push({ number: hole.num, par: hole.par, tees });
  console.log(
    `Hole ${hole.num}: ${tees.length} tees, ${points.length} samples, ${tees[0].summary.netChangeFt > 0 ? "+" : ""}${tees[0].summary.netChangeFt} ft tee to green`,
  );
}
const result = {
  schemaVersion: 1,
  course: "black-bear",
  source: {
    name: "NJ 2018 Northwest Lidar Bare Earth DEM",
    url: service,
    collectionYears: [2017, 2018],
    retrievedAt: new Date().toISOString(),
    horizontalResolutionFt: metadata.pixelSizeX,
    verticalDatum: "NAVD88 (GEOID12B)",
    verticalUnits: "US survey feet",
    sampling:
      "Bilinear interpolation at mapped route points no more than 5 meters apart",
    routeSource: course.source,
    notes:
      "Bare-earth elevation profile along mapped tee routes. Tee and pin coordinates are from the existing course map; this is not a survey of current green contours.",
  },
  holes,
};
await writeFile(output, JSON.stringify(result) + "\n");
console.log(
  `Saved ${holes.length} holes, ${holes.reduce((n, h) => n + h.tees.length, 0)} tee profiles.`,
);
