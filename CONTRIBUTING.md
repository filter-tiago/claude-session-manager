# Contributing

Thanks for your interest in contributing to Claude Session Manager!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Rebuild native modules: `npx electron-rebuild`
5. Start development: `npm run electron:dev`

## Development Notes

- The preload script (`electron/preload.cjs`) must remain as native CommonJS. Do not convert it to ESM or TypeScript — Vite bundling breaks Electron's context isolation.
- After changing `better-sqlite3` version, run `npx electron-rebuild`.
- The app watches `~/.claude/projects/` for session data. You need Claude CLI installed with at least one session for the app to have data to display.

## Submitting Changes

1. Create a branch for your change
2. Make your changes
3. Run `npm run build` to verify the build passes
4. Run `npm run lint` to check for lint errors
5. Open a pull request with a clear description of what you changed and why

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS and Node.js version
