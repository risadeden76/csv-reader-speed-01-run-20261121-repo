# csv-reader-speed-01-run-20261121-repo

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/risadeden76/csv-reader-speed-01-run-20261121-repo/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/risadeden76/csv-reader-speed-01-run-20261121-repo/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0: a single-pass CSV reader in `solve.js` that returns byte-identical answers (`{columns, rows, errors}`) on every case, including all of the reference's broken-row rules (BOM, stray CRs, unterminated quotes, quote junk, short/long rows, quoted multi-line fields), at about 5.5x the reference's speed on the practice set. `main.ts` is the harness driver that reads `/input/cases.json` and writes `/output/answers.json`.

## Run it

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```
