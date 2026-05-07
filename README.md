  <img src="assets/logo.png" alt="opencode-toon-plugin logo" width="160">

# opencode-toon-plugin

[![npm version](https://img.shields.io/npm/v/opencode-toon-plugin)](https://www.npmjs.com/package/opencode-toon-plugin)

Compact large JSON tool output in OpenCode with [TOON](https://github.com/toon-format/toon).

The plugin acts as a middle layer: it stores shorter TOON in the context window instead of full JSON, while preserving JSON compatibility when forwarded output is used by later `bash` commands.

It only replaces the original output when the TOON result is smaller.

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

The plugin sits between tool output and the agent context. The agent sees compact TOON instead of large JSON, but commands can still receive JSON when that output is forwarded later.

### Output compression

Only `bash` output is handled by default. Output is changed only when all checks pass:

```text
┌─────────────┐
│ bash output │
└──────┬──────┘
       │
       v
┌─────────────────┐     no
│ 256+ chars and  │─────────> keep original output
│ valid JSON?     │
└────────┬────────┘
         │ yes
         v
┌─────────────────┐     no
│ TOON is shorter │─────────> keep original output
│ than JSON?      │
└────────┬────────┘
         │ yes
         v
  show TOON in context
  remember original JSON in memory
```

### Forwarded output

Before a later `bash` command runs, the plugin looks for TOON payloads inside quoted strings and heredocs. It restores JSON in two cases:

- Exact match: the TOON text matches output remembered in the current OpenCode process.
- Valid TOON fallback: no memory match exists, but the payload can be decoded as TOON.

Edited or invalid TOON is left unchanged.

```text
┌────────────────────────────────────┐
│ bash command contains TOON payload │
└───────────────┬────────────────────┘
                │
                v
       ┌──────────────────┐    yes
       │ remembered exact │────────> restore original JSON
       │ TOON output?     │
       └────────┬─────────┘
                │ no
                v
       ┌──────────────────┐    yes
       │ valid TOON       │────────> decode to JSON
       │ payload?         │
       └────────┬─────────┘
                │ no
                v
          run command unchanged
```

## Example

Prompt:

```text
Run `gh api repos/octocat/Hello-World/issues` and show me the result.
```

<table>
  <tr>
    <th>Without TOON</th>
    <th>With TOON</th>
  </tr>
  <tr>
    <td>
      <pre lang="json">[
  {
    "id": 1,
    "title": "Found a bug",
    "state": "open",
    "labels": [
      { "name": "bug" }
    ],
    "assignee": "monalisa"
  },
  {
    "id": 2,
    "title": "Docs update",
    "state": "open",
    "labels": [
      { "name": "docs" }
    ],
    "assignee": "hubot"
  },
  {
    "id": 3,
    "title": "Ship release",
    "state": "closed",
    "labels": [
      { "name": "release" }
    ],
    "assignee": "octocat"
  }
]</pre>
    </td>
    <td>
      <pre lang="text">[3]:
  - id: 1
    title: Found a bug
    state: open
    labels[1]{name}:
      bug
    assignee: monalisa
  - id: 2
    title: Docs update
    state: open
    labels[1]{name}:
      docs
    assignee: hubot
  - id: 3
    title: Ship release
    state: closed
    labels[1]{name}:
      release
    assignee: octocat</pre>
    </td>
  </tr>
</table>

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
