// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dynavista.FMS',
  appName: 'FMS',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'http://192.168.69.152:8081',
    cleartext: true,
    androidScheme: 'http',
  },
};

export default config;
