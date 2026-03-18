type Detector = (text: string) => boolean;
type LooksLikeJson = (text: string) => boolean;

const MIN_LENGTH = 256;
const ITERATIONS = 200_000;

function looksLikeJson(text: string) {
  const first = text[0];
  const last = text[text.length - 1];

  return (first === "{" && last === "}") || (first === "[" && last === "]");
}

function looksLikeJsonCharCode(text: string) {
  const first = text.charCodeAt(0);
  const last = text.charCodeAt(text.length - 1);

  return (first === 123 && last === 125) || (first === 91 && last === 93);
}

function isWhitespace(code: number) {
  return code === 32 || (code >= 9 && code <= 13);
}

function getJsonBounds(text: string) {
  let start = 0;
  let end = text.length - 1;

  while (start <= end && isWhitespace(text.charCodeAt(start))) start++;
  while (end >= start && isWhitespace(text.charCodeAt(end))) end--;

  if (end - start + 1 < MIN_LENGTH) return null;

  const first = text.charCodeAt(start);
  const last = text.charCodeAt(end);

  if ((first === 123 && last === 125) || (first === 91 && last === 93)) {
    return { start, end };
  }

  return null;
}

function parseOnly(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function guardedParse(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH) return false;
  if (!looksLikeJson(trimmed)) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function guardedParseCharCode(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH) return false;
  if (!looksLikeJsonCharCode(trimmed)) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function boundsGuardedParse(text: string) {
  const bounds = getJsonBounds(text);
  if (!bounds) return false;

  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function createRng(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomWord(rng: () => number, min = 3, max = 12) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789-_/.";
  const length = min + Math.floor(rng() * (max - min + 1));
  let word = "";

  for (let i = 0; i < length; i++) {
    word += alphabet[Math.floor(rng() * alphabet.length)];
  }

  return word;
}

function makeLongJson(rng: () => number) {
  return JSON.stringify({
    command: Array.from({ length: 10 }, () => randomWord(rng, 5, 16)).join(" "),
    files: Array.from({ length: 20 }, () => ({
      path: `${randomWord(rng, 4, 8)}/${randomWord(rng, 4, 10)}.ts`,
      size: Math.floor(rng() * 20_000),
      changed: rng() > 0.5,
    })),
    output: Array.from({ length: 40 }, () => randomWord(rng, 8, 24)).join(" "),
  });
}

function withWhitespace(rng: () => number, text: string) {
  const prefix = " ".repeat(Math.floor(rng() * 4)) + (rng() > 0.7 ? "\n" : "");
  const suffix = (rng() > 0.7 ? "\n" : "") + " ".repeat(Math.floor(rng() * 4));

  return `${prefix}${text}${suffix}`;
}

function makeShellText(rng: () => number) {
  return Array.from(
    { length: 30 },
    () => `${randomWord(rng, 2, 10)} ${randomWord(rng, 8, 18)}`,
  ).join("\n");
}

function makeJsonLookingGarbage(rng: () => number) {
  const inner = Array.from(
    { length: 40 },
    () => `${randomWord(rng, 3, 8)}:${randomWord(rng, 3, 12)}`,
  ).join(",");

  return `{${inner}`.padEnd(MIN_LENGTH + 40, "!") + "}";
}

function sampleDataset(kind: "mostly-non-json" | "mixed" | "mostly-json") {
  const rng = createRng(
    kind === "mostly-non-json" ? 1 : kind === "mixed" ? 2 : 3,
  );

  return Array.from({ length: ITERATIONS }, () => {
    const roll = rng();

    if (kind === "mostly-non-json") {
      if (roll < 0.85) return makeShellText(rng);
      if (roll < 0.95) return makeJsonLookingGarbage(rng);
      return withWhitespace(rng, makeLongJson(rng));
    }

    if (kind === "mostly-json") {
      if (roll < 0.8) return withWhitespace(rng, makeLongJson(rng));
      if (roll < 0.9) return makeJsonLookingGarbage(rng);
      return makeShellText(rng);
    }

    if (roll < 0.45) return makeShellText(rng);
    if (roll < 0.7) return makeJsonLookingGarbage(rng);
    return withWhitespace(rng, makeLongJson(rng));
  });
}

function benchmark(name: string, detector: Detector, dataset: string[]) {
  const start = performance.now();
  let hits = 0;

  for (const sample of dataset) {
    if (detector(sample)) hits++;
  }

  const durationMs = performance.now() - start;
  return { name, hits, durationMs };
}

function benchmarkLooksLikeJson(
  name: string,
  detector: LooksLikeJson,
  dataset: string[],
) {
  const prepared = dataset
    .map((sample) => sample.trim())
    .filter((sample) => sample.length >= MIN_LENGTH);
  const start = performance.now();
  let hits = 0;

  for (const sample of prepared) {
    if (detector(sample)) hits++;
  }

  const durationMs = performance.now() - start;
  return { name, hits, samples: prepared.length, durationMs };
}

for (const scenario of ["mostly-non-json", "mixed", "mostly-json"] as const) {
  const dataset = sampleDataset(scenario);
  const results = [
    benchmark("parse-only", parseOnly, dataset),
    benchmark("trim-guarded-parse", guardedParse, dataset),
    benchmark("trim-guarded-parse-charcode", guardedParseCharCode, dataset),
    benchmark("bounds-guarded-parse", boundsGuardedParse, dataset),
  ];
  const baseline = results[0]!;

  console.log(`\nScenario: ${scenario}`);
  for (const result of results) {
    const delta =
      ((result.durationMs - baseline.durationMs) / baseline.durationMs) * 100;
    console.log(
      `${result.name}: ${result.durationMs.toFixed(2)}ms (${result.hits} matches)${result === baseline ? "" : ` | delta: ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`}`,
    );
  }

  const looksLikeJsonResults = [
    benchmarkLooksLikeJson("looks-like-json-string", looksLikeJson, dataset),
    benchmarkLooksLikeJson(
      "looks-like-json-charcode",
      looksLikeJsonCharCode,
      dataset,
    ),
  ];
  const looksLikeJsonBaseline = looksLikeJsonResults[0]!;

  console.log("looksLikeJson only:");
  for (const result of looksLikeJsonResults) {
    const delta =
      ((result.durationMs - looksLikeJsonBaseline.durationMs) /
        looksLikeJsonBaseline.durationMs) *
      100;
    console.log(
      `${result.name}: ${result.durationMs.toFixed(2)}ms (${result.hits}/${result.samples})${result === looksLikeJsonBaseline ? "" : ` | delta: ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`}`,
    );
  }
}
