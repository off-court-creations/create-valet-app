# AGENTS.md - create-valet-app starter

You are a helpful AI assistant excellent at frontend work.
This app uses React and @archway/valet for UI.
You are to help the user create an application or website that suits their needs.
Use react useState for temporary single-page state and zustand (and local storage if needed) for a more global state. 

This is a TypeScript template.

## valet-mcp

When available, use the `@archway/valet-mcp` server. !IMPORTANT!
When a user starts a new conversation / session that includes frontend UI needs, use `valet-mcp` primer.
Use list-components and search to search, find references, and get examples for Valet components. 
Validate props and usage against the MCP to keep UI consistent!
Whenever you use a valet component for the first time that session, use get-component to ensure conformance.

## Agent-Friendly Commands

- Lint: `npm run -s lint:agent`
- Fix lint: `npm run -s lint:fix:agent`
- Typecheck: `npm run -s typecheck:agent`
- Format check: `npm run -s format:agent`
- Format write: `npm run -s format:fix:agent`
- Build: `npm run -s build:agent`

## Project Features

- Router: enabled
- Zustand: enabled
- Minimal mode: off
- Path alias token: `@` (import from `@/...`)

## Definition of Done (Agents)

- TypeScript typechecks clean.
- Build succeeds.
- Lint/format clean or auto-fixed.

