import { build } from 'esbuild';
import { chmod, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/extension/extension.ts'], outfile: 'dist/extension.cjs', bundle: true, platform: 'node', target: 'node20', format: 'cjs', external: ['vscode'], logLevel: 'info' });
await build({ entryPoints: ['src/cli.ts'], outfile: 'dist/mascot.mjs', bundle: true, platform: 'node', target: 'node22', format: 'esm', banner: { js: '#!/usr/bin/env node' }, logLevel: 'info' });
await build({ entryPoints: ['src/webview/main.tsx'], outfile: 'dist/webview.js', bundle: true, platform: 'browser', target: 'es2022', minify: true, logLevel: 'info' });
await chmod('dist/mascot.mjs', 0o755);
await sharp('media/brand.svg').resize(256, 256).png().toFile('media/icon.png');
