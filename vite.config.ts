/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/wyboryzator2024/',
  plugins: [preact()],
  test: { environment: 'node' },
});
