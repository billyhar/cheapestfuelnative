import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  scheme: 'cheapestfuel',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.billyhar.cheapest-fuel-native',
    associatedDomains: ['applinks:cheapestfuel.app'],
    infoPlist: {
      ...config.ios?.infoPlist,
      UIBackgroundModes: ['remote-notification'],
      NSLocationWhenInUseUsageDescription: "We need your location to show nearby fuel stations and help you find the cheapest fuel prices in your area.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "We need your location to show nearby fuel stations and help you find the cheapest fuel prices in your area.",
      NSLocationAlwaysUsageDescription: "We need your location to show nearby fuel stations and help you find the cheapest fuel prices in your area."
    }
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
    "expo-router",
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#ffffff",
        sounds: ["./assets/sounds/notification.wav"]
      }
    ]
  ],
  extra: {
    ...config.extra,
    eas: {
      projectId: "5654dcdd-46a4-4528-935f-75be868a01e8"
    }
  },
  name: 'CheapestFuel',
  slug: 'cheapestfuel',
});