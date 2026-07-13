# Test Design

TDD は有用だが、TDDだけでは「どんなテストを書くべきか」は決まらない。
このワークフローでは、実装前に Test Design Matrix を作り、有効なテストを設計する。

## 良いテストの条件

- どの contract を守るか明確
- どの failure mode を捕まえるか明確
- 壊れた実装で本当に落ちる
- assertion が存在確認だけでなく意味を見ている
- helper単体だけでなく main wiring / integration を必要に応じて見る
- wire type / internal type / producer-consumer / round-trip path を確認する
- negative path / data safety / compatibility を押さえる

## Test Categories

- Contract tests
- Negative / fail-fast tests
- Boundary tests
- State / policy tests
- Compatibility / schema tests
- Main wiring / integration tests
- Data safety tests
- Regression tests
- Mutation-style adequacy checks

## Test Adequacy Questions

- この分岐を反転したらどのテストが落ちるか。
- `>=` を `>` に変えたらどのテストが落ちるか。
- guard を消したらどのテストが落ちるか。
- output field を削除したらどのテストが落ちるか。
- schema order を変えたらどのテストが落ちるか。
- dry-run に副作用を入れたらどのテストが落ちるか。
- JSON number が JavaScript safe integer range を越えたらどのテストが落ちるか。
- route/search state token を browser/client code で round-trip したらどのテストが落ちるか。
