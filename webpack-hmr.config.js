const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      // Temporarily disable RunScriptWebpackPlugin to prevent multiple instances
      // new RunScriptWebpackPlugin({
      //   name: options.output.filename,
      //   autoRestart: false,
      // }),
    ],
    optimization: {
      ...options.optimization,
      // Optimize memory usage
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          prisma: {
            test: /[\\/]node_modules[\\/]@prisma[\\/]/,
            name: 'prisma',
            chunks: 'all',
            priority: 10,
          },
        },
      },
      // Reduce memory footprint
      removeEmptyChunks: true,
      mergeDuplicateChunks: true,
    },
    resolve: {
      ...options.resolve,
      // Reduce module resolution overhead
      symlinks: false,
    },
    // Memory optimizations
    stats: 'errors-warnings',
  };
};
