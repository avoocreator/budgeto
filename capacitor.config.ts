import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.budgeto.app",
  appName: "Budgeto",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_budgeto",
      iconColor: "#0d1210",
    },
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
