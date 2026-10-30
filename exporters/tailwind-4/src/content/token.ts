import { NamingHelper, CSSHelper, GeneralHelper, StringCase } from "@supernovaio/export-utils"
import { Token, TokenGroup, TokenType, TypographyTokenValue, FontSizeTokenValue, LineHeightTokenValue, LetterSpacingTokenValue, FontWeightTokenValue, TypographyToken, AnyDimensionTokenValue, AnyTokenValue, AnyToken, Unit } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { FindReplaceTiming } from "../../config"
import {
  TAILWIND_TOKEN_PREFIXES,
  TAILWIND_ALLOWED_CUSTOMIZATION,
  REM_TYPOGRAPHY_PROPERTY_TYPES,
  DEFAULT_TOKEN_PATH_UNITS,
  DEFAULT_TOKEN_PATH_PREFIXES,
  UNITLESS_NAMESPACES,
  UnitTreatment
} from "../constants/defaults"
import { codeSyntaxName, stripTailwindPrefix, runtimeVariableName, isComponentToken } from "./code-syntax"
import { ColorHelper } from "@supernovaio/export-utils"
import { ColorFormat } from "@supernovaio/export-utils"

/**
 * Gets the prefix for a specific token type based on configuration.
 * Uses either custom prefixes from configuration or default prefixes.
 * @param tokenType - The type of token (e.g., color, typography, etc.)
 * @returns The prefix string to use for this token type
 */
export function getTokenPrefix(tokenType: TokenType): string {
  return TAILWIND_TOKEN_PREFIXES[tokenType]
}

/**
 * Check if a token type is allowed for customization in Tailwind
 * @param tokenType The token type to check
 * @returns True if the token type is allowed in Tailwind customization
 */
export function isAllowedTokenType(tokenType: TokenType): boolean {
  return TAILWIND_ALLOWED_CUSTOMIZATION.includes(tokenType)
}

/**
 * Builds the full slash-separated path of a token, including its own name.
 * Lowercased so path rules can be written without worrying about casing.
 *
 * @param token - The token to build a path for
 * @returns The full token path, e.g. "reference/font-weight/600"
 */
function fullTokenPath(token: Token): string {
  return [...(token.tokenPath || []), token.name].join("/").toLowerCase()
}

/**
 * Finds the longest path prefix in `rules` that the token's path starts with.
 * Longest wins so a specific path can override a broader one.
 *
 * @param token - The token to match
 * @param rules - Map of path prefix to value
 * @returns The value for the longest matching prefix, or undefined if none match
 */
function matchByTokenPath<T>(token: Token, rules: Record<string, T>): T | undefined {
  const path = fullTokenPath(token)

  const matched = Object.keys(rules)
    .filter((prefix) => path.startsWith(prefix.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0]

  return matched === undefined ? undefined : rules[matched]
}

/**
 * Resolves how a token's unit should be treated, based on its path.
 *
 * Falls back to `px` - the authored value - when no rule matches, so an
 * unrecognised token is passed through rather than silently converted.
 *
 * @param token - The token being converted
 * @returns The unit treatment to apply
 */
export function resolveUnitTreatment(token: Token): UnitTreatment {
  const rules = exportConfiguration.tokenPathUnits ?? DEFAULT_TOKEN_PATH_UNITS
  return matchByTokenPath(token, rules) ?? unitTreatmentFromCodeSyntax(token) ?? "px"
}

/**
 * Resolves a unit treatment from the token's code syntax name, for tokens whose
 * path matches no rule. Font weights arrive from Figma as generic dimensions, so
 * without this they are emitted as `800px`.
 *
 * @param token - The token being converted
 * @returns The unit treatment for the name's namespace, or undefined if none applies
 */
function unitTreatmentFromCodeSyntax(token: Token): UnitTreatment | undefined {
  const name = codeSyntaxName(token)
  if (!name) return undefined

  const namespace = stripTailwindPrefix(name)
  return UNITLESS_NAMESPACES.some((prefix) => namespace.startsWith(prefix)) ? "unitless" : undefined
}

/**
 * Decides whether a token's pixel value should be converted to rem.
 *
 * The global `forceRemUnit` setting still acts as a master override that converts
 * everything, preserving the previous behaviour for anyone who relies on it.
 *
 * @param token - The token being converted
 * @returns True if the pixel value should become rem
 */
export function shouldForceRem(token: Token): boolean {
  return exportConfiguration.forceRemUnit || resolveUnitTreatment(token) === "rem"
}

/**
 * Decides whether a typography sub-property should be converted to rem.
 *
 * Typography tokens are composites whose sub-values carry no path, so they are
 * dispatched on type rather than on path.
 *
 * @param tokenType - The type the sub-property maps to
 * @returns True if the pixel value should become rem
 */
export function shouldForceRemForTypographyProperty(tokenType: TokenType): boolean {
  return exportConfiguration.forceRemUnit || REM_TYPOGRAPHY_PROPERTY_TYPES.has(tokenType)
}

/**
 * Strips the unit from a numeric CSS value, leaving the bare number.
 *
 * Only a plain number followed by a unit is touched, so `var(--x)` references and
 * multi-part values such as shadows are returned unchanged.
 *
 * @param value - The CSS value to strip
 * @returns The value without its unit, or the original value if it does not match
 */
function stripUnit(value: string): string {
  const match = value.match(/^(-?\d*\.?\d+)(px|rem|em|%)$/)
  return match ? match[1] : value
}

/**
 * Applies the `unitless` treatment to a token value where the token's path calls
 * for it. Returns undefined when no transformation applies, which is the contract
 * `CSSHelper`'s valueTransformer expects.
 *
 * @param value - The CSS value produced for the token
 * @param token - The token being converted
 * @returns The stripped value, or undefined to leave it alone
 */
function transformUnitlessValue(value: string, token: Token): string | undefined {
  if (resolveUnitTreatment(token) !== "unitless") {
    return undefined
  }

  const stripped = stripUnit(value)
  return stripped === value ? undefined : stripped
}

/**
 * Generates debug information for a token
 * @param token - The token to generate debug info for
 * @param indentString - The indentation string to use
 * @returns Debug information string or empty string if debug is disabled
 */
function generateDebugInfo(token: Token, indentString: string): string {
  if (!exportConfiguration.debug) {
    return ""
  }

  const tokenPath = token.tokenPath || []
  const fullPath = [...tokenPath, token.name].join('/')
  
  return `${indentString}/* Path: ${fullPath} */\n` +
         `${indentString}/* Token: ${JSON.stringify({
           name: token.name,
           id: token.id,
           type: token.tokenType,
           path: token.tokenPath,
           prefix: getTokenPrefix(token.tokenType),
           value: (token as unknown as AnyToken).value
         })} */\n`
}

/**
 * Handles the conversion of a typography token into CSS custom properties
 * @param token - The typography token to convert
 * @param mappedTokens - Map of all tokens for resolving references
 * @param tokenGroups - Array of token groups for determining token hierarchy
 * @returns Formatted CSS custom property string
 */
function handleTypographyToken(token: Token, mappedTokens: Map<string, Token>, tokenGroups: Array<TokenGroup>): string {
  const indentString = GeneralHelper.indent(exportConfiguration.indent)
  let output = ""
  
  // Add debug info
  output += generateDebugInfo(token, indentString)

  // Add description if enabled
  if (exportConfiguration.showDescriptions && token.description) {
    output += `${indentString}/* ${token.description.trim()} */\n`
  }

  // Get the base name for the typography token
  const baseName = tokenVariableName(token, tokenGroups)

  // Extract individual properties from the typography token
  // @ts-ignore
  const typographyValue = token.value as TypographyTokenValue

  // Helper function to create CSS variable for a typography property
  const createTypographyProperty = (property: keyof Omit<TypographyTokenValue, 'referencedTokenId'>, suffix: string = '') => {
    if (typographyValue[property]) {
      const propertyValue = typographyValue[property] as AnyDimensionTokenValue
      const value = {
        ...propertyValue,
        referencedTokenId: propertyValue.referencedTokenId || null
      }

      // Map typography properties to their corresponding token types
      const tokenTypeMap: Record<keyof Omit<TypographyTokenValue, 'referencedTokenId'>, TokenType> = {
        fontSize: TokenType.fontSize,
        lineHeight: TokenType.lineHeight,
        letterSpacing: TokenType.letterSpacing,
        fontWeight: TokenType.fontWeight,
        fontFamily: TokenType.fontFamily,
        textDecoration: TokenType.textDecoration,
        textCase: TokenType.textCase,
        paragraphIndent: TokenType.paragraphSpacing,
        paragraphSpacing: TokenType.paragraphSpacing
      }

      // @ts-ignore
      output += `${indentString}--${baseName}${suffix}: ${CSSHelper.tokenToCSS({ ...token, value, tokenType: tokenTypeMap[property] }, mappedTokens, {
        allowReferences: exportConfiguration.useReferences,
        decimals: exportConfiguration.colorPrecision,
        colorFormat: exportConfiguration.colorFormat,
        // Decided per sub-property, so font size becomes rem while line height and
        // letter spacing keep the unit they were authored in
        forceRemUnit: shouldForceRemForTypographyProperty(tokenTypeMap[property]),
        remBase: exportConfiguration.remBase,
        tokenToVariableRef: (t) => `var(--${tokenVariableName(t, tokenGroups)})`
      })};\n`
    }
  }

  // Create CSS variables for each typography property
  createTypographyProperty('fontSize') // Base font size

  // Line height is emitted as a unitless ratio where it can be, matching how Tailwind
  // pairs a line height to a font size in its own default theme:
  //   --text-sm: 0.875rem;
  //   --text-sm--line-height: calc(1.25 / 0.875);
  // A ratio scales with the font size, so a reader raising their browser font size or
  // applying a text-spacing override keeps proportional line boxes rather than fixed
  // ones that the text eventually overflows.
  const lineHeightRatio = typographyLineHeightRatio(typographyValue)

  if (lineHeightRatio !== undefined) {
    output += `${indentString}--${baseName}--line-height: ${lineHeightRatio};\n`
  } else {
    createTypographyProperty('lineHeight', '--line-height')
  }

  createTypographyProperty('letterSpacing', '--letter-spacing')
  createTypographyProperty('fontWeight', '--font-weight')

  return output
}

/**
 * Computes a typography token's line height as a unitless ratio of its font size.
 *
 * Only the composite can do this: a standalone line height token carries no font size
 * to divide by, which is why `reference/line-height/*` tokens keep their authored
 * pixels while these do not.
 *
 * Returns undefined when a ratio would be wrong or meaningless, in which case the
 * caller falls back to emitting the authored value:
 * - no line height or no font size to pair it with
 * - a font size of zero
 * - a line height and font size measured in different units, since the ratio of two
 *   different units is not a ratio
 *
 * A line height authored as a percentage is converted directly, as a percentage of the
 * font size is already a ratio.
 *
 * @param typographyValue - The composite value of a typography token
 * @returns The ratio as a string, or undefined to fall back to the authored value
 */
function typographyLineHeightRatio(typographyValue: TypographyTokenValue): string | undefined {
  const lineHeight = typographyValue.lineHeight as AnyDimensionTokenValue | null
  const fontSize = typographyValue.fontSize as AnyDimensionTokenValue | null

  if (!lineHeight || typeof lineHeight.measure !== "number") {
    return undefined
  }

  // A percentage line height is already expressed relative to the font size
  if (lineHeight.unit === Unit.percent) {
    return formatRatio(lineHeight.measure / 100)
  }

  if (!fontSize || typeof fontSize.measure !== "number" || fontSize.measure === 0) {
    return undefined
  }

  if (lineHeight.unit !== fontSize.unit) {
    return undefined
  }

  return formatRatio(lineHeight.measure / fontSize.measure)
}

/**
 * Rounds a line height ratio to four decimals and trims trailing zeros, so a ratio of
 * exactly 1.5 is emitted as `1.5` rather than `1.5000`.
 *
 * Four decimals keeps the rendered line box within a hundredth of a pixel of the
 * authored value at any realistic font size, while staying readable.
 *
 * @param ratio - The computed ratio
 * @returns The ratio formatted for CSS
 */
function formatRatio(ratio: number): string {
  return String(parseFloat(ratio.toFixed(4)))
}

/**
 * Converts a design token into its CSS custom property representation.
 * Handles formatting of the token value, references, and optional description comments.
 * 
 * @param token - The design token to convert
 * @param mappedTokens - Map of all tokens for resolving references
 * @param tokenGroups - Array of token groups for determining token hierarchy
 * @returns Formatted CSS custom property string with optional description comment or null if token type is not allowed
 */
export function convertedToken(token: Token, mappedTokens: Map<string, Token>, tokenGroups: Array<TokenGroup>, colorTokensNeedingOklch?: Set<string>, useRuntimeNames: boolean = false): string | null {
  // Skip tokens that are not allowed for Tailwind customization
  if (!isAllowedTokenType(token.tokenType)) {
    return null;
  }

  // Special handling for typography tokens
  if (token.tokenType === TokenType.typography) {
    return handleTypographyToken(token, mappedTokens, tokenGroups)
  }

  // Generate the CSS variable name based on token properties and configuration
  let name = tokenVariableName(token, tokenGroups)
  // Outside @theme nothing adds the Tailwind prefix, so names are written in full
  const variableName = (t: Token): string => {
    const themeName = tokenVariableName(t, tokenGroups)
    return useRuntimeNames ? runtimeVariableName(t, themeName) : themeName
  }
  if (useRuntimeNames) name = variableName(token)

  // Convert token value to CSS, handling references and formatting according to configuration
  const value =
    colorMixValue(token, mappedTokens, variableName) ??
    radiusFocusValue(token, mappedTokens, variableName) ??
    CSSHelper.tokenToCSS(token, mappedTokens, {
    allowReferences: exportConfiguration.useReferences,
    decimals: exportConfiguration.colorPrecision,
    colorFormat: exportConfiguration.colorFormat,
    forceRemUnit: shouldForceRem(token),
    remBase: exportConfiguration.remBase,
    // Custom handler for token references - converts them to CSS var() syntax
    tokenToVariableRef: (t, context) => {
      // Skip references to tokens that are not allowed for Tailwind customization
      if (!isAllowedTokenType(t.tokenType)) {
        // Return the raw value instead of a reference
        return CSSHelper.tokenToCSS(t, mappedTokens, {
          allowReferences: false, // Don't follow nested references
          decimals: exportConfiguration.colorPrecision,
          colorFormat: exportConfiguration.colorFormat,
          // Inlined value follows the rule for the referenced token's own path
          forceRemUnit: shouldForceRem(t),
          remBase: exportConfiguration.remBase,
          tokenToVariableRef: () => "", // Stub function that never gets called since allowReferences is false
          // An inlined value still needs its unit stripped where the path calls for it
          valueTransformer: transformUnitlessValue
        });
      }
      // If context requests a channel-based color variable (needsRgb), use the oklch utility variable in this exporter
      if (context?.needsRgb && t.tokenType === TokenType.color && colorTokensNeedingOklch?.has(t.id)) {
        return `var(--oklch-${tokenVariableName(t, tokenGroups)})`
      }
      return `var(--${variableName(t)})`
    },
    // Handle blur values - extract just the dimension
    valueTransformer: (value: string, t: Token) => {
      if (t.tokenType === TokenType.fontFamily) {
        // A font stack ("Inter, sans-serif" or one with quoted family names) is already valid CSS,
        // wrapping it in quotes would turn it into a single invalid family name
        // @ts-ignore
        const text: string | undefined = t.value?.text
        if (text && value === `"${text}"` && /[,"']/.test(text)) {
          return text
        }
        return undefined
      }
      if (t.tokenType === TokenType.blur) {
        // For blur(12px) -> extract 12px
        const match = value.match(/^blur\((.*)\)$/)
        if (match) {
          return match[1]
        }
        // For direct values (background blur) just return as is
        return value
      }
      // Strip the unit where the token's path calls for a bare number
      return transformUnitlessValue(value, t)
    }
  })
  const indentString = GeneralHelper.indent(exportConfiguration.indent)

  let output = ""
  
  // Add debug info
  output += generateDebugInfo(token, indentString)

  // Add description if enabled
  if (exportConfiguration.showDescriptions && token.description) {
    output += `${indentString}/* ${token.description.trim()} */\n`
  }

  // Special handling for blur tokens
  if (token.tokenType === TokenType.blur) {
    const tokenPath = token.tokenPath || []
    const fullPath = [...tokenPath, token.name].join('/').toLowerCase()
    const isBackdropBlur = fullPath.includes('background')
    const blurName = isBackdropBlur ? 'backdrop-blur' : (token.name.toLowerCase() === 'blur' ? 'blur-default' : `blur-${token.name}`)
    name = NamingHelper.codeSafeVariableName(blurName, StringCase.kebabCase)
  }
  
  output += `${indentString}--${name}: ${value};`
  return output
}

/**
 * Converts a colour that aliases another colour with its own opacity, e.g. neutral/500 @ 20%,
 * to `color-mix()`. The shared colour helper only keeps such an alias for rgb formats and
 * otherwise writes the resolved colour, which loses the link to the palette.
 *
 * @param token - The token being converted
 * @param mappedTokens - All tokens by id, for resolving the alias
 * @param variableName - Names the referenced token's variable
 * @returns The color-mix() value, or undefined when the token is not an alias with opacity
 */
function colorMixValue(token: Token, mappedTokens: Map<string, Token>, variableName: (t: Token) => string): string | undefined {
  if (!exportConfiguration.useReferences || token.tokenType !== TokenType.color) return undefined

  // @ts-ignore
  const value = token.value
  if (!value || value.referencedTokenId || value.opacity?.referencedTokenId) return undefined

  const alpha = value.opacity?.measure
  if (typeof alpha !== "number" || alpha >= 1) return undefined

  // Figma cannot alias a colour and change its opacity in one variable, so the source usually
  // only survives in the description ("Light: indigo/600 @ 90% · Dark: indigo/500 @ 90%")
  const referenced = value.color?.referencedTokenId
    ? mappedTokens.get(value.color.referencedTokenId)
    : colorSourceFromDescription(token, mappedTokens)
  if (!referenced || !isAllowedTokenType(referenced.tokenType)) return undefined

  const percent = Math.round(alpha * 10000) / 100
  return `color-mix(in srgb, var(--${variableName(referenced)}) ${percent}%, transparent)`
}

/** Tokens by code syntax name, built once per token map */
const tokensBySyntaxCache = new WeakMap<Map<string, Token>, Map<string, Token>>()

function tokensBySyntax(mappedTokens: Map<string, Token>): Map<string, Token> {
  let index = tokensBySyntaxCache.get(mappedTokens)
  if (!index) {
    index = new Map()
    for (const t of mappedTokens.values()) {
      const syntax = codeSyntaxName(t)
      if (syntax) index.set(syntax, t)
    }
    tokensBySyntaxCache.set(mappedTokens, index)
  }
  return index
}

/**
 * Converts a literal focus ring radius into the sum it stands for, so it follows the radius it
 * wraps: `<x>-radius-focus[-size]` = `<x>-radius[-size]` (or `<x>-radius`) + `<x>-focus-offset`
 * (or the shared `cmp-control-focus-offset`). Fails the export when the literal is not that sum.
 *
 * @param token - The token being converted
 * @param mappedTokens - All tokens by id
 * @param variableName - Names a token's variable
 * @returns The calc() value, or undefined when the token is not a literal focus radius
 */
function radiusFocusValue(token: Token, mappedTokens: Map<string, Token>, variableName: (t: Token) => string): string | undefined {
  if (!exportConfiguration.useReferences || token.tokenType === TokenType.color) return undefined
  // @ts-ignore
  const value = token.value
  if (!value || value.referencedTokenId || typeof value.measure !== "number") return undefined

  const name = codeSyntaxName(token)
  const match = name?.match(/^(.*)-radius-focus(-[a-z0-9]+)?$/)
  if (!match) return undefined

  const [, base, size = ""] = match
  const index = tokensBySyntax(mappedTokens)
  const prefix = name!.slice(0, name!.indexOf("-") + 1)
  const radius = index.get(`${base}-radius${size}`) ?? index.get(`${base}-radius`)
  const offset = index.get(`${base}-focus-offset`) ?? index.get(`${prefix}cmp-control-focus-offset`)
  if (!radius || !offset) return undefined

  // @ts-ignore
  const sum = radius.value.measure + offset.value.measure
  if (Math.abs(sum - value.measure) > 0.01) {
    throw new Error(
      `Focus radius "${fullTokenPath(token)}" is ${value.measure}, but ${codeSyntaxName(radius)} + ${codeSyntaxName(offset)} is ${sum}. ` +
        `Fix the value in Figma.`
    )
  }
  return `calc(var(--${variableName(radius)}) + var(--${variableName(offset)}))`
}

/** One "<mode>: <colour> @ <n>%" entry from a colour token's description */
type DescribedColorSource = { modes: string; name: string; percent: number }

/**
 * Reads the colour sources a description names per mode, e.g.
 * "Light: indigo/600 @ 90% · Dark: indigo/500 @ 90%" or "Light and Dark: the shell text white @ 30%".
 * The colour is the last word before the "@".
 */
function describedColorSources(description: string): Array<DescribedColorSource> {
  const sources: Array<DescribedColorSource> = []
  const pattern = /(light and dark|light|dark)\s*:[^·@]*?([a-z0-9][a-z0-9/-]*)\s*@\s*([\d.]+)\s*%/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(description)) !== null) {
    sources.push({ modes: match[1].toLowerCase(), name: match[2].toLowerCase(), percent: parseFloat(match[3]) })
  }
  return sources
}

/**
 * Finds the colour token a description names as the source of this mode's value. A source can be a
 * palette colour (indigo/600 → ref-indigo-600) or a semantic one (on-surface/brand → color-on-surface-brand).
 * The description lists every mode, so the entry whose colour equals this token's colour is the one
 * for the file being written. Fails the export when the description names sources but none matches,
 * so a stale description cannot silently export the wrong colour.
 *
 * @param token - Colour token with opacity and no alias
 * @param mappedTokens - All tokens by id, with the current theme applied
 * @returns The source token, or undefined when the description names no source
 */
function colorSourceFromDescription(token: Token, mappedTokens: Map<string, Token>): Token | undefined {
  const sources = describedColorSources(token.description ?? "")
  if (sources.length === 0) return undefined

  // @ts-ignore
  const own = ColorHelper.normalizedIntColor(token.value)
  // @ts-ignore
  const alpha: number = token.value.opacity.measure
  const candidates = Array.from(mappedTokens.values()).filter(
    (t) => t.tokenType === TokenType.color && t.id !== token.id && !isComponentToken(t)
  )

  for (const source of sources) {
    if (Math.abs(source.percent / 100 - alpha) > 0.005) continue

    const dashed = source.name.replace(/\//g, "-")
    const match = candidates.find((t) => {
      const syntax = codeSyntaxName(t)
      const path = fullTokenPath(t)
      const named = syntax
        ? [`ref-${dashed}`, `color-${dashed}`].includes(stripTailwindPrefix(syntax))
        : path === source.name || path.endsWith(`/${source.name}`)
      if (!named) return false
      // @ts-ignore
      const color = ColorHelper.normalizedIntColor(t.value)
      return Math.abs(color.r - own.r) <= 1 && Math.abs(color.g - own.g) <= 1 && Math.abs(color.b - own.b) <= 1
    })
    if (match) return match
  }

  const named = sources.map((source) => `${source.name} @ ${source.percent}%`).join(", ")
  throw new Error(
    `Colour "${fullTokenPath(token)}" has opacity and its description names ${named}, but none of them has this colour. ` +
      `Update the description or the value in Figma.`
  )
}

/**
 * Normalizes a name for Tailwind usage by ensuring it has at least one hyphen
 * by appending "-default" if it's a single word, so it doesn't result in a class name like ".text", ".text-color", ".border", etc.
 * @param name The name to normalize
 * @returns The normalized name with "-default" appended if it was a single word
 */
function normalizeForTailwindConfig(name: string): string {
    if (!name.includes('-') 
      || name === "text-color" 
      || name === "background-color" 
      || name === "border-color"
      || name === "box-shadow-color"
      || name === "outline-color"
      || name === "stroke-color"
      || name === "fill-color"
      || name === "ring-color"
      ) {
        return `${name}-default`;
    }
    return name;
}

/**
 * Applies find/replace patterns to a variable name. Used when find/replace timing is set to "afterPrefix".
 * Supports patterns with or without leading "--" (e.g., both "--spacing" and "spacing" will work).
 * @param name The variable name to apply replacements to (without leading --)
 * @param findReplace Record of find/replace patterns
 * @returns The name with all replacements applied
 */
function applyFindReplace(name: string, findReplace?: Record<string, string>): string {
  if (!findReplace || Object.keys(findReplace).length === 0) return name;
  
  // Add -- prefix to match how CSS variables appear, so users can use patterns like "--spacing"
  let result = `--${name}`;
  
  // Sort find patterns by length (longest first) to handle overlapping patterns
  const sortedPatterns = Object.entries(findReplace)
    .sort(([a], [b]) => b.length - a.length)
  
  for (const [find, replace] of sortedPatterns) {
    result = result.split(find).join(replace)
  }
  
  // Remove leading -- that we added (it will be added back when generating CSS)
  result = result.replace(/^--/, '')
  
  // Clean up any double hyphens or leading/trailing hyphens that might result from replacements
  result = result.replace(/-+/g, '-').replace(/^-|-$/g, '')
  
  return result;
}

/**
 * Checks if a token path matches a color utility pattern, considering both positive and negative patterns.
 * @param fullPath The full token path to check
 * @param patternString The pattern string containing comma-separated patterns, with optional ! prefix for negation
 * @returns An object containing whether the path matches and the first matching positive pattern
 */
function matchColorUtilityPattern(fullPath: string, patternString: string): { matches: boolean; matchingPattern: string } {
  // Split pattern by comma to support multiple patterns for a single utility
  const patterns = patternString.split(',').map(p => p.trim().toLowerCase())
  
  // Separate positive and negative patterns
  const positivePatterns = patterns.filter(p => !p.startsWith('!'))
  const negativePatterns = patterns.filter(p => p.startsWith('!')).map(p => p.slice(1))
  
  // Check if the path matches any positive pattern
  const matchesPositive = positivePatterns.some(pattern => fullPath.includes(pattern))
  
  // Check if the path matches any negative pattern
  const matchesNegative = negativePatterns.some(pattern => fullPath.includes(pattern))
  
  // A match occurs if it matches at least one positive pattern AND doesn't match any negative patterns
  const matches = matchesPositive && !matchesNegative
  
  // Find the first matching positive pattern
  const matchingPattern = matches ? (positivePatterns.find(pattern => fullPath.includes(pattern)) || '') : ''
  
  return { matches, matchingPattern }
}

/**
 * Rewrites a leading minus in a token name to "neg", e.g. "-px" -> "neg px".
 * Case conversion drops the minus, which would make "-px" and "px" produce the same variable.
 * @param name The token name
 * @returns The name with a leading minus spelled out
 */
function negativeSafeTokenName(name: string): string {
  const match = name.match(/^\s*-\s*(.+)$/)
  return match ? `neg ${match[1]}` : name
}

/**
 * Token types that all map to `--spacing-*` by type, so only their group can tell spacing apart
 * from breakpoints, containers or perspective
 */
const GROUP_OVERRIDE_TOKEN_TYPES: ReadonlySet<TokenType> = new Set([
  TokenType.dimension,
  TokenType.size,
  TokenType.space
])

/**
 * Finds the namespace configured for the token's group path in `groupPrefixOverrides`.
 * Only applies to dimension, size and space tokens, so e.g. a "container" color group is unaffected.
 * Keys are matched case-insensitively against each path segment; the first segment containing a key wins.
 * @param token The token to match
 * @returns The namespace and the path segments after the matched one, or null if nothing matches
 */
function matchGroupPrefixOverride(token: Token): { namespace: string; remainingPath: Array<string> } | null {
  const overrides = exportConfiguration.groupPrefixOverrides
  if (!overrides || Object.keys(overrides).length === 0) return null
  if (!GROUP_OVERRIDE_TOKEN_TYPES.has(token.tokenType)) return null

  const tokenPath = token.tokenPath || []
  // Prefer longer keys so "font weight" wins over "font"
  const keys = Object.keys(overrides).sort((a, b) => b.length - a.length)

  for (let index = 0; index < tokenPath.length; index++) {
    const segment = tokenPath[index].toLowerCase()
    const key = keys.find(k => k.trim().length > 0 && segment.includes(k.trim().toLowerCase()))
    if (key) {
      return { namespace: overrides[key], remainingPath: tokenPath.slice(index + 1) }
    }
  }

  return null
}

/**
 * Generates a code-safe variable name for a token based on its properties and configuration.
 * Includes type-specific prefix and considers token hierarchy.
 * 
 * @param token - The token to generate a name for
 * @param tokenGroups - Array of token groups for determining token hierarchy
 * @returns Formatted variable name string
 */
export function tokenVariableName(token: Token, tokenGroups: Array<TokenGroup>): string {
  // The WEB code syntax from Figma is the name engineers already see in Dev Mode, so it wins over any derived name
  const codeSyntax = codeSyntaxName(token)
  if (codeSyntax !== null) {
    return stripTailwindPrefix(codeSyntax)
  }

  let prefix = getTokenPrefix(token.tokenType)

  // Determine if find/replace should be applied before prefix (passed to NamingHelper)
  // or after prefix (applied manually to the final name)
  const applyFindReplaceBeforePrefix = exportConfiguration.findReplaceTiming !== FindReplaceTiming.AfterPrefix
  const findReplaceForNamingHelper = applyFindReplaceBeforePrefix ? exportConfiguration.findReplace : undefined

  // Keep a leading minus visible in the name, since case conversion strips it and "-px" would collide with "px"
  const tokenName = negativeSafeTokenName(token.name)

  // A path-based namespace override replaces the type-derived prefix entirely, and
  // drops the intermediate path segments with it - the type-derived prefix is wrong
  // precisely because the token type is not what the token represents. Naming from
  // the override plus the token's own name keeps the result usable as a Tailwind
  // namespace: reference/font-weight/600 becomes --font-weight-600, not
  // --font-weight-reference-font-weight-600.
  const prefixOverride = matchByTokenPath(
    token,
    exportConfiguration.tokenPathPrefixes ?? DEFAULT_TOKEN_PATH_PREFIXES
  )

  if (prefixOverride !== undefined) {
    let name = NamingHelper.codeSafeVariableName(
      `${prefixOverride}-${tokenName}`,
      StringCase.kebabCase,
      findReplaceForNamingHelper,
      true
    )

    if (!applyFindReplaceBeforePrefix) {
      name = applyFindReplace(name, exportConfiguration.findReplace)
    }

    return name
  }

  // Use the namespace configured for the token's group, if any (e.g. breakpoints -> --breakpoint-*)
  const groupOverride = matchGroupPrefixOverride(token)
  if (groupOverride) {
    let name = NamingHelper.codeSafeVariableName([groupOverride.namespace, ...groupOverride.remainingPath, tokenName], StringCase.kebabCase, findReplaceForNamingHelper, true)
    name = normalizeForTailwindConfig(name);

    // Apply find/replace after prefix if timing is set to afterPrefix
    if (!applyFindReplaceBeforePrefix) {
      name = applyFindReplace(name, exportConfiguration.findReplace)
    }

    return name;
  }

  // Handle color utility prefixes if enabled and token is a color
  if (exportConfiguration.useColorUtilityPrefixes && token.tokenType === TokenType.color) {
    // Get the parent once and reuse it
    const parent = tokenGroups.find((group) => group.id === token.parentGroupId)
    
    // Use the token's built-in path and add token name
    const tokenPath = token.tokenPath || []
    const fullPath = [...tokenPath, token.name].join('/').toLowerCase()

    // Check token path against each utility pattern
    for (const [utilityName, patternString] of Object.entries(exportConfiguration.colorUtilityPrefixes)) {
      const { matches, matchingPattern } = matchColorUtilityPattern(fullPath, patternString)
      
      if (matches) {
        const patternIndex = tokenPath.findIndex(p => p.toLowerCase().includes(matchingPattern))
        
        // Get the remaining path segments after the pattern match
        const remainingPath = patternIndex >= 0 
          ? tokenPath.slice(patternIndex + 1)
          : tokenPath

        // Combine remaining path with token name
        const segments = [...remainingPath, tokenName]
        const cleanName = segments.join('-').toLowerCase()
          .trim()
          .replace(/^[-\s]+|[-\s]+$/g, '') // Remove leading/trailing hyphens and spaces

        // Construct the name as: utility-color-path-name
        // We also remove the utility name from the cleanName to avoid redundancy
        let name = NamingHelper.codeSafeVariableName(`${utilityName}-color-${cleanName.replace(utilityName, '')}`, StringCase.kebabCase, findReplaceForNamingHelper, true)

        name = normalizeForTailwindConfig(name);
        
        // Apply find/replace after prefix if timing is set to afterPrefix
        if (!applyFindReplaceBeforePrefix) {
          name = applyFindReplace(name, exportConfiguration.findReplace)
        }
        
        return name;
      }
    }

    // If no utility match, use standard naming
    let name = NamingHelper.codeSafeVariableNameForToken({ name: tokenName }, StringCase.kebabCase, parent || null, prefix, findReplaceForNamingHelper)
    name = normalizeForTailwindConfig(name);
    
    // Apply find/replace after prefix if timing is set to afterPrefix
    if (!applyFindReplaceBeforePrefix) {
      name = applyFindReplace(name, exportConfiguration.findReplace)
    }
    
    return name;
  }

  // For non-color tokens or when color utility prefixes are disabled
  const parent = tokenGroups.find((group) => group.id === token.parentGroupId)
  let name = NamingHelper.codeSafeVariableNameForToken({ name: tokenName }, StringCase.kebabCase, parent || null, prefix, findReplaceForNamingHelper)
  name = normalizeForTailwindConfig(name);
  
  // Apply find/replace after prefix if timing is set to afterPrefix
  if (!applyFindReplaceBeforePrefix) {
    name = applyFindReplace(name, exportConfiguration.findReplace)
  }
  
  return name;
}

/**
 * Analyzes tokens to identify which color tokens need OKLCH utility variables.
 * A color token needs an OKLCH utility if it's referenced by shadow, border, or gradient tokens
 * that have custom opacity values.
 * 
 * @param tokens - Array of all tokens
 * @param tokenGroups - Array of token groups for determining token hierarchy
 * @returns Set of color token IDs that need OKLCH utility versions
 */
export function analyzeTokensForOklchUtilities(
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>
): Set<string> {
  const colorTokensNeedingOklch = new Set<string>()
  const mappedTokens = new Map(tokens.map((token) => [token.id, token]))

  tokens.forEach((token) => {
    if (token.tokenType === TokenType.shadow) {
      const shadowToken = token as any
      shadowToken.value.forEach((shadowLayer: any) => {
        if (shadowLayer.opacity && shadowLayer.color.referencedTokenId) {
          const referencedColorToken = mappedTokens.get(shadowLayer.color.referencedTokenId)
          if (referencedColorToken && referencedColorToken.tokenType === TokenType.color) {
            colorTokensNeedingOklch.add(referencedColorToken.id)
          }
        }
      })
    } else if (token.tokenType === TokenType.border) {
      const borderToken = token as any
      if (borderToken.value.opacity && borderToken.value.color.referencedTokenId) {
        const referencedColorToken = mappedTokens.get(borderToken.value.color.referencedTokenId)
        if (referencedColorToken && referencedColorToken.tokenType === TokenType.color) {
          colorTokensNeedingOklch.add(referencedColorToken.id)
        }
      }
    } else if (token.tokenType === TokenType.gradient) {
      const gradientToken = token as any
      gradientToken.value.forEach((gradientLayer: any) => {
        gradientLayer.stops.forEach((stop: any) => {
          if (stop.opacity && stop.color.referencedTokenId) {
            const referencedColorToken = mappedTokens.get(stop.color.referencedTokenId)
            if (referencedColorToken && referencedColorToken.tokenType === TokenType.color) {
              colorTokensNeedingOklch.add(referencedColorToken.id)
            }
          }
        })
      })
    }
  })

  return colorTokensNeedingOklch
}

/**
 * Gets the OKLCH value (L C H, no alpha) for a color token.
 * @param token - The color token
 * @returns OKLCH value string (e.g., "0.627 0.15 29.23")
 */
export function getColorTokenOklchValue(token: Token): string {
  if (token.tokenType !== TokenType.color) {
    throw new Error(`Expected color token, got ${token.tokenType}`)
  }
  const colorValue = (token as any).value
  // Use ColorHelper to get oklch values
  // ColorHelper.colorToOklch expects (format, color, alpha, decimals)
  // We'll use ColorFormat.oklch, and only want the L C H part
  // ColorHelper.colorToOklch returns a string like "oklch(0.627% 0.15 29.23)"
  // We'll extract the values inside the parentheses
  const oklchString = ColorHelper.colorToOklch(
    ColorFormat.oklch,
    { r: Math.round(colorValue.color.r), g: Math.round(colorValue.color.g), b: Math.round(colorValue.color.b) },
    colorValue.opacity.measure,
    3
  )
  // Extract the part inside "oklch(...)"
  const match = oklchString.match(/oklch\(([^)]+)\)/)
  if (match) {
    return match[1].replace(/%/g, '').trim()
  }
  return ''
}

/**
 * Generates an OKLCH utility variable for a color token.
 * This creates a CSS variable containing only the OKLCH values (no alpha) for use with custom opacity.
 * 
 * @param token - The color token to generate OKLCH utility for
 * @param tokenGroups - Array of token groups for determining token hierarchy
 * @returns Formatted CSS custom property string for the OKLCH utility variable
 */
export function generateOklchUtilityVariable(
  token: Token,
  tokenGroups: Array<TokenGroup>
): string {
  const name = tokenVariableName(token, tokenGroups)
  const oklchName = `oklch-${name}`
  const oklchValue = getColorTokenOklchValue(token)
  const indentString = GeneralHelper.indent(exportConfiguration.indent)
  if (exportConfiguration.showDescriptions && token.description) {
    return `${indentString}/* OKLCH utility for ${token.description.trim()} */\n${indentString}--${oklchName}: ${oklchValue};`
  } else {
    return `${indentString}--${oklchName}: ${oklchValue};`
  }
}
