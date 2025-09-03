#!/usr/bin/env node
// @archway/create-valet-app — CLI
// Minimal ESM CLI to scaffold a Valet + React + Vite app.
// Phase 1 + Phase 2: implement TS-only template.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PKG = readJSONSafe(path.join(__dirname, '..', 'package.json')) || {};

function readJSONSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function log(...args) { console.log('[cva]', ...args); }
function err(...args) { console.error('[cva]', ...args); }

function usage() {
  console.log(`\n@archway/create-valet-app v${PKG.version || 'dev'}\n\n` +
`Usage:\n  npx @archway/create-valet-app <dir> [options]\n  npm create @archway/valet-app <dir> [options]\n\n` +
`Options:\n  --template ts|js|hybrid   Choose template (default: ts)\n  --install                 Run package install step\n  --pm npm|pnpm|yarn|bun    Choose package manager (default: auto-detect/npm)\n  --git                     Initialize git repo\n  --mcp                     Include AGENTS.md with valet MCP guidance (default)\n  --no-mcp                  Skip AGENTS.md\n  --router | --no-router    Include React Router (default: --router)\n  --zustand | --no-zustand  Include Zustand store (default: --zustand)\n  --minimal                 Minimal files (single page; trims extras)\n  --path-alias <token>      Import alias token for src (default: @)\n  -h, --help                Show help\n`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    dir: undefined,
    template: 'ts',
    install: false,
    pm: undefined,
    git: false,
    mcp: true,
    router: true,
    zustand: true,
    minimal: false,
    pathAlias: '@',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!out.dir && !a.startsWith('-')) { out.dir = a; continue; }
    if (a === '--template') { out.template = args[++i]; continue; }
    if (a === '--install') { out.install = true; continue; }
    if (a === '--pm') { out.pm = args[++i]; continue; }
    if (a === '--git') { out.git = true; continue; }
    if (a === '--mcp') { out.mcp = true; continue; }
    if (a === '--no-mcp') { out.mcp = false; continue; }
    if (a === '--router') { out.router = true; continue; }
    if (a === '--no-router') { out.router = false; continue; }
    if (a === '--zustand') { out.zustand = true; continue; }
    if (a === '--no-zustand') { out.zustand = false; continue; }
    if (a === '--minimal') { out.minimal = true; continue; }
    if (a === '--path-alias') { out.pathAlias = args[++i]; continue; }
    if (a === '-h' || a === '--help') { out.help = true; continue; }
    err('Unknown option:', a);
    usage();
    process.exit(1);
  }
  return out;
}

function ensureNodeVersion() {
  const min = 18;
  const major = Number(process.versions.node.split('.')[0]);
  if (major < min) {
    err(`Node ${min}+ required. Detected ${process.versions.node}.`);
    process.exit(1);
  }
}

function resolvePM(preferred) {
  if (preferred) return preferred;
  // crude auto-detect: respect npm if no lock, else infer
  return 'npm';
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  ensureNodeVersion();
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.dir) { usage(); process.exit(opts.dir ? 0 : 1); }

  if (!['ts', 'js', 'hybrid'].includes(opts.template)) {
    err(`Unknown template '${opts.template}'. Use: ts | js | hybrid`);
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), opts.dir);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    err(`Target directory '${targetDir}' is not empty.`);
    process.exit(1);
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy template
  const templateRoot = path.join(__dirname, '..', 'templates', opts.template);
  copyDir(templateRoot, targetDir);

  // Patch app package.json
  const appPkgPath = path.join(targetDir, 'package.json');
  const appPkg = readJSONSafe(appPkgPath);
  if (!appPkg) {
    err('Template package.json missing or invalid.');
    process.exit(1);
  }
  appPkg.name = normalizePkgName(opts.dir);
  writeJSON(appPkgPath, appPkg);

  // Apply feature toggles (router/zustand/minimal/path alias)
  await applyFeatureToggles({ targetDir, template: opts.template, router: opts.router, zustand: opts.zustand, minimal: opts.minimal, pathAlias: opts.pathAlias });

  // Conditionally remove AGENTS.md
  if (!opts.mcp) {
    const agentsPath = path.join(targetDir, 'AGENTS.md');
    if (fs.existsSync(agentsPath)) fs.rmSync(agentsPath);
  }

  // Git init (optional)
  if (opts.git) {
    try {
      await run('git', ['init'], { cwd: targetDir });
      await run('git', ['add', '.'], { cwd: targetDir });
      await run('git', ['commit', '-m', 'init(create-valet-app): scaffold TS template'], { cwd: targetDir });
    } catch (e) {
      err('git init failed (continuing):', e.message);
    }
  }

  // Install (optional)
  if (opts.install) {
    const pm = resolvePM(opts.pm);
    const args = pm === 'npm' ? ['install'] : ['install'];
    try {
      await run(pm, args, { cwd: targetDir });
    } catch (e) {
      err(`${pm} install failed (continuing):`, e.message);
    }
  }

  // Final handoff
  console.log();
  log('Success! Created a Valet app at:', targetDir);
  console.log();
  console.log('Next steps:');
  console.log(`  cd ${path.relative(process.cwd(), targetDir) || '.'}`);
  if (!opts.install) console.log('  npm install');
  console.log('  npm run dev');
  console.log();
}

function normalizePkgName(input) {
  // turn into kebab, drop invalid chars
  const base = path.basename(input).toLowerCase().replace(/[^a-z0-9-_.]/g, '-');
  return base || 'valet-app';
}

main().catch((e) => {
  err(e.stack || e.message || String(e));
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────
// Feature toggles and file transformations
async function applyFeatureToggles({ targetDir, template, router, zustand, minimal, pathAlias }) {
  const isJS = template === 'js';
  const exts = {
    main: isJS ? 'jsx' : 'tsx',
    app: isJS ? 'jsx' : 'tsx',
    quickstart: isJS ? 'jsx' : 'tsx',
    second: isJS ? 'jsx' : 'tsx',
    presets: isJS ? 'js' : 'ts',
    store: isJS ? 'js' : 'ts',
  };

  const p = (...xs) => path.join(targetDir, ...xs);
  const files = {
    main: p('src', `main.${exts.main}`),
    app: p('src', `App.${exts.app}`),
    quickstart: p('src', 'pages', 'start', `Quickstart.${exts.quickstart}`),
    secondPage: p('src', 'pages', 'second', `SecondPage.${exts.second}`),
    secondDir: p('src', 'pages', 'second'),
    storeDir: p('src', 'store'),
    viteConfig: p(`vite.config.${isJS ? 'js' : 'ts'}`),
    tsconfigApp: p('tsconfig.app.json'),
    jsconfig: p('jsconfig.json'),
    pkg: p('package.json'),
  };

  // Router toggle
  if (!router) {
    safePkgMutate(files.pkg, (pkg) => {
      if (pkg.dependencies && pkg.dependencies['react-router-dom']) delete pkg.dependencies['react-router-dom'];
      return pkg;
    });
    // main.* without BrowserRouter
    const mainNoRouter = isJS
      ? `import React from "react";
import ReactDOM from "react-dom/client";
import "@/presets/globalPresets";
import { App } from "@/App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`
      : `import React from "react";
import ReactDOM from "react-dom/client";
import "@/presets/globalPresets";
import { App } from "@/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;
    fs.writeFileSync(files.main, mainNoRouter);

    // App.* render Quickstart only, keep theme init
    const appNoRouter = isJS
      ? `import { useInitialTheme } from "@archway/valet";
import QuickstartPage from "@/pages/start/Quickstart";

export function App() {
  useInitialTheme(
    {
      fonts: {
        heading: "Kumbh Sans",
        body: "Inter",
        mono: "JetBrains Mono",
        button: "Kumbh Sans",
      },
    },
    ["Kumbh Sans", "JetBrains Mono", "Inter"],
  );
  return <QuickstartPage />;
}
`
      : `import { useInitialTheme } from "@archway/valet";
import QuickstartPage from "@/pages/start/Quickstart";

export function App() {
  useInitialTheme(
    {
      fonts: {
        heading: "Kumbh Sans",
        body: "Inter",
        mono: "JetBrains Mono",
        button: "Kumbh Sans",
      },
    },
    ["Kumbh Sans", "JetBrains Mono", "Inter"],
  );
  return <QuickstartPage />;
}
`;
    fs.writeFileSync(files.app, appNoRouter);

    // Quickstart: remove navigate button and import
    const qsNoNav = isJS
      ? `import { Surface, Stack, Box, Typography } from "@archway/valet";

export default function QuickstartPage() {
  return (
    <Surface>
      <Box alignX="center" centerContent>
        <Stack>
          <Typography>Welcome to Valet</Typography>
        </Stack>
      </Box>
    </Surface>
  );
}
`
      : `import { Surface, Stack, Box, Typography } from "@archway/valet";

export default function QuickstartPage() {
  return (
    <Surface>
      <Box alignX="center" centerContent>
        <Stack>
          <Typography>Welcome to Valet</Typography>
        </Stack>
      </Box>
    </Surface>
  );
}
`;
    fs.writeFileSync(files.quickstart, qsNoNav);

    // Remove second page entirely
    if (fs.existsSync(files.secondDir)) fs.rmSync(files.secondDir, { recursive: true, force: true });
  } else {
    // Router is enabled; if minimal, keep only Quickstart route and remove SecondPage
    if (minimal) {
      const appRouterMinimal = isJS
        ? `import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { useInitialTheme, Surface, Stack, Typography } from "@archway/valet";

const page = (p) => lazy(() => p().then((m) => ({ default: m.default })));
const QuickstartPage = page(() => import("@/pages/start/Quickstart"));

export function App() {
  useInitialTheme(
    {
      fonts: {
        heading: "Kumbh Sans",
        body: "Inter",
        mono: "JetBrains Mono",
        button: "Kumbh Sans",
      },
    },
    ["Kumbh Sans", "JetBrains Mono", "Inter"],
  );

  const Fallback = (
    <Surface>
      <Stack sx={{ padding: "2rem", alignItems: "center" }}>
        <Typography variant="subtitle">Loading…</Typography>
      </Stack>
    </Surface>
  );

  return (
    <Suspense fallback={Fallback}>
      <Routes>
        <Route path="/" element={<QuickstartPage />} />
      </Routes>
    </Suspense>
  );
}
`
        : `import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { useInitialTheme, Surface, Stack, Typography } from "@archway/valet";

const page = <T extends { default: React.ComponentType }>(
  p: () => Promise<T>,
) =>
  lazy(() => p().then((m) => ({ default: m.default })));

const QuickstartPage = page(() => import("@/pages/start/Quickstart"));

export function App() {
  useInitialTheme(
    {
      fonts: {
        heading: "Kumbh Sans",
        body: "Inter",
        mono: "JetBrains Mono",
        button: "Kumbh Sans",
      },
    },
    ["Kumbh Sans", "JetBrains Mono", "Inter"],
  );

  const Fallback = (
    <Surface>
      <Stack sx={{ padding: "2rem", alignItems: "center" }}>
        <Typography variant="subtitle">Loading…</Typography>
      </Stack>
    </Surface>
  );

  return (
    <Suspense fallback={Fallback}>
      <Routes>
        <Route path="/" element={<QuickstartPage />} />
      </Routes>
    </Suspense>
  );
}
`;
      fs.writeFileSync(files.app, appRouterMinimal);

      // Quickstart should not link to non-existent second page
      const qsMinimal = isJS
        ? `import { Surface, Stack, Box, Typography } from "@archway/valet";

export default function QuickstartPage() {
  return (
    <Surface>
      <Box alignX=\"center\" centerContent>
        <Stack>
          <Typography>Welcome to Valet</Typography>
        </Stack>
      </Box>
    </Surface>
  );
}
`
        : `import { Surface, Stack, Box, Typography } from "@archway/valet";

export default function QuickstartPage() {
  return (
    <Surface>
      <Box alignX=\"center\" centerContent>
        <Stack>
          <Typography>Welcome to Valet</Typography>
        </Stack>
      </Box>
    </Surface>
  );
}
`;
      fs.writeFileSync(files.quickstart, qsMinimal);
      if (fs.existsSync(files.secondDir)) fs.rmSync(files.secondDir, { recursive: true, force: true });
    }
  }

  // Zustand toggle
  if (!zustand) {
    safePkgMutate(files.pkg, (pkg) => {
      if (pkg.dependencies && pkg.dependencies['zustand']) delete pkg.dependencies['zustand'];
      return pkg;
    });
    if (fs.existsSync(files.storeDir)) fs.rmSync(files.storeDir, { recursive: true, force: true });
  }

  // Path alias token change across code and config
  if (pathAlias && pathAlias !== '@') {
    // Update Vite alias key
    if (fs.existsSync(files.viteConfig)) {
      const vc = fs.readFileSync(files.viteConfig, 'utf8');
      const updated = vc.replace(/(['"])@(['"])\s*:\s*path\.resolve/g, `$1${pathAlias}$2: path.resolve`);
      fs.writeFileSync(files.viteConfig, updated);
    }
    // Update tsconfig/jsconfig path mapping
    if (!isJS && fs.existsSync(files.tsconfigApp)) {
      const raw = fs.readFileSync(files.tsconfigApp, 'utf8');
      try {
        const j = JSON.parse(raw);
        if (j.compilerOptions && j.compilerOptions.paths) {
          if (j.compilerOptions.paths['@/*']) {
            j.compilerOptions.paths[`${pathAlias}/*`] = j.compilerOptions.paths['@/*'];
            delete j.compilerOptions.paths['@/*'];
          }
        }
        fs.writeFileSync(files.tsconfigApp, JSON.stringify(j, null, 2) + '\n');
      } catch {
        // Very loose fallback: swap the key token only
        const swapped = raw.split('"@/*"').join(`"${pathAlias}/*"`);
        fs.writeFileSync(files.tsconfigApp, swapped);
      }
    }
    if (isJS && fs.existsSync(files.jsconfig)) {
      const raw = fs.readFileSync(files.jsconfig, 'utf8');
      try {
        const j = JSON.parse(raw);
        if (j.compilerOptions && j.compilerOptions.paths) {
          if (j.compilerOptions.paths['@/*']) {
            j.compilerOptions.paths[`${pathAlias}/*`] = j.compilerOptions.paths['@/*'];
            delete j.compilerOptions.paths['@/*'];
          }
        }
        fs.writeFileSync(files.jsconfig, JSON.stringify(j, null, 2) + '\n');
      } catch {
        const swapped = raw.split('"@/*"').join(`"${pathAlias}/*"`);
        fs.writeFileSync(files.jsconfig, swapped);
      }
    }
    // Update source imports '@/...' -> '<alias>/...'
    const srcDir = p('src');
    rewriteAliasInTree(srcDir, '@/', `${pathAlias}/`);
  }
}

function rewriteAliasInTree(rootDir, fromPrefix, toPrefix) {
  for (const entry of fs.readdirSync(rootDir)) {
    const full = path.join(rootDir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) rewriteAliasInTree(full, fromPrefix, toPrefix);
    else if (/\.(t|j)sx?$/.test(entry)) {
      const txt = fs.readFileSync(full, 'utf8');
      // Only replace bare '@/', avoid '@archway/...'
      const updated = txt.replace(/([\'\"])@\//g, `$1${toPrefix}`);
      if (updated !== txt) fs.writeFileSync(full, updated);
    }
  }
}

function safePkgMutate(pkgPath, mutator) {
  const pkg = readJSONSafe(pkgPath);
  if (!pkg) return;
  const next = mutator(pkg) || pkg;
  writeJSON(pkgPath, next);
}
