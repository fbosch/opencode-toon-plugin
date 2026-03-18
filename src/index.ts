import type { Plugin } from "@opencode-ai/plugin";
import { encode } from "@toon-format/toon";

const DEFAULT_ELIGIBLE_TOOLS = ["bash"];
const TOON_OPTIONS = {
  delimiter: "\t",
  keyFolding: "safe",
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

const ToonPlugin: Plugin = async () => {
  const eligibleTools = getEligibleTools();

  return {
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
