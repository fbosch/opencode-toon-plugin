import type { Plugin } from "@opencode-ai/plugin";
import { decode, encode } from "@toon-format/toon";

const DEFAULT_ELIGIBLE_TOOLS = ["bash"];
const TOON_OPTIONS = {
  delimiter: "\t",
  keyFolding: "safe",
} as const;
const TOON_DECODE_OPTIONS = {
  expandPaths: "safe",
  strict: false,
} as const;

function getEligibleTools() {
  const raw = process.env.OPENCODE_TOON_PLUGIN_TOOLS;

  return new Set(
    (raw ? raw.split(",") : DEFAULT_ELIGIBLE_TOOLS)
      .map((tool) => tool.trim().toLowerCase())
      .filter(Boolean),
  );
}

function looksLikeJson(text: string) {
  const first = text.charCodeAt(0);
  const last = text.charCodeAt(text.length - 1);
  // starts with "{" and ends with "}" or starts with "[" and ends with "]"
  return (first === 123 && last === 125) || (first === 91 && last === 93);
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLikelyToon(text: string) {
  if (text.length < 8) return false;
  if (looksLikeJson(text)) return false;

  let decoded: unknown;
  try {
    decoded = decode(text, TOON_DECODE_OPTIONS);
  } catch {
    return false;
  }

  if (Array.isArray(decoded) === false && isObjectLike(decoded) === false) {
    return false;
  }

  try {
    return encode(decoded, TOON_OPTIONS) === text;
  } catch {
    return false;
  }
}

function decodeToJsonString(text: string) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;
  if (isLikelyToon(trimmed) === false) return text;

  const decoded = decode(trimmed, TOON_DECODE_OPTIONS);
  return JSON.stringify(decoded);
}

function decodeToJsonInArgs(args: unknown): unknown {
  if (typeof args === "string") {
    return decodeToJsonString(args);
  }

  if (Array.isArray(args)) {
    return args.map((value) => decodeToJsonInArgs(value));
  }

  if (isObjectLike(args) === false) {
    return args;
  }

  const entries = Object.entries(args).map(([key, value]) => [
    key,
    decodeToJsonInArgs(value),
  ]);

  return Object.fromEntries(entries);
}

const ToonPlugin: Plugin = async () => {
  const eligibleTools = getEligibleTools();

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool.toLowerCase() !== "jq") return;

      output.args = decodeToJsonInArgs(output.args) as typeof output.args;
    },
    "tool.execute.after": async (input, output) => {
      if (!eligibleTools.has(input.tool.toLowerCase())) return;

      const trimmed = output.output.trim();
      if (trimmed.length < 256) return;
      if (!looksLikeJson(trimmed)) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return;
      }

      try {
        const converted = encode(parsed, TOON_OPTIONS);
        if (converted.length < trimmed.length) output.output = converted;
      } catch (error) {
        console.error(
          "[opencode-toon-plugin] Failed to encode JSON output",
          error,
        );
      }
    },
  };
};

export default ToonPlugin;
