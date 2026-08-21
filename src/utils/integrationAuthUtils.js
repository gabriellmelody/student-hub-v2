export function getIntegrationAuthHeaders(accessToken, headers = {}) {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  return { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
