// src/features/home/components/MiscActionRow.tsx
//
// 「その他」3 ボタン横並び（棚卸し / バックアップ / 閾値設定）。
// 設計: docs/function-design/53-ui-home.md §53.1
// 全 pending（Phase 4 UI-10/UI-11a/UI-11b まで未着手）。

import { ActionButton } from "./ActionButton";

export function MiscActionRow() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <ActionButton navItemId="ui-10" size="md" />
      <ActionButton navItemId="ui-11b" size="md" />
      <ActionButton navItemId="ui-11a" size="md" />
    </div>
  );
}
