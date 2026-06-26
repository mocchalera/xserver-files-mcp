# xserver-files-mcp

XServer のファイル操作を SFTP 経由で安全に行うローカル stdio MCP サーバー & CLI。

**前提条件:** Node.js 20+、SSH アクセスが有効な XServer アカウント。

## セットアップガイド

以下の手順を上から順に進めてください。AI エージェント（Claude Code、Codex など）に依頼する場合も、この手順に沿って自動実行されます。`[要ユーザー操作]` のマークがあるステップのみ人間の操作が必要です。

### Step 1: インストール

```bash
git clone https://github.com/mocchalera/xserver-files-mcp.git
cd xserver-files-mcp
npm install
```

動作確認（サーバー接続不要）:

```bash
XSERVER_FILES_CONFIG=config/example.config.json node src/cli.js servers
```

### Step 2: XServer の情報を確認 `[要ユーザー操作]`

設定ファイルを作成するために、以下の情報が必要です。XServer サーバーパネル（https://secure.xserver.ne.jp/xapanel/login/xserver/server/）にログインして確認してください。

| 必要な情報 | 確認場所 | 例 |
|---|---|---|
| サーバー ID | サーバーパネル上部に表示 | `sv12345` |
| ホスト名 | サーバー情報 → ホスト名 | `sv12345.xsrv.jp` |
| 操作対象のドメイン | ドメイン設定 → ドメイン一覧 | `example.com` |
| ドキュメントルート | ドメイン設定 → ドメイン一覧の「ドキュメントルート」列 | `/home/sv12345/example.com/public_html` |

> **ヒント:** XServer のドキュメントルートは通常 `/home/<サーバーID>/<ドメイン>/public_html` の形式です。

### Step 3: 設定ファイルの作成

```bash
mkdir -p ~/.config/xserver-files-mcp
cp config/example.config.json ~/.config/xserver-files-mcp/config.json
```

`~/.config/xserver-files-mcp/config.json` を Step 2 で確認した情報に書き換えます:

```json
{
  "defaultServer": "<サーバーID>",
  "localWorkspaceRoot": "~/Dev/xserver-sites",
  "servers": {
    "<サーバーID>": {
      "host": "<サーバーID>.xsrv.jp",
      "port": 10022,
      "username": "<サーバーID>",
      "privateKeyPath": "~/.ssh/xserver_<サーバーID>",
      "roots": {
        "<ドメイン>": "/home/<サーバーID>/<ドメイン>/public_html"
      }
    }
  }
}
```

`localWorkspaceRoot` はサイトファイルの pull 先です。このリポジトリの外であれば任意のパスで構いません。

### Step 4: SSH 鍵の作成

```bash
ssh-keygen -t ed25519 -f ~/.ssh/xserver_<サーバーID> -C xserver-<サーバーID>
```

パスフレーズを設定した場合は、設定ファイルの `passphraseEnv` にパスフレーズを格納する環境変数名を指定し、その環境変数にパスフレーズを設定してください。

### Step 5: SSH 公開鍵を XServer に登録 `[要ユーザー操作]`

**この操作は XServer サーバーパネルで手動で行う必要があります。**

1. 公開鍵の内容を確認:
   ```bash
   cat ~/.ssh/xserver_<サーバーID>.pub
   ```
2. XServer サーバーパネルにログイン
3. **「SSH設定」** を開く
4. SSH 設定が **「ON」** になっていることを確認（OFF なら ON に変更）
5. **「公開鍵登録・更新」** タブを開く
6. 上記の公開鍵の内容を全文貼り付けて **「確認画面へ進む」** → **「登録する」**

### Step 6: 接続テスト

```bash
ssh -p 10022 -i ~/.ssh/xserver_<サーバーID> <サーバーID>@<サーバーID>.xsrv.jp 'pwd'
```

### Step 7: doctor で最終確認

```bash
node src/cli.js doctor
```

すべて `[PASS]` になればセットアップ完了です。

#### トラブルシューティング

| doctor の出力 | 原因 | 対処 |
|---|---|---|
| `[FAIL] Config loaded` | 設定ファイルが見つからないか JSON が不正 | `~/.config/xserver-files-mcp/config.json` の存在と JSON 構文を確認 |
| `[FAIL] SSH key exists` | 秘密鍵ファイルが見つからない | Step 4 の鍵作成を確認。パスが設定ファイルの `privateKeyPath` と一致しているか確認 |
| `[FAIL] SFTP connection` | SSH 接続に失敗 | Step 5 の公開鍵登録を確認。`ssh -p 10022 ...` で手動テスト |

## MCP 登録

Claude Code でこのリポジトリを開くと `.mcp.json` により自動登録されます。

他の MCP クライアント（Claude Desktop、VS Code など）では、設定に以下を追加:

```json
{
  "mcpServers": {
    "xserver-files": {
      "command": "node",
      "args": ["/絶対パス/xserver-files-mcp/src/server.js"],
      "env": {
        "XSERVER_FILES_CONFIG": "/ホームディレクトリ/.config/xserver-files-mcp/config.json"
      }
    }
  }
}
```

パスは自分のマシンの絶対パスに置き換えてください。

## CLI の使い方

```bash
node src/cli.js <command> [options]
```

### 診断

| コマンド | 説明 |
|---|---|
| `doctor` | 設定ファイル、SSH 鍵、SFTP 接続をチェック |
| `servers` | 設定済みサーバー一覧を表示（接続不要） |
| `roots` | 設定済みドメインルート一覧を表示 |
| `--version` | バージョンを表示 |

### ファイル操作

| コマンド | 説明 |
|---|---|
| `ls <domain> [path]` | リモートファイル一覧 |
| `read <domain> <path>` | リモートの UTF-8 テキストファイルを読み取り |
| `write <domain> <path> --from <file>` | リモートにファイルを書き込み（既存ファイルは自動バックアップ） |
| `replace <domain> <path> --find <text> --replace <text>` | テキストの完全一致置換（自動バックアップ） |
| `backup <domain> <path>` | タイムスタンプ付きリモートバックアップを作成 |
| `backups <domain> <path>` | ファイルのリモートバックアップ一覧 |
| `cleanup-backups <domain> <path> [--keep N]` | 古いバックアップを削除し、最新 N 件を保持（デフォルト 5） |

### ワークスペース操作

| コマンド | 説明 |
|---|---|
| `workspace <domain>` | ドメイン用のローカルワークスペースを作成 |
| `pull <domain> <path>` | リモートファイルをローカルワークスペースに取得 |
| `push <domain> <path>` | ローカルワークスペースのファイルをサーバーに送信（自動バックアップ） |

pull/push は `wp-config.php`、uploads、logs、backups、データベースダンプ、アーカイブをデフォルトで拒否します。`--allow-sensitive` はリスクを確認してから使用してください。

### リダイレクト

```bash
node src/cli.js redirect old-site.example.com https://new-site.example.com --dry-run
node src/cli.js redirect old-site.example.com https://new-site.example.com
```

`.htaccess` にマーク付き 301 リダイレクトブロックを挿入・更新します:

```apache
# BEGIN xserver-files-mcp redirect old-site.example.com
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTP_HOST} ^(www\.)?old-site\.example\.com$ [NC]
RewriteRule ^(.*)$ https://new-site.example.com/$1 [R=301,L]
</IfModule>
# END xserver-files-mcp redirect old-site.example.com
```

### 共通オプション

すべての書き込みコマンドは `--dry-run` で変更をプレビューできます。`--no-backup` で自動バックアップをスキップ。`--server <id>` でデフォルト以外のサーバーを指定。

### MCP ツール一覧

| ツール | 説明 |
|---|---|
| `list_servers` | 設定済みサーバー一覧 |
| `list_roots` | プロファイルのドメインルート一覧 |
| `init_site_workspace` | ドメイン用のローカルワークスペースを作成 |
| `list_files` | リモートファイル一覧 |
| `read_file` | UTF-8 テキストファイルを読み取り |
| `pull_file_to_workspace` | リモートファイルをローカルワークスペースに取得 |
| `push_file_from_workspace` | ローカルワークスペースのファイルをリモートに送信 |
| `backup_file` | リモートファイルのタイムスタンプ付きバックアップを作成 |
| `write_file` | UTF-8 ファイルを書き込み（既存ファイルは自動バックアップ） |
| `replace_in_file` | テキストの完全一致置換（自動バックアップ） |
| `set_domain_redirect` | `.htaccess` にマーク付き 301 リダイレクトブロックを挿入・更新 |

## 複数サーバー

設定ファイルの `servers` にエントリを追加。MCP では `server_id`、CLI では `--server` で指定:

```bash
node src/cli.js --server sv67890 roots
```

省略時は `defaultServer` が使われます。

## 安全性について

- すべてのパスは設定済みの `roots[domain]` 配下で解決されます。絶対パスと `..` によるトラバーサルは拒否されます。
- 書き込み操作は既存ファイルをデフォルトで自動バックアップします。
- pull/push はリスクの高いパスをデフォルトで除外します: `wp-config.php`、uploads、logs、backups、SQL ダンプ、アーカイブ。
- `replaceInFile` と `set_domain_redirect` は読み取り・変換・書き込みを別々の SFTP 操作で行います。他のプロセスが同時に同じファイルを編集すると上書きされる可能性があります。
- 書き込み前に必ず `--dry-run` で変更をプレビューしてください。
- 秘密鍵はこのプロジェクトディレクトリの外に保管してください。

## エージェント向け情報

- リポジトリ運用ルール: `AGENTS.md`
- SFTP ファイル操作スキル: `.skills/xserver-files-operator/SKILL.md`
- XServer パネル API スキル: `.skills/xserver-mcp-operator/SKILL.md`
