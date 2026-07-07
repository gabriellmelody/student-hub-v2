export default function handler(_request, response) {
  // Safe placeholder only: do not exchange auth codes or store tokens yet.
  response.status(501).json({
    ok: false,
    status: "not_implemented",
    message: "Google Classroom OAuth callback is not implemented yet.",
    nextStep:
      "Handle Google auth code exchange securely in a future serverless task.",
  });
}
