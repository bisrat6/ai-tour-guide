import { primitiveValue } from '../tokens/primitives.ts'
import { semanticGroups, type Plane } from '../tokens/semantic.ts'

type Props = {
  plane: Plane
  computed: Record<string, string>
}

/**
 * Every semantic token as a labelled swatch: the token name, the primitive step
 * it resolves to, and the value the browser computed inside this plane.
 */
export function TokenSwatches({ plane, computed }: Props) {
  return (
    <div className="swatch-groups">
      {semanticGroups.map((group) => (
        <section key={group.title} className="swatch-group">
          <h4 className="column-header swatch-group__title">{group.title}</h4>
          <ul className="swatch-list">
            {group.tokens.map((token) => {
              const primitive = token[plane]
              return (
                <li key={token.name} className="swatch">
                  <span
                    className="swatch__chip"
                    style={{ backgroundColor: `var(${token.cssVar})` }}
                    aria-hidden="true"
                  />
                  <span className="swatch__text">
                    <code className="swatch__name">{token.name}</code>
                    <span className="swatch__meta text-caption">
                      <code>{primitive}</code>
                      <span className="numeric">{computed[token.cssVar] || primitiveValue(primitive)}</span>
                    </span>
                    {token.over === undefined ? null : (
                      <span className="swatch__meta text-caption">painted over {token.over}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
