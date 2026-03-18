  <img src="assets/logo.png" alt="opencode-toon-plugin logo" width="160">

# opencode-toon-plugin

Compact large JSON tool output in OpenCode with [TOON](https://github.com/toon-format/toon).

Turns large JSON blobs into shorter, still-readable structured output and only replaces the original when the TOON result is smaller.

Strongly tabular JSON can see roughly 40-60% token savings, with smaller wins on mixed or nested data.

```text
avg tokens

JSON  |██████████████████████████████| 100%
TOON  |████████████......            | 40-60% less
```

## Install

Add it to your OpenCode config:

```json
{
  "plugin": ["opencode-toon-plugin"]
}
```

## Behavior

- intercepts `bash` tool output
- skips small output and non-JSON text
- encodes JSON with TOON

## Configuration

Override eligible tools with `OPENCODE_TOON_PLUGIN_TOOLS`:

```bash
OPENCODE_TOON_PLUGIN_TOOLS=bash,rtk
```

## Development

```bash
bun install
bun run test
bun run typecheck
bun run bench
```

## License

MIT
