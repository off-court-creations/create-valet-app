Changelog

All notable changes to this project are documented here.

0.30.3 — 2025-09-04
- Added: Git initialization enabled by default with `--no-git` opt-out.
- Added: Git identity checks; prompts to set local `user.name`/`user.email` when interactive; non-interactive runs skip initial commit with clear follow-ups.
- Added: Robust `.gitignore` for all templates and CLI fallback writer when absent.
- Changed: CLI help and README to document git defaults and behavior.
- Internal: Validation scenarios pass across templates and feature toggles.

0.30.2 — 2025-09-03
- Changed: Improved CLI visuals/banner styling.

0.30.1 — 2025-09-03
- Added: Valet MCP guidance generation (`AGENTS.md`), with interactive config helper.
- Changed: Adjusted install process to include optional MCP pieces.
- Internal: Packaging and version bump.

0.30.0 — 2025-09-03
- Initial release: scaffold React + Vite app with TypeScript default, plus JS and Hybrid templates.
- Features: Router/Zustand toggles, minimal mode, path alias, lint/format scripts, split TS configs, validation harness.

