import assert from "node:assert/strict";
import test from "node:test";

import ToonPlugin from "../src/index.js";

const LONG_JSON = JSON.stringify({
  hello: "world",
  items: Array.from({ length: 80 }, (_, i) => i),
});

function createOutput() {
  return {
    title: "",
    output: LONG_JSON,
    metadata: {},
  };
}

async function runHook(tool: string) {
  const plugin = await ToonPlugin({} as never);
  const hook = plugin["tool.execute.after"];

  if (!hook) throw new Error("missing tool.execute.after hook");

  const output = createOutput();
  await hook(
    {
      tool,
      sessionID: "session",
      callID: "call",
      args: {},
    },
    output,
  );

  return output.output;
}

async function runBeforeHook(tool: string, args: unknown) {
  const plugin = await ToonPlugin({} as never);
  const hook = plugin["tool.execute.before"];

  if (!hook) throw new Error("missing tool.execute.before hook");

  const output = {
    args,
  };

  await hook(
    {
      tool,
      sessionID: "session",
      callID: "call",
    },
    output,
  );

  return output.args;
}

test("registers the tool.execute.after hook", async () => {
  const plugin = await ToonPlugin({} as never);

  assert.equal(typeof plugin["tool.execute.after"], "function");
});

test("registers the tool.execute.before hook", async () => {
  const plugin = await ToonPlugin({} as never);

  assert.equal(typeof plugin["tool.execute.before"], "function");
});

test("defaults to handling bash output", async () => {
  const output = await runHook("bash");

  assert.notEqual(output, LONG_JSON);
});

test("uses env override for eligible tools", async () => {
  const original = process.env.OPENCODE_TOON_PLUGIN_TOOLS;
  process.env.OPENCODE_TOON_PLUGIN_TOOLS = "rtk";

  try {
    const bashOutput = await runHook("bash");
    const rtkOutput = await runHook("rtk");

    assert.equal(bashOutput, LONG_JSON);
    assert.notEqual(rtkOutput, LONG_JSON);
  } finally {
    if (original === undefined) delete process.env.OPENCODE_TOON_PLUGIN_TOOLS;
    else process.env.OPENCODE_TOON_PLUGIN_TOOLS = original;
  }
});

test("decodes toon back to json for jq args", async () => {
  const toonOutput = await runHook("bash");
  const result = await runBeforeHook("jq", { input: toonOutput });

  assert.equal(typeof result, "object");
  assert.equal(result === null, false);

  if (
    typeof result !== "object" ||
    result === null ||
    "input" in result === false ||
    typeof result.input !== "string"
  ) {
    throw new Error("expected jq args to contain string input");
  }

  assert.equal(result.input, LONG_JSON);
});

test("does not decode toon-like strings for non-jq tools", async () => {
  const toonOutput = await runHook("bash");
  const result = await runBeforeHook("bash", { input: toonOutput });

  assert.deepEqual(result, { input: toonOutput });
});
