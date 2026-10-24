# Brand Accent Color System with Dual Dark and Light Theme Support

We will implement a dual dark and light theme system in `frontend-next/` using `next-themes` and Tailwind CSS CSS variables, maintaining Hepozy's signature vibrant orange (`#ff7300`) as the primary brand accent across both modes.

## Status
Accepted

## Context
The legacy application was hardcoded to a dark mode palette with custom CSS variables and inline styles. Modernizing to shadcn/ui provides clean token architecture, but we must preserve Hepozy's brand identity while adding full light theme support.

## Considered Options
1. **Dark Mode Only (Legacy parity)**: Only port the dark styling from `home.css`. Rejected in favor of modern accessible theme toggle support.
2. **Default Neutral/Zinc Monochrome**: Use standard shadcn black-and-white theme. Rejected because it strips away Hepozy's distinct orange branding.
3. **Tailwind CSS Variables with Brand Orange and `next-themes` (Chosen)**: Use CSS custom properties for semantic tokens (`background`, `foreground`, `border`, `muted`) while mapping `primary` to `#ff7300` in both light and dark themes.

## Consequences
- Theme toggling is supported seamlessly via `next-themes` without flash of unstyled content.
- Hepozy's signature orange accent remains consistent across download buttons, quotes, active indicators, and focus states.
