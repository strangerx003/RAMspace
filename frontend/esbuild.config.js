const esbuild = require('esbuild');
const path = require('path');

const isProd = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, 'src/index.tsx')],
  bundle: true,
  outfile: path.join(__dirname, 'public/bundle.js'),
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
