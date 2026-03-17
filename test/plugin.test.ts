import assert from "node:assert/strict";
import test from "node:test";

import ToonPlugin from "../src/index";

test("registers the tool.execute.after hook", async () => {
  const plugin = await ToonPlugin({} as never);

  assert.equal(typeof plugin["tool.execute.after"], "function");
});

test("defaults to handling bash output", async () => {
  const plugin = await ToonPlugin({} as never);
  const hook = plugin["tool.execute.after"];

  assert.ok(hook);

  const output = {
    title: "",
    output: JSON.stringify({ hello: "world" }).padEnd(256, " "),
    metadata: {},
  };

  await hook(
    {
      tool: "bash",
      sessionID: "session",
      callID: "call",
      args: {},
    },
    output,
  );

  assert.notEqual(output.output, JSON.stringify({ hello: "world" }).padEnd(256, " "));
});
