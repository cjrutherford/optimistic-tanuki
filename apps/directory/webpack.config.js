const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
module.exports = {
  output: { path: join(__dirname, '../../dist/apps/directory') },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      additionalEntryPoints: ['./src/register-recovery-begin-operator.ts'],
      tsConfig: './tsconfig.json',
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      externalDependencies: 'all',
    }),
  ],
};
