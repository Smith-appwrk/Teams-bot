const esbuild = require('esbuild');
esbuild.build({
    entryPoints: ['server/index.js'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/index.js',
    // Exclude native modules and their dependencies from bundling
    external: [
        'typescript',
        'canvas', // Native module with .node bindings
        'chart.js', // Used with require.resolve
        'chartjs-node-canvas', // Depends on canvas
        '@mapbox/node-pre-gyp', // Native module helper
        'node-gyp'
    ],
    loader: { '.ts': 'js' }, // Handle TypeScript files
})
    .then((r) => {
        console.log(`Build succeeded.`);
    })
    .catch((e) => {
        console.log("Error building:", e.message);
        process.exit(1);
    });