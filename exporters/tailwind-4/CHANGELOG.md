# Changelog

All notable changes to this project will be documented in this file.

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