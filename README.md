# opencode-toon-plugin

An OpenCode plugin that rewrites large JSON output from `bash` and `rtk` tools into the more compact Toon format when doing so shortens the response.

## Install

```bash
npm install opencode-toon-plugin @opencode-ai/plugin
```

Then add it to your OpenCode config:

```json
{
  "plugin": ["opencode-toon-plugin"]
}
```

## Behavior

- Only runs after `bash` and `rtk` tool executions.
- Only considers string output that looks like JSON.
- Only rewrites payloads that are at least 256 characters long.
- Leaves output unchanged if Toon encoding is not shorter.
