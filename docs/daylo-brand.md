# DayLo brand foundation

## Name

- **Official product name:** DayLo
- **Descriptor:** Student Hub
- Preferred lockup: **DayLo — Student Hub**

DayLo is the primary brand name. Student Hub describes the product and should not replace the DayLo wordmark.

## Colours

| Role | Name | Value |
| --- | --- | --- |
| Primary brand | Midnight Navy | `#10213C` |
| Direction and horizon | Sky Blue | `#73A8DF` |
| Sunrise and optimism | Sunrise Peach | `#FFA36B` |
| Light app-icon surface | Pale Mist | `#F2F6F8` |
| Success | Success Green | `#38A169` |
| Warning | Warning Gold | `#D99624` |
| Overdue and error | Danger Red | `#D9534F` |

Semantic colours remain separate from the three core brand colours.

## Assets

- `public/brand/daylo-icon.svg`: primary colour icon for the sidebar, onboarding and brand surfaces.
- `public/brand/daylo-icon-navy.svg`: single-colour icon for light or monochrome layouts.
- `public/brand/daylo-icon-white.svg`: single-colour icon for dark backgrounds.
- `public/brand/daylo-logo-horizontal.svg`: icon and primary DayLo wordmark.
- `public/brand/daylo-lockup.svg`: optional DayLo lockup with the Student Hub descriptor.
- `public/brand/daylo-wordmark.svg`: DayLo wordmark without the icon.
- `public/brand/daylo-favicon.svg`: simplified small-size favicon.
- `public/brand/daylo-app-icon.svg`: square source artwork for app icons.
- `public/icons/daylo-32.png`, `daylo-192.png`, and `daylo-512.png`: raster app icons with safe padding.

Use the colour icon for standard product surfaces, the white icon on Midnight Navy or other dark backgrounds, and the square app icon files for installed-app or launcher contexts.

## Implementation note

The CSS variables in `src/styles/foundation.css` are foundation tokens only. They do not replace the current theme system yet.

Do not casually rename existing Student Hub localStorage keys, API directories, environment variables, repository names or deployment identifiers during future visual rebrand work.
