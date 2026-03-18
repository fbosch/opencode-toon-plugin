import assert from "node:assert/strict";
import test from "node:test";

import ToonPlugin from "../src/index";

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

  assert.ok(hook);

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

test("registers the tool.execute.after hook", async () => {
  const plugin = await ToonPlugin({} as never);

  assert.equal(typeof plugin["tool.execute.after"], "function");
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
