import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";
import { encode } from "@toon-format/toon";

import ToonPlugin from "../src/index.js";

const execFileAsync = promisify(execFile);

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

async function runOutputHook(tool: string, value: string) {
  const plugin = await ToonPlugin({} as never);
  const hook = plugin["tool.execute.after"];

  assert.ok(hook);

  const output = {
    title: "",
    output: value,
    metadata: {},
  };

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

async function createConvertedBashOutput() {
  const plugin = await ToonPlugin({} as never);
  const afterHook = plugin["tool.execute.after"];

  assert.ok(afterHook);

  const output = createOutput();
  await afterHook(
    {
      tool: "bash",
      sessionID: "session",
      callID: "call",
      args: {},
    },
    output,
  );

  return { output: output.output, plugin };
}

async function withEligibleTools<T>(
  raw: string | undefined,
  run: () => Promise<T>,
) {
  const original = process.env.OPENCODE_TOON_PLUGIN_TOOLS;

  if (raw === undefined) delete process.env.OPENCODE_TOON_PLUGIN_TOOLS;
  else process.env.OPENCODE_TOON_PLUGIN_TOOLS = raw;

  try {
    return await run();
  } finally {
    if (original === undefined) delete process.env.OPENCODE_TOON_PLUGIN_TOOLS;
    else process.env.OPENCODE_TOON_PLUGIN_TOOLS = original;
  }
}

test("registers the tool.execute.after hook", async () => {
  const plugin = await ToonPlugin({} as never);

  assert.equal(typeof plugin["tool.execute.before"], "function");
  assert.equal(typeof plugin["tool.execute.after"], "function");
});

test("defaults to handling bash output", async () => {
  const output = await withEligibleTools(undefined, () => runHook("bash"));

  assert.notEqual(output, LONG_JSON);
});

test("leaves non-default tool output unchanged", async () => {
  const output = await withEligibleTools(undefined, () => runHook("rtk"));

  assert.equal(output, LONG_JSON);
});

test("leaves short JSON output unchanged", async () => {
  const shortJson = JSON.stringify({ hello: "world" });
  const output = await runOutputHook("bash", shortJson);

  assert.equal(output, shortJson);
});

test("leaves non-JSON output unchanged", async () => {
  const text = "x".repeat(300);
  const output = await runOutputHook("bash", text);

  assert.equal(output, text);
});

test("leaves JSON unchanged when TOON is not shorter", async () => {
  const json = JSON.stringify(
    Array.from({ length: 300 }, (_, index) => index % 10),
  );
  const output = await runOutputHook("bash", json);

  assert.equal(output, json);
});

test("uses env override for eligible tools", async () => {
  await withEligibleTools("rtk", async () => {
    const bashOutput = await runHook("bash");
    const rtkOutput = await runHook("rtk");

    assert.equal(bashOutput, LONG_JSON);
    assert.notEqual(rtkOutput, LONG_JSON);
  });
});

test("restores forwarded Toon output in quoted bash arguments", async () => {
  const { output, plugin } = await createConvertedBashOutput();
  const beforeHook = plugin["tool.execute.before"];

  assert.ok(beforeHook);
  assert.notEqual(output, LONG_JSON);

  const args = {
    command: `printf '%s' '${output}' | jq .`,
  };

  await beforeHook(
    {
      tool: "bash",
      sessionID: "session",
      callID: "next-call",
    },
    { args },
  );

  assert.equal(args.command, `printf '%s' '${LONG_JSON}' | jq .`);
});

test("restored forwarded output works as JSON in a shell pipeline", async () => {
  const { output, plugin } = await createConvertedBashOutput();
  const beforeHook = plugin["tool.execute.before"];

  assert.ok(beforeHook);

  const args = {
    command: `printf '%s' '${output}' | ${JSON.stringify(process.execPath)} -e 'const chunks = []; for await (const chunk of Bun.stdin.stream()) chunks.push(Buffer.from(chunk)); const value = JSON.parse(Buffer.concat(chunks).toString()); console.log(value.items.length);'`,
  };

  await beforeHook(
    {
      tool: "bash",
      sessionID: "session",
      callID: "next-call",
    },
    { args },
  );

  const { stdout } = await execFileAsync("bash", ["-lc", args.command]);

  assert.equal(stdout.trim(), "80");
});

test("restores forwarded Toon output in heredocs", async () => {
  const { output, plugin } = await createConvertedBashOutput();
  const beforeHook = plugin["tool.execute.before"];

  assert.ok(beforeHook);

  const args = {
    command: `jq . <<'JSON'\n${output}\nJSON`,
  };

  await beforeHook(
    {
      tool: "bash",
      sessionID: "session",
      callID: "next-call",
    },
    { args },
  );

  assert.equal(args.command, `jq . <<'JSON'\n${LONG_JSON}\nJSON`);
});

test("decodes valid uncached Toon output in quoted bash arguments", async () => {
  const plugin = await ToonPlugin({} as never);
  const beforeHook = plugin["tool.execute.before"];

  assert.ok(beforeHook);

  const original = {
    users: Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      name: `user-${index}`,
      active: index % 2 === 0,
    })),
  };
  const toon = encode(original, { delimiter: "\t", keyFolding: "safe" });
  const args = {
    command: `printf '%s' '${toon}' | jq .`,
  };

  await beforeHook(
    {
      tool: "bash",
      sessionID: "session",
      callID: "call",
    },
    { args },
  );

  assert.equal(
    args.command,
    `printf '%s' '${JSON.stringify(original)}' | jq .`,
  );
});

test("leaves uncached Toon-like text unchanged", async () => {
  const plugin = await ToonPlugin({} as never);
  const beforeHook = plugin["tool.execute.before"];

  assert.ok(beforeHook);

  const args = {
    command: "printf '%s' 'items[2\t]{id\tname}:\n  1\tone\n  2\ttwo'",
  };
  const original = args.command;

  await beforeHook(
    {
      tool: "bash",
      sessionID: "session",
      callID: "call",
    },
    { args },
  );

  assert.equal(args.command, original);
});
