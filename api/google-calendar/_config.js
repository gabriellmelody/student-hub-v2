export const GOOGLE_CALENDAR_REQUIRED_ENV = [
  "GOOGLE_CLASSROOM_CLIENT_ID",
  "GOOGLE_CLASSROOM_CLIENT_SECRET",
  "GOOGLE_CALENDAR_REDIRECT_URI",
];

export function getGoogleCalendarOAuthConfigStatus(
  env = globalThis.process?.env ?? {}
) {
  const missingEnv = GOOGLE_CALENDAR_REQUIRED_ENV.filter((name) => {
    const value = env[name];

    return typeof value !== "string" || value.trim().length === 0;
  });

  return {
    configured: missingEnv.length === 0,
    missingEnv,
    requiredEnv: [...GOOGLE_CALENDAR_REQUIRED_ENV],
  };
}
