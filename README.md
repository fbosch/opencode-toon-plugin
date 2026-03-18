  <img src="assets/logo.png" alt="opencode-toon-plugin logo" width="160">

# opencode-toon-plugin

[![npm version](https://img.shields.io/npm/v/opencode-toon-plugin)](https://www.npmjs.com/package/opencode-toon-plugin)

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

```text
bash output
   |
   +-- <256 chars or non-JSON -----> keep original
   |
   +-- JSON >=256 chars
         |
         +-- TOON is shorter ------> replace output
         |
         +-- TOON is not shorter --> keep original
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
