#!/usr/bin/env node
// Validate @archway/create-valet-app templates and flags by generating real apps
// and running lint/typecheck/build (+ optional preview) in a temp workspace.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CLI = path.join(ROOT, 'bin', 'create-valet-app.js');

const args = process.argv.slice(2);
const opts = {
  noPreview: args.includes('--no-preview'),
  only: null,
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--only') opts.only = args[i + 1];
}

const scenarios = [
  { id: 'ts:default', template: 'ts', flags: [] },
  { id: 'js:default', template: 'js', flags: [] },
  { id: 'hybrid:default', template: 'hybrid', flags: [] },
  { id: 'ts:no-router', template: 'ts', flags: ['--no-router'] },
  { id: 'js:minimal', template: 'js', flags: ['--minimal'] },
  { id: 'hybrid:no-zustand', template: 'hybrid', flags: ['--no-zustand'] },
  { id: 'ts:alias-app', template: 'ts', flags: ['--path-alias', 'app'] },
].filter((s) => (opts.only ? s.id === opts.only : true));

function run(cmd, argv, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', (code) => {
      resolve({ code, out, err });
    });
    child.on('error', (e) => reject(e));
  });
}

function logLine(line) {
  process.stdout.write(line + '\n');
}

async function install(cwd) {
  return await run('npm', ['install', '--no-audit', '--no-fund'], cwd);
}

async function lint(cwd) {
  return await run('npm', ['run', '-s', 'lint:agent'], cwd);
}

async function typecheck(cwd, template) {
  if (template === 'js') return { code: 0, out: 'TYPECHECK_STATUS:skipped', err: '' };
  return await run('npm', ['run', '-s', 'typecheck:agent'], cwd);
}

async function build(cwd) {
  return await run('npm', ['run', '-s', 'build:agent'], cwd);
}

async function preview(cwd) {
  const port = 5173 + Math.floor(Math.random() * 1000);
  const p = spawn('npx', ['vite', 'preview', '--strictPort', '--port', String(port)], {
    cwd,
    env: process.env,
    stdio: 'pipe',
  });
  let ready = false;
  let out = '';
  p.stdout.on('data', (d) => {
    out += d.toString();
    if (/Local:\s*http:\/\/localhost:/.test(out)) ready = true;
  });
  // Wait up to ~12s for server, then fetch /
  const started = Date.now();
  while (!ready && Date.now() - started < 12000) {
    await new Promise((r) => setTimeout(r, 200));
  }
  let status = 0;
  try {
    const res = await fetch(`http://localhost:${port}/`);
    status = res.status;
  } catch {}
  p.kill('SIGTERM');
  return { code: status === 200 ? 0 : 1, out: `PREVIEW_STATUS:${status === 200 ? 'ok' : 'fail'}`, err: '' };
}

async function runScenario(baseDir, s) {
  const dir = path.join(baseDir, s.id.replace(/[:]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const appDir = path.join(dir, 'app');
  const cliArgs = ['node', CLI, appDir, '--template', s.template, '--install', '--no-mcp', ...s.flags];
  logLine(`[validate] ${s.id} -> generate`);
  const gen = await run(cliArgs[0], cliArgs.slice(1), ROOT);
  if (gen.code !== 0) return { id: s.id, ok: false, reason: 'generate', logs: gen.out + gen.err };

  logLine(`[validate] ${s.id} -> lint`);
  const lintRes = await lint(appDir);
  const lintOk = /LINT_STATUS:ok/.test(lintRes.out) || lintRes.code === 0;

  logLine(`[validate] ${s.id} -> typecheck`);
  const typeRes = await typecheck(appDir, s.template);
  const typeOk = /TYPECHECK_STATUS:ok/.test(typeRes.out) || s.template === 'js' || typeRes.code === 0;

  logLine(`[validate] ${s.id} -> build`);
  const buildRes = await build(appDir);
  const buildOk = /BUILD_STATUS:ok/.test(buildRes.out) || buildRes.code === 0;

  let prevOk = true;
  let prevRes = { out: 'PREVIEW_STATUS:skipped' };
  if (!opts.noPreview) {
    logLine(`[validate] ${s.id} -> preview`);
    prevRes = await preview(appDir);
    prevOk = prevRes.code === 0;
  }

  const ok = lintOk && typeOk && buildOk && prevOk;
  return {
    id: s.id,
    ok,
    results: {
      lint: lintOk ? 'ok' : 'fail',
      typecheck: typeOk ? 'ok' : 'fail',
      build: buildOk ? 'ok' : 'fail',
      preview: prevOk ? 'ok' : 'fail',
    },
    logs: { gen, lintRes, typeRes, buildRes, prevRes },
  };
}

(async function main() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cva-validate-'));
  logLine(`[validate] workspace: ${baseDir}`);
  const results = [];
  for (const s of scenarios) {
    const res = await runScenario(baseDir, s);
    results.push(res);
    const summary = `[validate] ${s.id} -> LINT:${res.results?.lint || 'fail'} TYPECHECK:${res.results?.typecheck || 'fail'} BUILD:${res.results?.build || 'fail'} PREVIEW:${res.results?.preview || 'skipped'}`;
    logLine(summary);
    if (!res.ok) {
      logLine(`[validate] FAILED: ${s.id}`);
      break;
    }
  }
  const allOk = results.length && results.every((r) => r.ok);
  logLine(`[validate] summary: ${results.map((r) => `${r.id}:${r.ok ? 'ok' : 'fail'}`).join(' ')}`);
  process.exit(allOk ? 0 : 1);
})();

