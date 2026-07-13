# Lessons

このファイルは user correction、再発 mistake、review findings から学んだ pattern を蓄積するためのものです。
session start で確認し、同じ mistake を繰り返さないために使います。

## Writing Rules

- incident の詳細より、再利用できる pattern を書く。
- rule は短く、行動に変換できる形にする。
- 1 lesson = 1 mistake pattern を基本にする。
- specialized な内容は docs や Skills に切り出し、ここには再発防止 rule を残す。

## Template

### [Short title]

- Date:
- Context:
- Mistake:
- Better pattern:
- Rule for future work:

## Lessons

### Verify the exact workflow, not just a partial success

- Date: 2026-04-05
- Context: Docker / WSL troubleshooting
- Mistake: `docker info` や `docker compose build` が通った時点で、開発 workflow 全体も復旧したと見なしそうになった。
- Better pattern: API 接続、bind mount、実際の開発コマンドなど、project が依存する workflow を end-to-end で確認する。
- Rule for future work: environment fix では「project が本当に必要とする操作」が通るまで resolved 扱いにしない。

### Keep root instruction files short

- Date: 2026-04-05
- Context: `CLAUDE.md` maintenance
- Mistake: root file に conventions、lessons、workflow、domain knowledge を全部詰め込みそうになった。
- Better pattern: root には常時効く operating rules だけを置き、詳細は `tasks/lessons.md`、docs、Skills に分離する。
- Rule for future work: `CLAUDE.md` が specialized になり始めたら、まず Skill 化または docs 化を検討する。
