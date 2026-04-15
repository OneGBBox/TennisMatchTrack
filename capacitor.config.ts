import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tennismatchtrack.app',
  appName: 'TennisMatchTrack',
  webDir: 'dist/tennis-match-track/browser',
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
