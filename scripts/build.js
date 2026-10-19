const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('[Build] Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

console.log('[Build] Compiling TypeScript declaration files (.d.ts)...');
try {
  const localTsc = path.join(rootDir, 'node_modules/.bin/tsc');
  const feTsc = path.resolve(rootDir, '../../fe_chodev/node_modules/.bin/tsc');
  const tscCmd = fs.existsSync(localTsc) ? `"${localTsc}"` : (fs.existsSync(feTsc) ? `"${feTsc}"` : 'npx tsc');

  execSync(`${tscCmd} -p "${path.join(rootDir, 'tsconfig.build.json')}" --declaration --emitDeclarationOnly --outDir "${distDir}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('[Build Error] TypeScript declarations failed:', err);
  process.exit(1);
}

console.log('[Build] Bundling ESM (.mjs) and CommonJS (.js) with esbuild...');
try {
  const esbuildPath = require.resolve('esbuild', {
    paths: [rootDir, path.resolve(rootDir, '../../fe_chodev')],
  });
  const esbuild = require(esbuildPath);

  const entryPoints = {
    index: path.join(rootDir, 'src/index.ts'),
    web: path.join(rootDir, 'src/web.ts'),
    'react-native': path.join(rootDir, 'src/react-native.ts'),
    core: path.join(rootDir, 'src/core.ts'),
  };

  // Build ESM (.mjs)
  esbuild.buildSync({
    entryPoints,
    bundle: true,
    packages: 'external',
    format: 'esm',
    outdir: distDir,
    outExtension: { '.js': '.mjs' },
    sourcemap: true,
    target: ['es2022'],
  });

  // Build CommonJS (.js)
  esbuild.buildSync({
    entryPoints,
    bundle: true,
    packages: 'external',
    format: 'cjs',
    outdir: distDir,
    outExtension: { '.js': '.js' },
    sourcemap: true,
    target: ['es2022'],
  });

  console.log('[Build] Successfully built dual ESM/CJS @chodev/analytics packages in ./dist');
} catch (err) {
  console.error('[Build Error] esbuild failed:', err);
  process.exit(1);
}

