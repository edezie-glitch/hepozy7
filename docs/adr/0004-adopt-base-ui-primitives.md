# Adopt Base UI Primitives Over Radix UI

We will adopt `@base-ui/react` (MUI's unstyled primitives) as the foundational headless component primitive library in `frontend-next/`, replacing Radix UI primitives.

## Status
Accepted

## Context
Radix UI was initially planned for accessible unstyled primitives in `frontend-next/`. However, Radix UI has encountered maintenance slowdowns, peer dependency issues with React 19, and composition edge cases associated with `React.cloneElement` in its `Slot` / `asChild` pattern. 

In modern UI ecosystems (including shadcn), Base UI (`@base-ui/react`) has emerged as the modern headless standard, designed specifically for React 19, Server Components, and native CSS features with first-class `render` prop composition.

## Considered Options
1. **Retain Radix UI (`@radix-ui/*`)**: Continue using Radix UI primitives. Rejected due to maintenance stagnation, React 19 friction, and `cloneElement` limitations with `asChild`.
2. **React Aria Components (`react-aria-components`)**: Adopt Adobe's React Aria library. Rejected due to higher API surface complexity and heavy opinionated DOM hierarchies.
3. **Adopt Base UI (`@base-ui/react`) (Chosen)**: Use MUI's Base UI library. Offers native React 19 support, clean `render` prop composition without `cloneElement` collisions, built-in transition support, and full ARIA compliance while maintaining backwards compatibility with `asChild`.

## Consequences
- `@radix-ui/react-slot` is replaced with `@base-ui/react`.
- Components such as `Button` utilize Base UI primitives and provide both the native `render` prop and an `asChild` adapter for backwards compatibility.
- Future primitives (Dialog, DropdownMenu, Tooltip, Popover) will build on `@base-ui/react` primitives styled with Tailwind CSS v4 and brand tokens.
