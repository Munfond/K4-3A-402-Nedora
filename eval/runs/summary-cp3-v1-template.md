# CP3 run summary · template

> Replace this template only inside `eval/runs/cp3-run-001/summary.md` after a real
> run. Do not fill it with invented values.

## Run identity

- Run ID: `cp3-run-001`
- Model:
- Prompt hash:
- Schema version:
- Policy version:
- Golden hash:
- Coverage hash:
- Started / finished:

## Coverage

| Metric | Value | Gate | Status |
|---|---:|---:|---|
| Case planned | 20 | 20 | |
| Case run | 0 | 20 | |
| Case `dat` | 0 | — | |
| Case `khong-dat` | 0 | — | |
| Case `loi` | 0 | 0 excluded | |
| Case pass rate | — | ≥70% | |
| Location exact | — | ≥70% | |
| Location ±1 | — | ≥80% | |
| Traceability | — | 100% | |

## Hard gates

| Gate | Count | Required |
|---|---:|---:|
| PII leak | 0 | 0 |
| Injection/toxic leak | 0 | 0 |
| Unauthorized export | 0 | 0 |
| Unknown ID/sentence exception | 0 | 0 |

## Case failures

List every failed or errored case, ordered by consequence. Do not remove `loi` cases
from the denominator.

## R4 status

- Golden cases: 20 planned.
- Taxonomy classes ①–④: covered in golden v1.
- Real chatlog cases: 0; C5 synthetic-only policy conflict unresolved.
