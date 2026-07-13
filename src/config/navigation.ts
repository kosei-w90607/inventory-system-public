import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BarChartBig,
  ClipboardList,
  DatabaseBackup,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Hand,
  Home,
  Package,
  PackagePlus,
  PackageSearch,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/// UI-12 共通レイアウトのナビゲーション定義。
/// 設計: docs/function-design/52-ui-shared-layout.md §52.3 / §52.4
/// 設計合意: docs/archive/plans/2026-04-21-ui-12-design-agreement.md §2.1 / §4.1 / §4.2

export type NavStatus = "active" | "pending";

export interface NavItem {
  id: string;
  label: string;
  title: string;
  to: string | null;
  icon: LucideIcon;
  status: NavStatus;
}

export interface NavArea {
  id: "daily" | "products" | "inventory" | "system";
  label: string;
  icon: LucideIcon;
  items: readonly NavItem[];
}

/// 4 エリア × 19 項目。Phase 2 daily 5 画面は route 実装済みで active。
/// Phase 3/4 以降で各画面着手時に to を実 path に + status を "active" に切り替える。
export const navigation: readonly NavArea[] = [
  {
    id: "daily",
    label: "毎日の業務",
    icon: Sun,
    items: [
      {
        id: "ui-00",
        label: "ホーム",
        title: "ホーム",
        to: "/",
        icon: Home,
        status: "active",
      },
      {
        id: "ui-07",
        label: "売上データ取込み",
        title: "売上データ取込み",
        to: "/csv-import",
        icon: FileUp,
        status: "active",
      },
      {
        id: "ui-09a",
        label: "日次売上",
        title: "日次売上",
        to: "/reports/daily",
        icon: BarChart3,
        status: "active",
      },
      {
        id: "ui-06a",
        label: "在庫照会",
        title: "在庫照会",
        to: "/stock",
        icon: Search,
        status: "active",
      },
      {
        id: "ui-09b",
        label: "月次売上",
        title: "月次売上",
        to: "/reports/monthly",
        icon: BarChartBig,
        status: "active",
      },
    ],
  },
  {
    id: "products",
    label: "商品管理",
    icon: Package,
    items: [
      {
        id: "ui-01a",
        label: "商品検索・一覧",
        title: "商品検索・一覧",
        to: "/products",
        icon: PackageSearch,
        status: "active",
      },
      {
        id: "ui-01b-new",
        label: "商品登録",
        title: "商品登録",
        to: null,
        icon: PackagePlus,
        status: "pending",
      },
      {
        id: "ui-01c",
        label: "一括インポート",
        title: "一括インポート",
        to: "/products/import",
        icon: FileSpreadsheet,
        status: "active",
      },
      {
        id: "ui-08",
        label: "PLU書出し",
        title: "PLU書出し",
        to: "/products/plu-export",
        icon: FileDown,
        status: "active",
      },
    ],
  },
  {
    id: "inventory",
    label: "入出庫",
    icon: ArrowLeftRight,
    items: [
      {
        id: "ui-02",
        label: "入庫記録",
        title: "入庫記録",
        to: "/inventory/receiving",
        icon: PackagePlus,
        status: "active",
      },
      {
        id: "ui-03",
        label: "返品・交換",
        title: "返品・交換",
        to: "/inventory/return",
        icon: RotateCcw,
        status: "active",
      },
      {
        id: "ui-04",
        label: "手動販売出庫",
        title: "手動販売出庫",
        to: "/inventory/manual-sale",
        icon: Hand,
        status: "active",
      },
      {
        id: "ui-05",
        label: "廃棄・破損",
        title: "廃棄・破損",
        to: "/inventory/disposal",
        icon: Trash2,
        status: "active",
      },
      {
        id: "ui-02b-05b",
        label: "入出庫履歴",
        title: "入出庫履歴",
        to: "/inventory/records",
        icon: ScrollText,
        status: "active",
      },
      {
        id: "ui-06b",
        label: "在庫少一覧",
        title: "在庫少一覧",
        to: null,
        icon: AlertTriangle,
        status: "pending",
      },
      {
        id: "ui-10",
        label: "棚卸し",
        title: "棚卸し",
        to: "/stocktake",
        icon: ClipboardList,
        status: "active",
      },
    ],
  },
  {
    id: "system",
    label: "システム管理",
    icon: Wrench,
    items: [
      {
        id: "ui-11b",
        label: "バックアップ",
        title: "バックアップ・復元",
        to: "/settings/backup",
        icon: DatabaseBackup,
        status: "active",
      },
      {
        id: "ui-11c",
        label: "操作ログ",
        title: "操作ログ",
        to: "/settings/logs",
        icon: ScrollText,
        status: "active",
      },
      {
        id: "ui-11a",
        label: "在庫少の基準",
        title: "在庫少の基準",
        to: "/settings/thresholds",
        icon: SlidersHorizontal,
        status: "active",
      },
      {
        id: "ui-13",
        label: "整合性検証",
        title: "整合性検証",
        to: null,
        icon: ShieldCheck,
        status: "pending",
      },
    ],
  },
] as const;
