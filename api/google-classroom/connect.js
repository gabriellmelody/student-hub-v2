export default function handler(_request, response) {
  // Safe placeholder only: do not redirect to Google or read OAuth secrets yet.
  response.status(501).json({
    ok: false,
    status: "not_configured",
    message: "Google Classroom OAuth is not configured yet.",
    nextStep:
      "Add Google OAuth environment variables and implement the authorization redirect in a future task.",
  });
}
