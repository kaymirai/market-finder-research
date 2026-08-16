# Market Finder: fresh start and count labels

## Goal

Let an operator begin a genuinely new Market Finder run without stale conditions or buyer phrases, and make every visible count distinguish `total`, `in scope`, and `completed`.

## Fresh start

Add a `最初からやり直す` button at the top of stage 1 (条件).

When confirmed, it creates a new active research cycle and clears the active run only:

- Reset category to `Shirt`, event to `イベントなし`, year, custom event, custom seed words, target choices, buyer text, and buyer suggestion offset.
- Clear the current candidates, Etsy/eRank and EverBee results, provider plans, pending automation, and current-round UI state using the existing new-discovery preservation flow.
- Keep saved evidence archives and historical learning records; they are not part of the current run.
- Mark buyer selection as automatic, then select three recommendations for the reset category/event. A later category or event change refreshes automatic selections. Manual buyer edits explicitly switch the mode to manual and are never overwritten.
- Return to stage 1 and show a concise status message. The reset does not begin provider research; the next explicit action is `候補を自動で探す`.

The action uses a confirmation dialog because it removes the current run from the active workspace. Where existing results can be exported, it retains the existing export-before-clearing confirmation path.

## Count language

The five-stage sidebar and the matching progress rail use only these meanings:

| Stage | Label |
| --- | --- |
| 1 条件 | `設定済み` (no count) |
| 2 候補 | `Etsy対象 X / 全Y候補` |
| 3 Etsy公式 | `確認済 X / 対象Y` |
| 4 EverBee | `売上確認済 X / 対象Y` |
| 5 最終結果 | `A/B候補 X / 5件` |

Saved/restored results remain separate from the active run. Any control that offers them labels the number as `保存済みN件（今回の調査外）`; saved rows never contribute to stages 2 through 5.

## Error handling and safeguards

- If a reset is cancelled, the current inputs and run remain unchanged.
- If preserving the terminal evidence archive fails, do not clear the active run and explain the failure.
- If no suitable learned buyer phrase is available, use the existing safe starter recommendations. Do not invent event-specific buyer facts.
- All count denominators derive from the same current-run scoped rows already used by the stage gates; archived and foreign-event rows are excluded.

## Tests

- Verify confirmed reset clears the active inputs and work state, preserves archives, selects three automatic buyer identities, and returns to conditions.
- Verify a manual buyer edit remains unchanged on later event/category changes.
- Verify every sidebar and progress count includes an explicit total/scope/completion label and excludes saved results.
- Run focused Market Finder tests, full Market Finder tests, JavaScript syntax checks, and `git diff --check`.
