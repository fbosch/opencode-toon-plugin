import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));
const execFileAsync = promisify(execFile);
const opencodeBin = process.env.OPENCODE_BIN ??
  (process.platform === "win32" ? "opencode.cmd" : "opencode");

async function run(command: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  const [file, ...args] = command;
  if (!file) throw new Error("missing command");

  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      env,
    });

    return { stdout, stderr };
  } catch (error) {
    if (error instanceof Error && "stdout" in error && "stderr" in error) {
      return {
        stdout: String(error.stdout ?? ""),
        stderr: String(error.stderr ?? ""),
      };
    }

    throw error;
  }
}

async function runWithRetries(
  command: string[],
  cwd: string,
  attempts: number,
  env?: NodeJS.ProcessEnv,
) {
  let result = await run(command, cwd, env);

  for (let attempt = 1; attempt < attempts; attempt++) {
    if (result.stdout) return result;
    result = await run(command, cwd, env);
  }

  return result;
}

test("opencode resolves and loads the plugin from a temp config", {
  timeout: 15000,
}, async () => {
  const tempProjectDir = await mkdtemp(join(tmpdir(), "opencode-toon-plugin-"));

  try {
    const projectConfigDir = join(tempProjectDir, ".opencode");
    const pluginEntry = pathToFileURL(join(repoDir, "dist", "index.js")).href;

    await mkdir(projectConfigDir, { recursive: true });

    await writeFile(
      join(projectConfigDir, "opencode.jsonc"),
      JSON.stringify({ plugin: [pluginEntry] }, null, 2),
    );

    const { stdout, stderr } = await runWithRetries(
      [opencodeBin, "debug", "config"],
      tempProjectDir,
      3,
      process.env,
    );

    assert.ok(
      stdout,
      `expected \`${opencodeBin} debug config\` to output JSON, stderr: ${stderr || "(empty)"}`,
    );

    const resolvedConfig = JSON.parse(stdout) as { plugin: string[] };
    const pluginPath = resolvedConfig.plugin.find((entry) => entry === pluginEntry);

    assert.equal(pluginPath, pluginEntry);

    const { default: ToonPlugin } = (await import(pluginPath)) as {
      default: () => Promise<
        Record<
          string,
          (input: unknown, output: { output: string }) => Promise<void>
        >
      >;
    };
    const plugin = await ToonPlugin();
    const hook = plugin["tool.execute.after"];

    assert.equal(typeof hook, "function");

    const output = {
      title: "",
      output: JSON.stringify({
        users: Array.from({ length: 20 }, (_, index) => ({
          id: index + 1,
          name: `user-${index}`,
          active: index % 2 === 0,
        })),
      }),
      metadata: {},
    };
    const original = output.output;

    await hook(
      {
        tool: "bash",
        sessionID: "session",
        callID: "call",
        args: {},
      },
      output,
    );

    assert.notEqual(output.output, original);
    assert.match(output.output, /^users\[/);
  } finally {
    await rm(tempProjectDir, { force: true, recursive: true });
  }
});
