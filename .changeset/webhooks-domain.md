---
'cyber-figma': minor
---

Add the webhooks domain: `cyber-figma webhook list|get|create|update|delete|requests` and the `figma_webhook_*` MCP tools, covering all seven Webhooks v2 endpoints. Passcodes are masked on every path out — including `--json` and MCP output — and `--passcode-env <VAR>` keeps one out of shell history; endpoints are checked for `https` before Figma is asked to call them; and a refused write names the role that context requires (team admin, or Can edit on the project or file) instead of relaying a bare 403.
