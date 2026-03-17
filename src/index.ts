import { encode } from "@toon-format/toon";
import type { Plugin } from "@opencode-ai/plugin";

const DEFAULT_ELIGIBLE_TOOLS = ["bash"];
const eligibleTools = new Set(
  (process.env.OPENCODE_TOON_PLUGIN_TOOLS ?? DEFAULT_ELIGIBLE_TOOLS.join(","))
    .split(",")
    .map((tool) => tool.trim().toLowerCase())
    .filter(Boolean),
);

const ToonPlugin: Plugin = async () => ({
  "tool.execute.after": async (input, output) => {
    if (!eligibleTools.has(String(input?.tool ?? "").toLowerCase())) return;

    const text = output?.output;
    if (typeof text !== "string") return;

    const trimmed = text.trim();
    if (trimmed.length < 256 || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return;
    }

    try {
      const converted = encode(parsed);
      if (converted.length < text.length) output.output = converted;
    } catch {}
  },
});

export default ToonPlugin;
