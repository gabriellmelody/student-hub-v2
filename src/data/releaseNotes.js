import { CURRENT_DAYLO_VERSION } from "../utils/appVersion.js";

export { CURRENT_DAYLO_VERSION };

export const currentDayloRelease = {
  version: CURRENT_DAYLO_VERSION,
  sections: [
    {
      id: "new",
      title: "New",
      items: [
        "Install DayLo on your phone or computer and open it like an app.",
        "Check your installation and update status from App & updates.",
      ],
    },
    {
      id: "improved",
      title: "Improved",
      items: [
        "Swipe between the main DayLo pages on mobile.",
        "Improved layouts and spacing on smaller phones.",
        "DayLo can check for new versions and update without requiring a reinstall.",
      ],
    },
    {
      id: "fixed",
      title: "Fixed",
      items: [
        "Reduced mobile layout overlaps in Home and More.",
        "Improved handling of stale installed versions after a new DayLo release.",
      ],
    },
  ],
};
