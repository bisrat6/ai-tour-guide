import {
  auditSections,
  auditTotals,
  buildAudit,
  checkSpecAssertions,
  requirementLabel,
  type AuditRow,
  type Verdict,
} from '../audit/contrast-audit.ts'

const rows = buildAudit()
const totals = auditTotals(rows)
const assertions = checkSpecAssertions()

const verdictCopy: Record<Verdict, string> = {
  pass: 'Pass',
  fail: 'Fail',
  documented: 'Intentional, mitigated',
  'not applicable': 'Not applicable',
}

const verdictColor: Record<Verdict, string> = {
  pass: '--feedback-success',
  fail: '--feedback-danger',
  documented: '--feedback-warning',
  'not applicable': '--feedback-neutral',
}

function VerdictMark({ verdict, label }: { verdict: Verdict; label?: string }) {
  return (
    <span className="verdict">
      <svg
        className="marker"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        style={{ color: `var(${verdictColor[verdict]})` }}
      >
        {verdict === 'pass' ? <circle cx="8" cy="8" r="4" fill="currentColor" /> : null}
        {verdict === 'documented' ? (
          <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
        ) : null}
        {verdict === 'fail' ? (
          <path
            d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : null}
        {verdict === 'not applicable' ? (
          <path d="M4 8 L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : null}
      </svg>
      {label ?? verdictCopy[verdict]}
    </span>
  )
}

function Row({ row }: { row: AuditRow }) {
  return (
    <tr>
      <td>{row.plane === 'tenant' ? 'Tenant' : 'Control'}</td>
      <th scope="row">
        <code>{row.foreground}</code>
        <span className="cell-meta text-caption">
          <code>{row.foregroundPrimitive}</code> <span className="numeric">{row.foregroundValue}</span>
        </span>
      </th>
      <td>
        <code>{row.background}</code>
        <span className="cell-meta text-caption">
          <code>{row.backgroundPrimitive}</code> <span className="numeric">{row.backgroundValue}</span>
          {row.backdrop === undefined ? null : <span> over {row.backdrop}</span>}
        </span>
      </td>
      <td className="numeric">{row.ratio.toFixed(2)}:1</td>
      <td>{requirementLabel[row.requirement]}</td>
      <td>
        <VerdictMark verdict={row.verdict} />
        {row.mitigation === undefined ? null : (
          <span className="cell-meta text-caption">{row.mitigation}</span>
        )}
      </td>
    </tr>
  )
}

/**
 * The Phase 1 audit. Ratios are measured in code from the token values, so this
 * table and docs/contrast-audit.md always report the same numbers.
 */
export function ContrastTable() {
  return (
    <div className="audit">
      <ul className="audit-totals">
        <li>
          <span className="numeric text-display">{totals.measured}</span>
          <span className="text-caption">pairs measured</span>
        </li>
        <li>
          <span className="numeric text-display">{totals.pass}</span>
          <span className="text-caption">pass</span>
        </li>
        <li>
          <span className="numeric text-display">{totals.fail}</span>
          <span className="text-caption">fail</span>
        </li>
        <li>
          <span className="numeric text-display">{totals.documented}</span>
          <span className="text-caption">intentional, mitigated</span>
        </li>
        <li>
          <span className="numeric text-display">{totals.notApplicable}</span>
          <span className="text-caption">decorative, no minimum</span>
        </li>
      </ul>

      {auditSections.map((section) => (
        <table key={section.title} className="data-table">
          <caption>
            <span className="table-caption__title">{section.title}</span>
            <span className="text-caption">{section.description}</span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Plane</th>
              <th scope="col">Foreground</th>
              <th scope="col">Background</th>
              <th scope="col">Ratio</th>
              <th scope="col">Requirement</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) => row.section === section.title)
              .map((row) => (
                <Row key={`${row.plane}-${row.foreground}-${row.background}`} row={row} />
              ))}
          </tbody>
        </table>
      ))}

      <table className="data-table">
        <caption>
          <span className="table-caption__title">Spec assertions</span>
          <span className="text-caption">
            The ratios the spec states, re-measured with the same code.
          </span>
        </caption>
        <thead>
          <tr>
            <th scope="col">Foreground</th>
            <th scope="col">Background</th>
            <th scope="col">Spec says</th>
            <th scope="col">Measured</th>
            <th scope="col">Agrees</th>
            <th scope="col">Claim</th>
          </tr>
        </thead>
        <tbody>
          {assertions.map((entry) => (
            <tr key={`${entry.foreground}-${entry.background}`}>
              <th scope="row">
                <code>{entry.foreground}</code>
                <span className="cell-meta text-caption numeric">{entry.foregroundValue}</span>
              </th>
              <td>
                <code>{entry.background}</code>
                <span className="cell-meta text-caption numeric">{entry.backgroundValue}</span>
              </td>
              <td className="numeric">{entry.asserted.toFixed(2)}:1</td>
              <td className="numeric">{entry.measured.toFixed(2)}:1</td>
              <td>
                <VerdictMark
                  verdict={entry.agrees ? 'pass' : 'fail'}
                  label={entry.agrees ? 'Agrees' : 'Differs'}
                />
              </td>
              <td>{entry.claim}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
