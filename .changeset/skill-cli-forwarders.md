---
'cyber-figma': patch
---

Skills now run the CLI through a forwarder in their own folder, `node <skill>/scripts/cyber-figma.mjs <args>`. It uses the installed package at the plugin's version, so the global-install and `npx` fallback steps in `init-figma` are gone.
