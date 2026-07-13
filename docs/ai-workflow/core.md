# Core Concepts

## 4つの役割

```text
docs
  正本。仕様、判断、運用ルールを置く。

templates
  成果物の型。Plan Packet / Test Design Matrix / Review Packet など。

skills
  実行入口。AIに「いつ・何を読み・何を出すか」を指示する。

project-profile
  そのrepo固有の適応レイヤ。出力、危険領域、テストコマンド、データ境界を定義する。
```

## Workflow Loop

```text
1. Setup Project Profile
2. Plan Packet
3. Test Design Matrix
4. Implementation
5. Review-only Sub-agent
6. Finding Handling
7. External Review
8. Human Approval
9. Workflow Effectiveness Review
```

## 基本原則

- Risk Level は変更単位のリスク。
- P1/P2/P3 は review finding 単位の重大度。
- この2つを一対一対応させない。
- AIの validation / review / fix claim は claim として扱う。
- sub-agent の finding は実装者が live files / tests / specs / diff で再検証する。
- 良いテストは「存在」ではなく「壊れた実装で落ちるか」で評価する。
- docs drift を避けるため、同じルールを複数場所に長文で重複させない。
