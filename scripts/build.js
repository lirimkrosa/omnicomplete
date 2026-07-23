import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'fs';

console.log('🧹 Cleaning dist directory...');
rmSync('./dist', { recursive: true, force: true });
mkdirSync('./dist');

console.log('📦 Bundling with esbuild...');
await build({
  entryPoints: ['bin/cli.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/cli.js',
  minify: true,
});

console.log('📄 Copying specs...');
cpSync('./src/specs', './dist/specs', { recursive: true });

console.log('✅ Build complete! Output is in ./dist');
