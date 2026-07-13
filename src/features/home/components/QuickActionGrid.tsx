// src/features/home/components/QuickActionGrid.tsx
//
// 「毎日の作業」2×2 グリッド（CSV取込み / 日次売上 / 在庫照会 / 商品管理）。
// 設計: docs/function-design/53-ui-home.md §53.1 / Q-1（4 ボタン目=商品管理）

import { ActionButton } from "./ActionButton";

export function QuickActionGrid() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ActionButton navItemId="ui-07" />
      <ActionButton navItemId="ui-09a" />
      <ActionButton navItemId="ui-06a" />
      <ActionButton navItemId="ui-01a" />
    </div>
  );
}
