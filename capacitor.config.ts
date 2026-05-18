import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.idaodo.game',
  appName: 'Ida & Odo',
  webDir: 'www',
  plugins: {
    AdMob: {
      // TODO RELEASE: Replace both IDs with real App IDs from AdMob console.
      // These are Google's public test IDs — ads won't earn revenue and
      // the app may be rejected if submitted with these values.
      appIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
      appIdIos:     'ca-app-pub-3940256099942544~1458002511',
    }
  }
};

export default config;
