import { Token, TokenType } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."

/**
 * Reads a token's custom property by its display name, case-insensitively and ignoring
 * the "Syntax:" prefix Figma imports give code syntax properties, so "Web" finds "Syntax: Web".
 *
 * Figma imports store code syntax and the source collection as custom properties,
 * so this is how the exporter reaches data the token model has no field for.
 *
 * @param token - The token to read from
 * @param propertyName - Display name of the custom property, e.g. "Collection"
 * @returns The trimmed value, or null when the property is missing or empty
 */
export function tokenPropertyValue(token: Token, propertyName: string): string | null {
  const wanted = comparablePropertyName(propertyName)
  const property = (token.properties || []).find((p) => comparablePropertyName(p.name) === wanted)
  if (!property) return null

  const values = token.propertyValues || {}
  const value = values[property.codeName] ?? values[property.id] ?? values[property.idInVersion]
  if (value === undefined || value === null || typeof value === "boolean") return null

  // Select properties, like "Collection", store the chosen option's id rather than its name
  const option = (property.options || []).find((o) => o.id === value)
  const text = (option ? option.name : String(value)).trim()
  return text.length > 0 ? text : null
}

/**
 * Token types that come from Figma styles rather than variables. Styles have no code
 * syntax, so these keep a name derived from their path.
 */
const STYLE_TOKEN_TYPES: Array<TokenType> = [TokenType.typography, TokenType.shadow, TokenType.gradient, TokenType.blur]

/**
 * Normalizes a property name for comparison: "Syntax: Web" -> "web".
 *
 * @param name - A property display name
 * @returns The lowercased name without a leading "Syntax:"
 */
function comparablePropertyName(name: string): string {
  return name.trim().toLowerCase().replace(/^syntax:\s*/, "")
}

/**
 * Lists the names of the custom properties a token carries, for error messages.
 *
 * @param token - The token to inspect
 * @returns Property names, or "none" when the token has no custom properties
 */
function availablePropertyNames(token: Token): string {
  const names = (token.properties || []).map((p) => `"${p.name}"`)
  return names.length > 0 ? names.join(", ") : "none"
}

/**
 * Reduces an authored code syntax to a bare variable name: "var(--cb-color-x)" -> "cb-color-x".
 *
 * @param codeSyntax - The value as written in Figma
 * @returns The variable name without var() or leading dashes
 */
function normalizeCodeSyntax(codeSyntax: string): string {
  return codeSyntax
    .trim()
    .replace(/^var\(\s*/, "")
    .replace(/\s*\)$/, "")
    .replace(/^--/, "")
    .trim()
}

/**
 * Formats a token for error messages: its path, plus its collection when known.
 *
 * @param token - The token to describe
 * @returns e.g. `card/base/all/container/gap (Component-Tailwind)`
 */
function describeToken(token: Token): string {
  const path = [...(token.tokenPath || []), token.name].join("/")
  const collection = tokenPropertyValue(token, "Collection")
  return collection ? `${path} (${collection})` : path
}

/**
 * Decides whether a token must carry a WEB code syntax when naming by code syntax.
 *
 * @param token - The token to check
 * @returns True for tokens from Figma variables; style-based tokens are exempt
 */
function requiresCodeSyntax(token: Token): boolean {
  return exportConfiguration.useCodeSyntaxNames && !STYLE_TOKEN_TYPES.includes(token.tokenType)
}

/**
 * Fails the export when any token that needs a WEB code syntax has none, listing all of
 * them at once so they can be fixed in Figma in a single pass.
 *
 * @param tokens - The tokens about to be exported
 */
export function validateCodeSyntax(tokens: Array<Token>): void {
  const missing = tokens.filter((t) => requiresCodeSyntax(t) && !tokenPropertyValue(t, exportConfiguration.codeSyntaxProperty))
  if (missing.length === 0) return

  const shown = 50
  const list = missing.slice(0, shown).map((t) => `  - ${describeToken(t)}`).join("\n")
  const more = missing.length > shown ? `\n  … and ${missing.length - shown} more` : ""
  throw new Error(
    `${missing.length} token(s) have no "${exportConfiguration.codeSyntaxProperty}" code syntax. ` +
      `Set their WEB code syntax in Figma, or exclude their collection. ` +
      `Properties found on the first one: ${availablePropertyNames(missing[0])}.\n${list}${more}`
  )
}

/**
 * Returns the token's WEB code syntax as a bare variable name, verbatim from Figma.
 *
 * Tokens from Figma styles have no code syntax and keep their derived name. For the rest,
 * `validateCodeSyntax` has already failed the export if any were missing.
 *
 * @param token - The token to name
 * @returns The full variable name, e.g. "cb-color-surface-brand", or null to use the derived name
 */
export function codeSyntaxName(token: Token): string | null {
  if (!requiresCodeSyntax(token)) return null

  const codeSyntax = tokenPropertyValue(token, exportConfiguration.codeSyntaxProperty)
  if (!codeSyntax) {
    throw new Error(`Token ${describeToken(token)} has no "${exportConfiguration.codeSyntaxProperty}" code syntax.`)
  }

  return normalizeCodeSyntax(codeSyntax)
}

/**
 * Removes the Tailwind prefix from a code syntax name for use inside `@theme`.
 *
 * Tailwind's `prefix(cb)` adds "cb-" back to every theme variable it outputs, so
 * `--color-surface-brand` written in `@theme` reaches the browser as the
 * `--cb-color-surface-brand` designers see in Figma.
 *
 * @param name - The full code syntax name
 * @returns The name without the configured global prefix
 */
export function stripTailwindPrefix(name: string): string {
  const prefix = exportConfiguration.globalPrefix?.trim()
  if (!prefix) return name

  return name.startsWith(`${prefix}-`) ? name.slice(prefix.length + 1) : name
}

/**
 * Decides whether a token belongs to a Figma collection that is excluded from export.
 *
 * @param token - The token to check
 * @returns True when the token's "Collection" property is in `excludedCollections`
 */
export function isInExcludedCollection(token: Token): boolean {
  const excluded = (exportConfiguration.excludedCollections || []).map((c) => c.trim().toLowerCase())
  if (excluded.length === 0) return false

  const collection = tokenPropertyValue(token, "Collection")
  return collection !== null && excluded.includes(collection.toLowerCase())
}
