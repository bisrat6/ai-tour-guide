/**
 * R13 — token usage checker.
 *
 *   node scripts/check-token-usage.ts
 *
 * Component, gallery and preview code may only speak in semantic, component and
 * scale tokens. This enforces four rules against every scanned file:
 *
 *   raw-color    no hex, rgb()/rgba(), hsl()/hsla() or CSS named colours
 *   primitive    no var() reference to a primitive step; use a semantic token
 *   amber-scope  no --amber-* or --scope-* custom property; amber is chrome in
 *                exactly one place, and that place owns its tokens
 *   font-family  no font-family; the type layer owns the families
 *
 * A file may opt out of one rule with a comment containing
 * `token-usage-allow: <rule>`, which keeps every exception greppable. There are
 * no exceptions today.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { primitives } from '../src/tokens/primitives.ts'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Directories and files that must stay token-only. src/kit and src/gallery
 * arrive with the Phase 2 UI kit; the checker simply skips what is absent.
 */
const targets = ['src/kit', 'src/gallery', 'src/preview', 'src/App.tsx']

const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css'])

type RuleId = 'raw-color' | 'primitive' | 'amber-scope' | 'font-family'

type Finding = {
  file: string
  line: number
  rule: RuleId
  detail: string
  snippet: string
}

const primitiveVars = new Set(primitives.map((entry) => entry.cssVar))

/** CSS named colours. `currentColor`, `transparent` and `none` are not values that fix a hue. */
const namedColors = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white',
  'whitesmoke', 'yellow', 'yellowgreen',
]

const namedColorPattern = new RegExp(`\\b(${namedColors.join('|')})\\b`, 'i')
const hexPattern = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i
const functionalColorPattern = /\b(?:rgba?|hsla?)\(/i
const colorPropertyPattern =
  /(?:^|[;{\s])(?:-?[a-z-]*color|background|background-color|border[a-z-]*|outline[a-z-]*|fill|stroke|box-shadow|text-shadow|column-rule[a-z-]*)\s*:\s*([^;{}]*)/gi
const quotedValuePattern = /(['"`])([^'"`\n]{1,40})\1/g
const varPattern = /var\(\s*(--[a-z0-9-]+)/gi
const amberScopePattern = /--(?:amber|scope)-[a-z0-9-]*/gi
const fontFamilyPattern = /font-family|fontFamily/

/**
 * Blanks out comments so a rule cannot fire on prose, while keeping line and
 * column positions intact.
 */
function stripComments(source: string, isCss: boolean): string {
  const out = source.split('')
  let index = 0
  let quote: string | null = null

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (quote !== null) {
      if (char === '\\') index += 1
      else if (char === quote) quote = null
      index += 1
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      index += 1
      continue
    }

    if (char === '/' && next === '*') {
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] !== '\n') out[index] = ' '
        index += 1
      }
      out[index] = ' '
      if (index + 1 < source.length) out[index + 1] = ' '
      index += 2
      continue
    }

    if (!isCss && char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        out[index] = ' '
        index += 1
      }
      continue
    }

    index += 1
  }

  return out.join('')
}

function allowedRules(source: string): Set<string> {
  const allowed = new Set<string>()
  for (const match of source.matchAll(/token-usage-allow:\s*([a-z-]+)/gi)) {
    allowed.add(match[1].toLowerCase())
  }
  return allowed
}

function checkFile(absolutePath: string): Finding[] {
  const file = relative(projectRoot, absolutePath).replace(/\\/g, '/')
  const raw = readFileSync(absolutePath, 'utf8')
  const isCss = extname(absolutePath) === '.css'
  const allowed = allowedRules(raw)
  const lines = stripComments(raw, isCss).split(/\r?\n/)
  const findings: Finding[] = []

  const seen = new Set<string>()
  const add = (rule: RuleId, line: number, detail: string, snippet: string) => {
    if (allowed.has(rule)) return
    const key = `${line}|${rule}|${detail}`
    if (seen.has(key)) return
    seen.add(key)
    findings.push({ file, line: line + 1, rule, detail, snippet: snippet.trim() })
  }

  lines.forEach((line, index) => {
    const hex = hexPattern.exec(line)
    if (hex) add('raw-color', index, `hex value ${hex[0]}`, line)

    const functional = functionalColorPattern.exec(line)
    if (functional) add('raw-color', index, `${functional[0]} colour function`, line)

    // Named colours only count in a value position, never in prose or identifiers.
    colorPropertyPattern.lastIndex = 0
    let declaration: RegExpExecArray | null
    while ((declaration = colorPropertyPattern.exec(line)) !== null) {
      const named = namedColorPattern.exec(declaration[1])
      if (named) add('raw-color', index, `named colour ${named[1]}`, line)
    }

    quotedValuePattern.lastIndex = 0
    let quoted: RegExpExecArray | null
    while ((quoted = quotedValuePattern.exec(line)) !== null) {
      if (namedColors.includes(quoted[2].trim().toLowerCase())) {
        add('raw-color', index, `named colour ${quoted[2].trim()}`, line)
      }
    }

    varPattern.lastIndex = 0
    let reference: RegExpExecArray | null
    while ((reference = varPattern.exec(line)) !== null) {
      const name = reference[1].toLowerCase()
      if (primitiveVars.has(name)) add('primitive', index, `${name} is a primitive step`, line)
    }

    amberScopePattern.lastIndex = 0
    let amberScope: RegExpExecArray | null
    while ((amberScope = amberScopePattern.exec(line)) !== null) {
      add('amber-scope', index, `${amberScope[0]} belongs to the scoped-in band`, line)
    }

    if (fontFamilyPattern.test(line)) {
      add('font-family', index, 'font-family is set by the type layer', line)
    }
  })

  return findings
}

function collectFiles(target: string): string[] {
  const absolute = join(projectRoot, target)
  if (!existsSync(absolute)) return []
  if (statSync(absolute).isFile()) {
    return scannedExtensions.has(extname(absolute)) ? [absolute] : []
  }
  return readdirSync(absolute).flatMap((entry) => collectFiles(join(target, entry)))
}

function main(): void {
  const files = targets.flatMap(collectFiles)
  const scanned = targets.filter((target) => existsSync(join(projectRoot, target)))
  const skipped = targets.filter((target) => !existsSync(join(projectRoot, target)))
  const findings = files.flatMap(checkFile)

  if (findings.length > 0) {
    console.error('Token usage violations:')
    for (const finding of findings) {
      console.error(`  ${finding.file}:${finding.line} [${finding.rule}] ${finding.detail}`)
      console.error(`    ${finding.snippet}`)
    }
    console.error('')
    console.error('Use a semantic, component or scale token instead.')
    process.exit(1)
  }

  console.log(`Token usage clean: ${files.length} file(s) in ${scanned.join(', ')}.`)
  if (skipped.length > 0) console.log(`Not present yet, skipped: ${skipped.join(', ')}.`)
}

main()
