const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isProd = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');
const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
const outfile = path.join(__dirname, `public/bundle.${dateStr}.js`);

// Update index.html to reference the new bundle
const indexPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/src="bundle\.\d+\.js"/, `src="bundle.${dateStr}.js"`);
fs.writeFileSync(indexPath, html);

const buildOptions = {
  entryPoints: [path.join(__dirname, 'src/index.tsx')],
  bundle: true,
  outfile,
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
  minify: isProd,
  sourcemap: !isProd,
  define: { 'process.env.NODE_ENV': isProd ? '"production"' : '"development"' },
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build complete.');
  }
}

main().catch(() => process.exit(1));
