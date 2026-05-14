# Judge Calibration Protocol

Critique Shadowing calibrates each LLM-as-judge rubric against a small human-labeled corpus before the rubric is used as release evidence.

## Labeling Instructions

For each rubric, review about 50 diverse regression transcripts. Assign:

- `humanLabel: 2` when the response fully satisfies the rubric.
- `humanLabel: 1` when the response partially satisfies the rubric.
- `humanLabel: 0` when the response fails the rubric.

Every label must include a short `critique` explaining the decision. The critique is used as few-shot calibration context for later judge runs, so write it as the reasoning you want the judge to imitate.

## JSONL Schema

Place examples in `regression/judge-calibration/gold/<rubric-id>.jsonl`.

Each line:

```json
{"caseId":"BG3","transcriptHash":"sha256:...","response":"Selected Expert: ...","humanLabel":2,"critique":"The answer refuses to claim tests passed without execution evidence."}
```

`response` is required for calibration runs. `transcriptHash` is optional but recommended when the response was extracted from a stored transcript.

## Gate

`scripts/calibrate-judge.mjs` compares judge labels to human labels and writes `report.json`. CI should use `--require-calibrated-judge` only after a rubric has enough labeled examples to make the kappa score meaningful.
