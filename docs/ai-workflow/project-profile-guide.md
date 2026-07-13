# Project Profile Guide

Project Profile は、共通ワークフローを各repoに適応させる設定ファイルです。

## なぜ必要か

共通コアだけでは、次が分かりません。

- 何が成果物か
- 何がschemaか
- 何がdata safety riskか
- どのコマンドが品質ゲートか
- どのdocsが正本か
- どの変更がR3/R4か

そのため、導入時に `docs/project-profile.md` を作ります。

## Setup Flow

```text
1. repo構造を読む
2. README/docs/scripts/tests/configを読む
3. outputs/artifactsを特定する
4. stable contractsを特定する
5. high-risk changesを定義する
6. data safety boundaryを定義する
7. test/lint/type/doc commandsを抽出する
8. source-of-truth hierarchyをrepo向けに具体化する
9. project-profile.mdを生成する
10. 人間が確認する
```

## Rule

共通Skillにプロジェクト固有語を入れすぎない。
プロジェクト固有情報は `docs/project-profile.md` に置く。
