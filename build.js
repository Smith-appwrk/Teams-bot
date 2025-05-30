const esbuild = require('esbuild');
esbuild.build({
    entryPoints: ['server/index.js'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/index.js',
    external: ['typescript'], // Mark typescript as external
    loader: { '.ts': 'js' }, // Handle TypeScript files
})
    .then((r) => {
        console.log(`Build succeeded.`);
    })
    .catch((e) => {
        console.log("Error building:", e.message);
        process.exit(1);
    });