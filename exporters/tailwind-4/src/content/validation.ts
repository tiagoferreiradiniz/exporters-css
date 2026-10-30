import { Token } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { RAW_COMPONENT_PROPERTIES } from "../constants/defaults"
import { codeSyntaxName, describeToken, isComponentToken, modeAttributeCollectionOf } from "./code-syntax"

const MAX_LISTED = 50

const rawPropertyPattern = new RegExp(`-(${RAW_COMPONENT_PROPERTIES.join("|")})(-[a-z0-9]+)?$`)

/**
 * Lists the tokens a token's value aliases: the whole value, or for colours its colour part.
 *
 * @param token - The token to read
 * @returns Referenced token ids
 */
function referencedIds(token: Token): Array<string> {
  // @ts-ignore
  const value = token.value
  if (!value || typeof value !== "object") return []
  const ids = [value.referencedTokenId, value.color?.referencedTokenId].filter((id): id is string => !!id)
  return Array.from(new Set(ids))
}

/**
 * Whether a component token holds a raw value. Colours with opacity that only name their
 * source in the description count as raw, because Figma's alias did not reach the export.
 */
function hasRawValue(token: Token): boolean {
  return referencedIds(token).length === 0
}

/**
 * Checks the Cobalt token rules and fails the export with every problem listed:
 * - a component token holds a raw value its property does not allow
 * - a token other than a Semantic colour (or another palette colour) aliases the palette (`ref-`)
 * - aliases form a cycle
 *
 * @param tokens - Tokens to check
 * @param allTokens - All tokens by id, for following aliases
 */
export function validateCobaltRules(tokens: Array<Token>, allTokens: Map<string, Token>): void {
  if (!exportConfiguration.validateCobaltRules) return

  const prefix = exportConfiguration.globalPrefix ? `${exportConfiguration.globalPrefix}-` : ""
  const problems: Array<string> = []

  for (const token of tokens) {
    const name = codeSyntaxName(token)
    if (!name) continue

    // Mode-attribute collections (e.g. level, density) are per-mode raw dimensions by design,
    // so they are exempt from the raw-value rule
    if (isComponentToken(token) && modeAttributeCollectionOf(token) === null && hasRawValue(token) && !rawPropertyPattern.test(name)) {
      problems.push(`${describeToken(token)}: raw value, but ${name} is not a property allowed to be raw. Alias a token in Figma.`)
    }

    const isPaletteAllowed = !isComponentToken(token) && (name.startsWith(`${prefix}color-`) || name.startsWith(`${prefix}ref-`))
    for (const id of referencedIds(token)) {
      const target = allTokens.get(id)
      const targetName = target ? codeSyntaxName(target) : null
      if (targetName?.startsWith(`${prefix}ref-`) && !isPaletteAllowed) {
        problems.push(`${describeToken(token)}: aliases the palette colour ${targetName}. Only Semantic colours may; alias a Semantic colour instead.`)
      }
    }
  }

  problems.push(...aliasCycles(tokens, allTokens))

  if (problems.length > 0) {
    const listed = problems.slice(0, MAX_LISTED).map((problem) => `  - ${problem}`)
    if (problems.length > MAX_LISTED) listed.push(`  … and ${problems.length - MAX_LISTED} more`)
    throw new Error(`${problems.length} token(s) break the Cobalt token rules:\n${listed.join("\n")}`)
  }
}

/**
 * Finds alias cycles, each reported once as its chain of token paths.
 */
function aliasCycles(tokens: Array<Token>, allTokens: Map<string, Token>): Array<string> {
  const done = new Set<string>()
  const cycles: Array<string> = []

  const visit = (token: Token, chain: Array<Token>) => {
    const start = chain.findIndex((t) => t.id === token.id)
    if (start >= 0) {
      const loop = [...chain.slice(start), token].map((t) => [...(t.tokenPath || []), t.name].join("/"))
      cycles.push(`alias cycle: ${loop.join(" -> ")}. Break it in Figma.`)
      return
    }
    if (done.has(token.id)) return
    for (const id of referencedIds(token)) {
      const target = allTokens.get(id)
      if (target) visit(target, [...chain, token])
    }
    done.add(token.id)
  }

  for (const token of tokens) visit(token, [])
  return cycles
}
