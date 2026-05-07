import { createHash } from "node:crypto";
import type { Plugin } from "@opencode-ai/plugin";
import { decode, encode } from "@toon-format/toon";

const DEFAULT_ELIGIBLE_TOOLS = ["bash"];
const MAX_CACHED_OUTPUTS = 100;
const TOON_OPTIONS = {
  delimiter: "\t",
  keyFolding: "safe",
} as const;

const convertedOutputs = new Map<string, { json: string; toon: string }>();

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function cacheConvertedOutput(converted: string, originalJson: string) {
  convertedOutputs.set(hashText(converted), {
    json: originalJson,
    toon: converted,
  });

  while (convertedOutputs.size > MAX_CACHED_OUTPUTS) {
    const oldest = convertedOutputs.keys().next().value;
    if (oldest === undefined) return;
    convertedOutputs.delete(oldest);
  }
}

function shellSingleQuote(text: string) {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function getCachedJson(text: string) {
  return convertedOutputs.get(hashText(text))?.json;
}

function looksLikeToon(text: string) {
  const trimmed = text.trim();

  if (trimmed.length < 64) return false;
  if (looksLikeJson(trimmed)) return false;
  if (!trimmed.includes("\n")) return false;

  return /^[A-Za-z_$][\w$.-]*\[\d*\s*\t?\]\{[^}\n]+\}:/m.test(trimmed);
}

function getJsonForForwardedText(text: string) {
  const cached = getCachedJson(text);
  if (cached !== undefined) return cached;
  if (!looksLikeToon(text)) return;

  try {
    return JSON.stringify(decode(text));
  } catch {
    return;
  }
}

function replaceHeredocs(command: string) {
  return command.replace(
    /(<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2[^\n]*\n)([\s\S]*?)(\n\3(?:\n|$))/g,
    (
      match,
      prefix: string,
      _quote: string,
      _marker: string,
      body: string,
      suffix: string,
    ) => {
      const json = getJsonForForwardedText(body.trim());
      return json === undefined ? match : `${prefix}${json}${suffix}`;
    },
  );
}

function replaceQuotedPayloads(command: string) {
  const withSingleQuotes = command.replace(
    /'([^']*)'/g,
    (match, body: string) => {
      const json = getJsonForForwardedText(body);
      return json === undefined ? match : shellSingleQuote(json);
    },
  );

  return withSingleQuotes.replace(
    /"((?:\\.|[^"\\])*)"/g,
    (match, body: string) => {
      const json = getJsonForForwardedText(body);
      return json === undefined ? match : shellSingleQuote(json);
    },
  );
}

function replaceCachedPayloads(command: string) {
  let replaced = command;

  for (const { json, toon } of convertedOutputs.values()) {
    if (!replaced.includes(toon)) continue;
    replaced = replaced.replaceAll(toon, shellSingleQuote(json));
  }

  return replaced;
}

function replaceToonPayloads(command: string) {
  const withHeredocs = replaceHeredocs(command);
  const withQuotedPayloads = replaceQuotedPayloads(withHeredocs);

  return replaceCachedPayloads(withQuotedPayloads);
}

function getCommand(args: unknown) {
  if (!isRecord(args)) return;
  return typeof args.command === "string" ? args.command : undefined;
}

const ToonPlugin: Plugin = async () => {
  const eligibleTools = getEligibleTools();

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool.toLowerCase() !== "bash") return;

      const command = getCommand(output.args);
      if (command === undefined) return;

      const replaced = replaceToonPayloads(command);
      if (replaced !== command) output.args.command = replaced;
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
        if (converted.length < trimmed.length) {
          cacheConvertedOutput(converted, trimmed);
          output.output = converted;
        }
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
