const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/civic-briefing'),
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      // The replay entry for the parity gate (tools/civic-parity, P2.4).
      additionalEntryPoints: [
        { entryName: 'replay', entryPath: './src/replay.ts' },
        // Published briefings for the end-to-end suites (P4.5, D28).
        { entryName: 'seed-e2e', entryPath: './src/seed-e2e.ts' },
      ],
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMaps: true,
    }),
  ],
};
