# Tailwind 4 exporter — Cobalt tokens handoff

**Exporter:** Tailwind CSS 4 (TeamViewer) · **v1.11.0**

This exporter turns the Cobalt design tokens (Foundations, Semantic, Component) into
Tailwind v4 CSS. It names tokens from their Figma **WEB code syntax**, splits component
tokens into their own file, and validates the output against the Cobalt token rules.

## Supernova settings

| Setting | Value |
|---|---|
| CSS selector | `@theme` |
| Theme selector | `[data-theme="{theme}"]` |
| Component collections | `Component` |
| Mode attribute collections | `level, density` |
| Excluded collections | `Dimension` |
| Validate Cobalt rules | **on** |
| Generate index file | **on** |
| Use code syntax names | **on** (property `Syntax: Web`) |

## Output files

- **`tailwind.css`** — Foundations + Semantic as Tailwind v4 theme tokens in `@theme static`.
  Names are unprefixed (`--color-…`, `--spacing-…`); Tailwind's `prefix(cb)` adds `cb-` at
  runtime, so variables resolve to `--cb-*`.
- **`tailwind.light.css` / `tailwind.dark.css`** — per-mode Semantic colours under
  `[data-theme="light"|"dark"]`. Transparent colours emit
  `color-mix(in srgb, var(--cb-ref-…) N%, transparent)`.
- **`components.css`** — the 1,819 `--cb-cmp-*` component tokens as plain custom properties
  in `:root`. Component→component aliases stay as `var()`; focus-radius as
  `calc(var(radius) + var(offset))`; gradients + shadows included; `[data-level="1..10"]`
  and `[data-density="sm"|"xs"]` blocks at the bottom.
- **`index.css`** — single entry point that imports the four files above.

Import `index.css` and you have everything.

## The build fails (Validate Cobalt rules) when

- a token is missing WEB code syntax;
- a token aliases outside its allowed tier (`--cb-ref-` only from Semantic colours);
- a component value is raw where its property isn't allowed to be;
- an alias cycle, a broken reference, or an unbound gradient stop exists.

Each failure names the offending token(s) so they can be fixed in Figma or excluded.
