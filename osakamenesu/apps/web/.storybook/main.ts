import path from 'path'
import type { StorybookConfig } from '@storybook/react-webpack5'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  webpackFinal: async config => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, '../src'),
    }
    config.module = config.module || { rules: [] }
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.[jt]sx?$/,
      use: {
        loader: require.resolve('babel-loader'),
        options: {
          presets: [
            [
              require.resolve('@babel/preset-react'),
              { runtime: 'automatic' },
            ],
            require.resolve('@babel/preset-typescript'),
          ],
        },
      },
      exclude: /node_modules/,
    })
    return config
  },
}

export default config
