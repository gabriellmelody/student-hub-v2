export const CURRENT_DAYLO_VERSION =
  typeof __DAYLO_VERSION__ === "string" && __DAYLO_VERSION__.trim()
    ? __DAYLO_VERSION__
    : "0.0.0";

export const VERSION_METADATA_URL = "/version.json";
