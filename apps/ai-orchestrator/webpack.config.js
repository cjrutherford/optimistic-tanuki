const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  entry: {
    main: './src/main.ts',
    benchmark: './src/benchmark.ts',
  },
  output: {
    filename: '[name].js',
    path: join(__dirname, '../../dist/apps/ai-orchestrator'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
    }),
  ],
};
