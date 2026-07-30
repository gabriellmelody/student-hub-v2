export const GOOGLE_CLASSROOM_REQUIRED_ENV = [
  // Student Hub currently uses one shared Google OAuth Web Client for Google
  // school integrations. Keep these env names for deployment compatibility.
  "GOOGLE_CLASSROOM_CLIENT_ID",
  "GOOGLE_CLASSROOM_CLIENT_SECRET",
  "GOOGLE_CLASSROOM_REDIRECT_URI",
];

export function getGoogleClassroomOAuthConfigStatus(
  env = globalThis.process?.env ?? {}
) {
  const missingEnv = GOOGLE_CLASSROOM_REQUIRED_ENV.filter((name) => {
    const value = env[name];

    return typeof value !== "string" || value.trim().length === 0;
  });

  return {
    configured: missingEnv.length === 0,
    missingEnv,
    requiredEnv: [...GOOGLE_CLASSROOM_REQUIRED_ENV],
  };
}
