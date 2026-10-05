import { defineConfig } from '@playwright/test';
const live = process.env.FABOPS_LIVE === '1';
export default defineConfig({ testDir:'./tests', timeout:live?660_000:30_000, use:{baseURL:live?(process.env.FABOPS_BASE_URL || 'http://127.0.0.1:4317'):'http://127.0.0.1:4200',viewport:{width:1440,height:1000}}, webServer:live?undefined:{command:'npm run dev',url:'http://127.0.0.1:4200',reuseExistingServer:!process.env.CI}, reporter:'list' });
