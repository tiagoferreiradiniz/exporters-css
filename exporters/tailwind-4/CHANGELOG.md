# Changelog

All notable changes to this project will be documented in this file.

## [1.10.1] - 2026-10-30

### Fixed
- Cobalt rule validation no longer flags tokens in mode-attribute collections (e.g. `level`,
  `density`) as disallowed raw values. These collections hold per-mode raw dimensions by design
  (e.g. `nesting/padding-start` = `4 + 12 × level`), so they are exempt from the raw-value rule.

## [1.10.0] - 2026-10-30

### Added
- Mode-attribute collections (`modeAttributeCollections`, default `["level", "density"]`). A collection
  with several modes is written so its first mode is the base value in `components.css` (`:root`), and
  each other mode becomes a `[data-<collection>="<mode>"]` block appended to `components.css`, e.g.
  `[data-level="1"]` and `[data-density="sm"]`. The extra modes are read from the Supernova themes that
  override the collection's tokens; the attribute value is the mode name. Tokens in these collections are
  treated as component tokens, so their base values live in `components.css` rather than `@theme`.

## [1.9.1] - 2026-10-30

### Fixed
- Gradient colour stops are now written as plain `var()` references (or a `color-mix()` when the stop
  carries opacity) instead of `oklch(var(--x) / 1)`. The colour variables hold full `oklch(...)`
  values, so the old wrapper produced an invalid nested `oklch()`. The gradient is now rendered
  directly, with the angle derived from the Figma from/to points.

## [1.9.0] - 2026-10-30

### Added
- Gradient tokens are now exported as `--gradient-*` custom properties (`--cb-gradient-*` at runtime),
  emitted as `linear-gradient(<angle>deg, var(<stop>) <pos>%, ...)` with each colour stop kept as a
  `var()` reference to its palette colour.
- The export fails, naming the gradient and the stop positions, when a gradient has a colour stop that
  is not bound to a palette colour (only enforced when references are exported).

## [1.8.0] - 2026-10-30

### Added
- A literal focus ring radius (`<x>-radius-focus[-size]`) is exported as
  `calc(var(<x>-radius[-size]) + var(<x>-focus-offset))`, falling back to `<x>-radius` and the shared
  `cmp-control-focus-offset`, so it follows the radius it wraps. The export fails when the literal is
  not that sum.
- `validateCobaltRules`: fails the export, listing every problem, when a component token has a raw
  value its property does not allow (allowed: width, min/max width, min height, height, size,
  overlap, radius-focus, each with an optional suffix), when anything other than a Semantic colour
  aliases the palette (`ref-`), or when aliases form a cycle.

## [1.7.0] - 2026-10-30

### Added
- Colours with opacity whose source only appears in the description (Figma cannot alias a colour
  and change its opacity) are exported as `color-mix()` with that source, e.g.
  "Light: indigo/600 @ 90% · Dark: indigo/500 @ 90%" gives
  `color-mix(in srgb, var(--ref-indigo-600) 90%, transparent)` in the light output. The entry whose
  colour matches the value is used for each theme. Sources can be palette (`ref-*`) or semantic
  (`color-*`) colours. The export fails, naming the token, when the description names sources but
  none of them has the token's colour.

### Fixed
- The base `components.css` uses `:root` when the CSS selector is an at-rule such as `@theme`,
  so component tokens stay plain custom properties.

## [1.6.0] - 2026-10-30

### Added
- `componentCollections`: tokens from these Figma collections (e.g. `Component`) are written to
  `components.css` as plain custom properties under their full code syntax names
  (`--cb-cmp-*`), outside `@theme`, and reference other tokens by their full names
  (`var(--cb-spacing-3)`). Theme overrides of component tokens go to `components.<theme>.css`.
- A colour that aliases another colour with its own opacity (e.g. neutral/500 @ 20%) is exported
  as `color-mix(in srgb, var(--ref-neutral-500) 20%, transparent)` instead of a resolved colour.

### Fixed
- Font weights that arrive as generic dimensions are exported unitless (`800`, not `800px`),
  based on their code syntax name, when no `tokenPathUnits` rule matches their path.

## [1.5.3] - 2026-10-30

### Fixed
- A token that aliases a token in an excluded collection is exported with its resolved value
  instead of failing with "unknown referenced token". Theme overrides are handled too.
- References to tokens that are not in the export at all (deleted in Figma, not re-synced)
  are reported for all tokens in one error, by token path, instead of a bare token id.

## [1.5.2] - 2026-10-30

### Fixed
- `excludedCollections` now works: the `Collection` property is a select, so its option id
  is resolved to the collection name before matching.
- Missing code syntax is reported for all tokens in one error (first 50, with collection),
  instead of failing on the first one.
- Tokens from Figma styles (typography, shadow, gradient, blur) have no code syntax and keep
  their derived name instead of failing the export.

## [1.5.1] - 2026-10-30

### Fixed
- `codeSyntaxProperty` now matches Figma's "Syntax: Web" property: a leading "Syntax:" is
  ignored, so the previous default `Web` keeps working. The default is now `Syntax: Web`.
- The missing-code-syntax error also shows the token's collection, to make exclusions easier.

## [1.5.0] - 2026-10-30

### Added
- `useCodeSyntaxNames` (default off): name each token by its WEB code syntax from Figma,
  verbatim, instead of deriving a name from its path. A token without code syntax fails the
  export with the list of custom properties it does carry. When `globalPrefix` is set, it is
  removed from names inside `@theme`, since Tailwind's `prefix()` adds it back.
- `codeSyntaxProperty` (default `Web`): the custom property that holds the WEB code syntax.
- `excludedCollections`: leave out tokens from the named Figma collections (matched against
  the token's `Collection` property), e.g. `["Dimension"]`.

## [1.4.0] - 2026-10-16

### Added
- `includeTailwindImport` (default on): turn off to export a tokens-only `tailwind.css`
  without `@import "tailwindcss"`.
- `themeDirective` (default `inline`): write `@theme` or `@theme static` instead of
  `@theme inline` when tokens reference other tokens, so theme files can override
  referenced tokens and dark mode keeps working with references enabled.
- `groupPrefixOverrides`: choose the Tailwind namespace by token group path instead of
  token type, e.g. `{ "breakpoint": "breakpoint", "container": "container", "perspective": "perspective" }`.
  A matching `tokenPathPrefixes` rule takes precedence.

### Fixed
- Font family stacks (values containing commas or quotes) are no longer wrapped in an extra
  pair of quotes, which made `--font-sans`, `--font-mono` and `--font-serif` invalid.
- A token name with a leading minus (`-px`) is exported as `neg-px` instead of colliding with `px`.
- Repeated numbers in a token name are no longer treated as duplicates: `5_5` is exported as
  `5-5` instead of colliding with `5` (fix in the shared `NamingHelper`).
- Theme files no longer contain reset rules such as `--color-*: initial;`, which are only
  valid inside `@theme`.

## [1.3.0] - 2026-08-10

### Changed
- Forked as a TeamViewer custom exporter: `id` is now `teamviewer.exporter-tailwind-4`
  so it installs alongside the official Tailwind exporter instead of colliding with it.
- Units and namespaces are resolved from the token **path** rather than the token type,
  via the new `tokenPathUnits` and `tokenPathPrefixes` settings. A design system imported
  from Figma commonly types every scalar as a generic `Dimension`, which makes the token
  type useless as a signal and collapses the whole system into `--spacing-*`.
- `reference/spacing/*` and `reference/font-size/*` are emitted in `rem`;
  `radius`, `line-height` and `letter-spacing` keep their authored pixels;
  `font-weight` has its unit stripped.
- `remBase` is no longer gated behind `forceRemUnit`, since path rules perform rem
  conversion with `forceRemUnit` off.
- Typography line heights are emitted as unitless ratios of their font size, matching
  Tailwind's own `--text-sm--line-height: calc(1.25 / 0.875)` pairing. A composite
  authored as `14px / 20px` now emits `1.4286` rather than `20px`, so line boxes stay
  proportional when a reader scales text or applies a text-spacing override
  (WCAG 1.4.12). The authored value is still used where a ratio would be meaningless -
  no font size, a zero font size, or mismatched units - and a percentage line height is
  converted directly. Standalone `--leading-*` tokens keep their pixels, having no font
  size to form a ratio with.

### Fixed
- Font weights are no longer emitted as `--spacing-reference-font-weight-600: 37.5rem`.
  They are typed as generic dimensions carrying `600px`, so the previous type-based rule
  converted them as spacing. They now emit `--font-weight-600: 600`.
- Radius, line height and letter spacing are no longer converted to `rem`. The previous
  rule listed `Dimension` as a rem type, which caught every generically-typed token
  including the ones meant to stay in pixels.
- `forceRemUnit` still converts every pixel value, so existing pipelines that enable it are
  unaffected.

## [1.1.1] - 2025-09-10
- Fix spacing token output: generate `--spacing-*` instead of `--size-*` for sizing. Thanks @mickaelnijean for contribution!

## [1.1.0] - 2025-07-18

### Added
- OKLCH utility variable support for color tokens referenced with opacity
- Automatic generation of `--oklch-*` variables for color tokens used in shadows, borders, and gradients with custom opacity
- Support for `oklch(var(--oklch-...) / alpha)` syntax when using OKLCH color formats
- Proper color function selection (oklch vs rgba) based on configured color format

### Changed
- Updated color reference handling to use channel-based utility variables for better opacity control
- Improved compatibility with modern CSS color spaces

## [1.0.0] - 2025-04-07

### Added
- Initial release of the Tailwind CSS Exporter
- Support for all Supernova token types (that are also supported by Tailwind config)
- Branding and theming support
- Customizable output formatting
- Comment support for token descriptions
- File organization options (single file or separate by type)
- Reset rules functionality (can be in separate file or main CSS file)
- Typography classes generation
- Comprehensive configuration options for all aspects of the exporter