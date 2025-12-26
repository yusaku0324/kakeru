import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  framework: '@storybook/nextjs-vite',
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
}

export default config
