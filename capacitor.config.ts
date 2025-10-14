// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dynavista.FMS',
  appName: 'FMS',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'http',   // ★ 추가
  },
};

export default config;
