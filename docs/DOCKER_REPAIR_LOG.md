# Docker Desktop 修理ログ

> **最終更新**: 2026-04-03
> **ステータス**: docker-ce 29.3.1 に移行して回避済み。Docker Desktop のVM再起動バグは**未解決**（使用停止、アンインストールはしない）

---

## 症状

Docker Desktop 4.67.0 で WSL Integration を Ubuntu-22.04 に対してONにして Apply すると、設定反映のために Engine が一旦停止するところまでは進むが、その後の Engine 再起動が「Engine stopping」表示のまま無限にハングする。停止→再起動のサイクルのうち、再起動側で詰まって戻ってこない。

## 環境

- Windows 11 Home
- WSL2 Ubuntu-22.04（中身は 24.04 にインプレースアップグレード済み）
- Docker Desktop 4.67.0（クリーンインストール済み）

## 試したこと（全て失敗）

| # | 手法 | 結果 |
|---|------|------|
| 1 | socat パッケージ削除（過去の workaround 残骸） | 効果なし |
| 2 | Docker Desktop UI → WSL Integration ON → Apply | Engine 停止まで進むが、再起動が「Engine stopping」のまま無限ハング |
| 3 | `wsl --unregister docker-desktop` → Docker Desktop 再起動 | docker-desktop は自動再作成されるが docker-desktop-data は作成されない |
| 4 | 完全クリーンインストール（アンインストール + データディレクトリ全削除 + 再インストール） | 同じ症状 |
| 5 | Resource Saver を OFF にしてから Apply & restart | 同様にEngine再起動で無限ハング |
| 6 | `.wslconfig` 確認 | ファイル自体存在しない（autoMemoryReclaim 問題ではない） |
| 7 | 新 Ubuntu-24.04 distro で WSL Integration テスト | **同じくEngine再起動で無限ハング。distro 固有の問題ではなくシステムレベルの問題と確定** |
| 8 | Docker Desktop 4.59.0 へのダウングレード | **ダウングレード自体は成功。GUIも起動し、Engine稼働（running）まで正常到達。しかしWSL Integration ON → Apply でEngine再起動が同じく無限ハング。バージョンに依存しない問題** |

### クリーンインストール時に削除したディレクトリ
- `%APPDATA%\Docker`
- `%LOCALAPPDATA%\Docker`
- `%USERPROFILE%\.docker`

## 確定した事実

- docker CLI は動く（以前の I/O error は解消済み）
- `docker-desktop` distro は存在するが `docker-desktop-data` は一度も作成されない
  - **→ 最近のバージョンでは正常動作（VHDXマウント方式に変更済み。dataは`docker-desktop`内に統合）**
- `guest-services/` にソケット群は存在（`docker.proxy.sock` 等）
- `docker.proxy.sock` は `root:root` 所有で一般ユーザーからは Permission denied
- `settings-store.json` に WSL Integration 設定が存在しない（有効化に至っていない）
- WSL 内に Docker 関連プロセスなし（Integration daemon が起動していない）
- **Engine の停止は正常に完了する**が、その後の再起動が始まらない（ログで裏取り済み。4.59.0で Engine running → WSL Integration ON → graceful shutdown 完了 → 再起動ログなし → ping無限ループ）
- WSL 側に Docker 競合パッケージなし（docker.io, docker-ce, moby 等）
- ユーザーは `docker` グループに所属済み

## Docker Desktop のVM層とは何か

Docker Desktop は WSL2 上でコンテナを動かすために、専用の**VM層**（`docker-desktop` ディストロ）を使う。これがどこで何をしているかを理解すると、今回のバグの所在が分かる。

### アーキテクチャ

```
Windows Host
  └── Docker Desktop (com.docker.backend.exe) ← Windows側バックエンド
        │
        │  IPC（ping/ヘルスチェック）
        ↓
      WSL2 Hyper-V 軽量VM（Microsoftが管理するLinuxカーネル）
        └── docker-desktop ディストロ ← 専用の隔離Linux環境（=VM層）
              ├── wsl-bootstrap       ← 起動処理・VHDXマウント
              ├── dockerd             ← Docker Daemon本体
              ├── VHDX仮想ディスク     ← イメージ/コンテナ/ボリュームの格納先
              └── コンテナ群
```

### 各層の役割

| 層 | 何をしているか |
|----|--------------|
| **com.docker.backend.exe** | Windows側のプロセス。Docker Desktop のGUI/トレイアイコン、VM層の起動・停止管理、IPC経由でdockerdと通信 |
| **WSL2 Hyper-V 軽量VM** | Microsoftが管理する仮想マシン。全WSL2ディストロが同じLinuxカーネル上で動く |
| **docker-desktop ディストロ** | Docker専用の隔離Linux環境。ユーザーのUbuntuとは別のディストロとしてWSL2に登録される。dockerdやコンテナランタイムがここで動く |
| **wsl-bootstrap** | docker-desktopディストロの起動時に走る初期化処理。VHDXデータディスクのマウント・フォーマットを担当 |
| **VHDX仮想ディスク** | Windows上の仮想ディスクファイル（`ext4.vhdx`）。Dockerのイメージ、コンテナ、ボリュームの実体はここに格納される |

### 今回のバグの所在

問題は**VM再起動シーケンス**にある。初回起動ではEngine稼働（running）まで正常に到達する。しかしWSL Integration ON等の設定変更でVM再起動が必要になると、VM停止（graceful shutdown）は正常に完了するが、**その後のVM再起動処理がWindows側バックエンドから開始されない**。再起動のログ行が一切出ないまま、statsコンポーネントのIPCヘルスチェック（ping）だけが10秒間隔で `context deadline exceeded` を永遠に繰り返す。

### なぜ docker-ce なら動くのか

```
Docker Desktop:  Windows → com.docker.backend.exe → docker-desktop VM → VHDX → dockerd → コンテナ
docker-ce:       Ubuntu ディストロ内で直接 dockerd → /var/lib/docker → コンテナ
```

docker-ceはVM層（docker-desktopディストロ）を一切使わない。ユーザーのUbuntuディストロ内にdockerdを直接インストールして動かす。VM再起動シーケンスもwsl-bootstrapもcom.docker.backend.exeも関係ない。だからDocker DesktopのVM再起動バグの影響を一切受けない。

## 関連 GitHub Issues（2026-04-03 調査時点、全てOPEN/未解決）

Docker側からの公式修正リリースはなし。対応は限定的で、ほぼトリアージ放置の状態。

### 直接関連するIssue

| Issue | タイトル | ステータス | Docker公式対応 |
|-------|---------|-----------|--------------|
| [docker/for-win#14797](https://github.com/docker/for-win/issues/14797) | Docker Desktop stuck 'Applying settings' with WSL integration for Ubuntu-22.04 | **OPEN** | なし（トリアージ放置） |
| [docker/for-win#14832](https://github.com/docker/for-win/issues/14832) | WSL Integration freezes for Ubuntu-24.04 | **OPEN** | なし |
| [docker/for-win#14993](https://github.com/docker/for-win/issues/14993) | Endless spinner on docker engine shutdown | **OPEN** | Docker社員がパッチ版4.54を提供するもissue継続。4.53へのダウングレードを一時的に推奨 |
| [docker/for-win#14656](https://github.com/docker/for-win/issues/14656) | Resource Saver mode causes WSL to freeze | **OPEN** | なし（31件のコメントでユーザーから報告が続くがアサインなし） |
| [microsoft/WSL#11066](https://github.com/microsoft/WSL/issues/11066) | Resource saver causes WSL to lock | **OPEN** | Microsoft側も対応なし |

### 関連するVHDX/起動問題のIssue（直接の原因ではないが同じVM層の問題群）

| Issue | タイトル | 関連性 |
|-------|---------|--------|
| [docker/for-win#14580](https://github.com/docker/for-win/issues/14580) | VHDX マウント失敗 "Failed to attach disk" | VHDX操作の失敗パターン違い |
| [docker/for-win#14228](https://github.com/docker/for-win/issues/14228) | VHDX "Access is denied" エラー | VHDXアクセス権限の問題 |
| [docker/for-win#13845](https://github.com/docker/for-win/issues/13845) | docker-desktop-data ディストロが自動作成されない | 我々の環境でも同じ症状（ただし最近のバージョンではdata統合済みのため正常） |

### 他ユーザーが報告している回避策と我々の環境での結果

| 回避策 | 我々の環境での結果 |
|--------|-----------------|
| Resource Saver OFF | 試行済み（#5）、効果なし |
| `.wslconfig` で `autoMemoryReclaim=disabled` | `.wslconfig` 自体が存在しない（#6）、該当なし |
| `wsl --shutdown` で完全再起動 | 試行済み、効果なし |
| Docker Desktop ダウングレード（4.53等） | 4.59.0で試行。ダウングレード自体は成功するがWSL Integration ONで同症状（#8） |
| Resource Saver タイムアウト延長（30秒+） | Resource Saver OFF でも効果なかったため未試行 |
| WSL バージョンダウングレード | 未試行（他の問題を引き起こすリスクあり） |
| docker-ce 直接インストール | **これで回避成功** |

## 根本原因（2026-04-03 ログ解析で特定）

### ログファイルの場所
- `%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log` — Windows側バックエンド（最重要）
- `%LOCALAPPDATA%\Docker\log\vm\init.log` — WSL VM内部ログ

### 解析結果（4.59.0ダウングレード後のログで裏取り済み）

以下は4.59.0にダウングレードした後の実際のログ。ユーザーエージェントに `Docker-Desktop/4.59.0` が記録されている。

**起動〜Engine稼働（正常）**:
```
[10:00:48] Docker Desktop 4.59.0 起動
[10:01:07] VM起動完了、WSL Integration サービス開始
[10:01:08] ping成功（HEAD /_ping → 200）、Dashboard: running ← Engine正常稼働
```

**WSL Integration ON → Engine停止（正常）**:
```
[10:01:31] GUI: GET /wsl/distros → [Ubuntu-22.04, Ubuntu-24.04]
[10:01:32] ユーザー操作: bind: {"wslIntegration":{"distros":["Ubuntu-22.04"]}}
[10:01:33] settings checked: changes: true, restart needed: true
           RestartVMReason: "changed settings(IntegratedWslDistros) require restart"
           engine stop requested → Dashboard: stopping
[10:01:34] VM側: Daemon shutdown complete（graceful）
           バックエンド: VM has indicated it is ready to be powered off
           → terminating main distribution → unmounting data disk → 正常シャットダウン完了
```

**Engine再起動（ここで死ぬ）**:
```
[10:01:47] stats GET /ping → context deadline exceeded  ← 最初のpingタイムアウト
[10:01:57] stats GET /ping → context deadline exceeded  ← 以降10秒間隔で永久ループ
[10:02:07] stats GET /ping → context deadline exceeded
  ... （ログ末尾 10:11:37 まで延々と同じ）
```

**Engine再起動のログ行が一切ない**。VM停止は正常完了したが、次のVM起動処理が始まらないまま、statsコンポーネントだけがpingを打ち続けている。

### init.log（VM側）の対応箇所

```
[10:01:34] stopping command
[10:01:34] Daemon shutdown complete
[10:01:34] stopping services
[10:01:34] graceful shutdown complete
```

VM側は正常にシャットダウンを完了している。問題はWindows側バックエンドがVM再起動を開始できないこと。

### 原因の構造

1. Docker Desktop起動 → WSLエンジン起動 → Engine正常稼働（ping成功、Dashboard: running）
2. ユーザーがWSL Integration ON → Apply → 設定変更にはVM再起動が必要と判定
3. Engine停止処理が開始 → VM側のdockerdが正常にgraceful shutdown
4. Windows側バックエンドが「VM停止完了」を認識 → `terminating main distribution` → `unmounting data disk`
5. **ここでVM再起動処理が始まらない**。Engine再起動のログ行が一切出ない
6. statsコンポーネントのIPC ping（ヘルスチェック）が10秒間隔で `context deadline exceeded` を永遠に繰り返す
7. UIには「Engine stopping」と表示されたまま

**結論**: WSL Integration設定変更時のVM再起動シーケンスのバグ。VM停止までは正常に完了するが、その後のVM再起動処理が開始されない。4.67.0でも4.59.0でも同じ症状が再現し、バージョンに依存しない問題。2026-04-03時点で未修正。

## 回避策: docker-ce直接インストール

Docker Desktop のVM層を完全にバイパスし、WSL2 Ubuntu に docker-ce（Linux ネイティブ Docker Engine）を直接インストールする方針に切り替え。

### なぜこれで動くか

Docker Desktop はコンテナを動かすために専用VM層（docker-desktopディストロ + com.docker.backend.exe）を経由する。この経路上のVM再起動シーケンスが壊れている。docker-ceはVM層を使わず、Ubuntuディストロ内でdockerdを直接起動するため、壊れた経路を一切通らない。

### 調査済みの別案

| 案 | 結果 |
|----|------|
| Linux版Docker DesktopをWSL2にインストール | **不可能**。KVM必須（WSL2カーネルが`/dev/kvm`を公開しない）、ネスト仮想化非サポート |
| Docker Desktop 4.59.0 にダウングレード | **ダウングレード成功・Engine running到達**。ただしWSL Integration ONでVM再起動が同じく無限ハング。バージョンに依存しない問題 |
| docker-ce直接インストール | **採用**。全前提条件クリア（systemd稼働、競合パッケージなし、dockerグループ所属済み） |

### docker-ceのインストール手順

```bash
# GPGキー + リポジトリ追加
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# インストール
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 有効化
sudo systemctl enable docker && sudo systemctl start docker

# 動作確認
docker run hello-world && docker compose version
```

### Docker Desktopとの共存

Docker Desktopは停止状態にしておけば共存可能（ポート競合なし）。アンインストール不要。

## アップデート前のバージョン特定（2026-04-03）

`DockerDesktopUpdates/` に残っていたアップデーターファイル名から特定:
```
Docker Desktop Updater-217644 (222858).exe
                       ^^^^^^  ^^^^^^
                       旧ビルド  新ビルド(4.67.0)
```

- **ビルド217644 = Docker Desktop 4.59.0**（2026-02-02リリース）
- インストール履歴（`DockerDesktopInstallers/` のタイムスタンプ）:
  - 2026-01-29: 初回インストール（4.59.0）
  - 2026-02-03: 再インストール（4.59.0）
  - 2026-04-02: 4.67.0にアップデート → Engine stoppingでハング開始
- **4.59.0はこの環境（WSL2 Ubuntu + Windows 11 Home）で動作実績がある**
- 4.59.0へのダウングレードは成功しEngine running到達するが、WSL Integration ONでVM再起動が同じくハング（「試したこと」#8 参照）。バージョンに依存しない問題

## 経緯（時系列）

1. 元々 Docker Desktop の bind mount が壊れていた
2. `/var/run/docker.sock` 不在 → socat で `docker.proxy.sock` に bridge → API接続は復旧したが bind mount は未解決
3. Docker Desktop を再インストール → Engine stopping 問題が発生
4. 2026-04-03: 完全クリーンインストール実施 → 同じ症状
5. 2026-04-03: ログ解析でVM再起動シーケンスのバグと特定（VM停止は正常、再起動が開始されない）。Linux版DD案はKVM必須で却下。docker-ce直接インストールに方針転換
6. 2026-04-03: docker-ce 29.3.1 インストール完了。`docker compose run` でプロジェクトのdevコンテナ起動確認（bind mount、cargo-cache volume、Rust/Node/SQLite全てOK）
7. 2026-04-03: Docker Desktop のVM再起動バグは未解決のまま。docker-ceはVM層を使わないため影響を受けない。Docker側のIssue修正を待つか、Docker Desktopが必要になった時点で再調査
