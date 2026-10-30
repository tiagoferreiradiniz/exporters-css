import { Token } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."

/**
 * Reads a token's custom property by its display name, case-insensitively.
 *
 * Figma imports store code syntax and the source collection as custom properties,
 * so this is how the exporter reaches data the token model has no field for.
 *
 * @param token - The token to read from
 * @param propertyName - Display name of the custom property, e.g. "Collection"
 * @returns The trimmed value, or null when the property is missing or empty
 */
export function tokenPropertyValue(token: Token, propertyName: string): string | null {
  const wanted = propertyName.trim().toLowerCase()
  const property = (token.properties || []).find((p) => p.name.trim().toLowerCase() === wanted)
  if (!property) return null

  const values = token.propertyValues || {}
  const value = values[property.codeName] ?? values[property.id] ?? values[property.idInVersion]
  if (value === undefined || value === null || typeof value === "boolean") return null

  const text = String(value).trim()
  return text.length > 0 ? text : null
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
 * Returns the token's WEB code syntax as a bare variable name, verbatim from Figma.
 *
 * Fails the export when naming by code syntax is enabled and the token has none, since a
 * name derived from the path would silently diverge from what engineers see in Dev Mode.
 *
 * @param token - The token to name
 * @returns The full variable name, e.g. "cb-color-surface-brand", or null when disabled
 */
export function codeSyntaxName(token: Token): string | null {
  if (!exportConfiguration.useCodeSyntaxNames) return null

  const codeSyntax = tokenPropertyValue(token, exportConfiguration.codeSyntaxProperty)
  if (!codeSyntax) {
    const path = [...(token.tokenPath || []), token.name].join("/")
    throw new Error(
      `Token "${path}" has no "${exportConfiguration.codeSyntaxProperty}" code syntax. ` +
        `Set its WEB code syntax in Figma, or check the property name. Properties found: ${availablePropertyNames(token)}.`
    )
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
