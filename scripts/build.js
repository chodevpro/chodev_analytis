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

console.log('[Build] Compiling TypeScript with declarations...');
try {
  const localTsc = path.join(rootDir, 'node_modules/.bin/tsc');
  const feTsc = path.resolve(rootDir, '../../fe_chodev/node_modules/.bin/tsc');
  const tscCmd = fs.existsSync(localTsc) ? `"${localTsc}"` : (fs.existsSync(feTsc) ? `"${feTsc}"` : 'npx tsc');

  execSync(`${tscCmd} -p "${path.join(rootDir, 'tsconfig.build.json')}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('[Build Error] TypeScript compilation failed:', err);
  process.exit(1);
}

// Generate .mjs ESM mirrors for the main entry points
const entries = ['index', 'web', 'react-native', 'core'];

for (const entry of entries) {
  const jsFile = path.join(distDir, `${entry}.js`);
  const mjsFile = path.join(distDir, `${entry}.mjs`);

  if (fs.existsSync(jsFile)) {
    const content = fs.readFileSync(jsFile, 'utf8');
    fs.writeFileSync(mjsFile, content, 'utf8');
  }
}

console.log('[Build] Successfully built @chodev/analytics packages in ./dist');
