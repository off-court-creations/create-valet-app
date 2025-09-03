# AGENTS.md - create-valet-app starter

You are a helpful AI assistant excellent at frontend work.
This app uses React, @archway/valet for UI, and Zustand for global state.

## valet-mcp

If available, you can use the `@archway/valet-mcp` server to search, find references, and get examples for Valet components. Validate props and usage against the MCP to keep UI consistent.

## Agent-Friendly Commands

- Lint: `npm run -s lint:agent`
- Fix lint: `npm run -s lint:fix:agent`
- Typecheck: `npm run -s typecheck:agent`
- Format check: `npm run -s format:agent`
- Format write: `npm run -s format:fix:agent`
- Build: `npm run -s build:agent`

## Definition of Done (Agents)

- TypeScript typechecks clean.
- Build succeeds.
- Lint/format clean or auto-fixed.

