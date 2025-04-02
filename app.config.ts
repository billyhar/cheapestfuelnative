import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  scheme: 'cheapestfuel',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.billyhar.cheapest-fuel-native',
    associatedDomains: ['applinks:cheapestfuel.app']
  },
  android: {
    ...config.android,
    package: 'com.cheapestfuel.app',
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "*.cheapestfuel.app",
            pathPrefix: "/auth/callback"
          },
          {
            scheme: "cheapestfuel",
            host: "auth",
            pathPrefix: "/callback"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      }
    ]
  },
  plugins: [
    "expo-router"
  ],
  extra: {
    ...config.extra,
    eas: {
      projectId: "your-project-id"
    }
  },
  name: 'CheapestFuel',
  slug: 'cheapest-fuel',
});