# C5 FeedbackRadar · Evaluation contract

## Canonical artifacts

The active CP3 contract is:

- `golden/golden-set.v1.json`: 20 analysis cases (8 `thuong`, 8 `kho`, 4 `hiem`).
- `golden/COVERAGE-v1.md`: coverage, hard gates and the frozen CP3 quality bar.
- `ingestion-cases.v1.json`: loader cases for the C5 JSON + survey CSV fixture.
- `runs/results-cp3-v1-template.csv`: case-level result schema. It is a template, not evidence of a run.
- `runs/manifest-cp3-v1-template.json` and `runs/summary-cp3-v1-template.md`: required artifact shapes for the first immutable run.

`expected` and `passCriteria` are evaluator-only data. They must never be sent to the model.
All C5 feedback in the eval pack is synthetic. The team must not relabel it as learner data.

## Data boundary

The C5 fixture has 18 JSON feedbacks and 10 survey rows. Six survey IDs merge with JSON
records and four IDs are survey-only, producing 22 normalized records. `gy-019` has a
score but no text and must receive the code-side label `chi-cham-diem`; it must not be
sent to the model as a content feedback.

The analysis golden set intentionally uses independent `v1-*` synthetic IDs so that the
analysis cases are not confused with the raw fixture. The loader contract in
`ingestion-cases.v1.json` is therefore required in addition to the 20 analysis cases.

## Run evidence required for CP3

The first immutable run must create:

```text
eval/runs/cp3-run-001/
  manifest.json
  results.jsonl
  summary.md
  traces/
```

The run must use one model/prompt/schema/policy configuration, include every case,
keep `loi` cases in the denominator, and record the hash of the golden and coverage
contracts. No actual run is claimed until these artifacts exist.

## Legacy pilot files

`golden/pool.json`, `golden/batches.json`, `golden/COVERAGE.md` and
`runs/results-luot1-template.csv` are `pilot-v1` history. They are not the active CP3
contract and must not be mixed with `golden-set.v1.json` results.

## Open policy conflict

The general rubric asks for at least 10 cases from real chatlogs, while the C5 pack
prohibits real learner feedback and requires synthetic feedback. This repository does
not fake that requirement. CP3 remains marked incomplete until the organizer grants a
written C5 exception or supplies an approved, redacted source with provenance.
