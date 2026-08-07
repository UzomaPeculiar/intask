import { redirect } from "@tanstack/react-router";

export const MVP_HOME_ROUTE = "/app" as const;

export const MVP_FEATURES = {
  marketplace: true,
  tasks: true,
  applications: true,
  messaging: true,
  profiles: true,
  verification: true,
  payments: true,
  escrow: true,
  wallet: true,
  withdrawals: true,
  reviews: true,
  notifications: true,
  disputes: true,
  admin: true,
  learn: false,
  courses: false,
  assessments: false,
  mentorship: false,
  internships: false,
  alumniPro: false,
  partnerships: false,
  subscriptions: false,
  rooms: true,
  featuredTasks: false,
  advancedAnalytics: false,
  advancedTalentDiscovery: false,
} as const;

export type MvpFeatureKey = keyof typeof MVP_FEATURES;

export function ensureMvpFeatureEnabled(feature: MvpFeatureKey) {
  if (!MVP_FEATURES[feature]) {
    throw redirect({ to: MVP_HOME_ROUTE });
  }
}
