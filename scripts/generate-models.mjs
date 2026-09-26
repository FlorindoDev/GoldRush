import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(workspace, 'public/assets/models');
const onlyIds = (process.argv.find((arg) => arg.startsWith('--only='))?.slice(7) ?? '')
  .split(',')
  .filter(Boolean);
const bundle = await build({
  entryPoints: [resolve(workspace, 'scripts/models/export-library.mjs')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'ModelLibrary',
  platform: 'browser',
});
const server = createServer(async (request, response) => {
  if (request.url.startsWith('/source/')) {
    const sourceRoot = resolve(workspace, 'scripts/models/source');
    const target = resolve(sourceRoot, request.url.slice('/source/'.length));
    if (!target.startsWith(sourceRoot + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      response.end(await readFile(target));
    } catch {
      response.writeHead(404).end();
    }
    return;
  }
  response.setHeader(
    'Content-Type',
    request.url === '/bundle.js' ? 'text/javascript' : 'text/html',
  );
  response.end(
    request.url === '/bundle.js'
      ? bundle.outputFiles[0].text
      : '<!doctype html><script src="/bundle.js"></script>',
  );
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({
    channel: process.env['MODEL_BROWSER'] ?? 'msedge',
    headless: true,
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(error.message));
  await page.exposeFunction('saveModel', async (relativePath, base64) => {
    const target = resolve(output, relativePath);
    if (!target.startsWith(output + sep)) {
      throw new Error('Asset path outside models directory');
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(base64, 'base64'));
    console.log(relativePath);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const manifest = await page.evaluate(
    (ids) => ModelLibrary.exportLibrary(window.saveModel, ids),
    onlyIds,
  );
  if (onlyIds.length) {
    const existing = JSON.parse(await readFile(resolve(output, 'catalog.json'), 'utf8'));
    const updatedIds = new Set(manifest.models.map((model) => model.id));
    manifest.models = [
      ...existing.models.filter((model) => !updatedIds.has(model.id)),
      ...manifest.models,
    ];
  }
  await writeFile(resolve(output, 'catalog.json'), JSON.stringify(manifest, null, 2) + '\n');
  await copyFile(
    resolve(workspace, 'scripts/models/source/bitcoin/license.txt'),
    resolve(output, 'coins/bitcoin-license.txt'),
  );
  console.log(`Generated ${manifest.models.length} catalog entries.`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
