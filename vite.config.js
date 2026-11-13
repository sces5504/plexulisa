import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run phone` serves over HTTPS on the LAN so a phone can use its motion sensors.
export default defineConfig({
  plugins: process.env.PHONE ? [basicSsl()] : [],
  build: { target: 'es2022' },
});
