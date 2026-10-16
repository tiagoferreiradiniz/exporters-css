# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-10-16

### Added
- `includeTailwindImport` (default on): turn off to export a tokens-only `tailwind.css`
  without `@import "tailwindcss"`.
- `themeDirective` (default `inline`): write `@theme` or `@theme static` instead of
  `@theme inline` when tokens reference other tokens, so theme files can override
  referenced tokens and dark mode keeps working with references enabled.
- `groupPrefixOverrides`: choose the Tailwind namespace by token group path instead of
  token type, e.g. `{ "breakpoint": "breakpoint", "container": "container", "perspective": "perspective" }`.

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
- Rem conversion is now decided per token type instead of globally. Space, Size, Dimension
  and FontSize tokens are emitted in `rem`; BorderRadius, Blur, BorderWidth and Shadow keep
  their authored pixel values.
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