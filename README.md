# xserver-files-mcp

XServer のファイル操作を SFTP 経由で安全に行うローカル stdio MCP サーバー & CLI。

**前提条件:** Node.js 20+、SSH アクセスが有効な XServer アカウント、XServer サーバーパネルに登録済みの ed25519 SSH 鍵。

## クイックスタート

```bash
git clone https://github.com/mocchalera/xserver-files-mcp.git
cd xserver-files-mcp
npm install
```

サーバー接続なしで動作確認:

```bash
XSERVER_FILES_CONFIG=config/example.config.json node src/cli.js servers
```

実際の設定ファイルに対して SSH 鍵と SFTP 接続を診断:

```bash
node src/cli.js doctor
```

## 設定

サンプル設定をコピーして、自分の XServer アカウント情報に編集:

```bash
mkdir -p ~/.config/xserver-files-mcp
cp config/example.config.json ~/.config/xserver-files-mcp/config.json
```

### 設定リファレンス

| フィールド | 例 | 説明 |
|---|---|---|
| `defaultServer` | `"sv12345"` | `--server` 省略時に使う `servers` 内のキー |
| `localWorkspaceRoot` | `"~/Dev/xserver-sites"` | pull したサイトファイルの保存先（このリポジトリの外） |
| `servers.<id>.host` | `"sv12345.xsrv.jp"` | XServer ホスト名（`<サーバーID>.xsrv.jp`） |
| `servers.<id>.port` | `10022` | SSH ポート（XServer は常に `10022`） |
| `servers.<id>.username` | `"sv12345"` | SSH ユーザー名（サーバー ID と同じ） |
| `servers.<id>.privateKeyPath` | `"~/.ssh/xserver_sv12345"` | ed25519 秘密鍵のパス |
| `servers.<id>.passphraseEnv` | `"XSERVER_SV12345_KEY_PASSPHRASE"` | 鍵のパスフレーズを格納する環境変数名（任意） |
| `servers.<id>.roots.<domain>` | `"/home/sv12345/example.com/public_html"` | ドメインごとのリモートドキュメントルート（絶対パス） |

### SSH 鍵のセットアップ

```bash
ssh-keygen -t ed25519 -f ~/.ssh/xserver_sv12345 -C xserver-sv12345
```

XServer サーバーパネルで公開鍵を登録してからテスト:

```bash
ssh -p 10022 -i ~/.ssh/xserver_sv12345 sv12345@sv12345.xsrv.jp 'pwd'
```

### ワークスペースの構成

ローカルのサイトワークスペースはこのリポジトリの外に配置します:

```text
~/Dev/xserver-sites/
  sv12345/
    example.com/
    blog.example.com/
  sv67890/
    shop.example.com/
```

このリポジトリは MCP/CLI のソースコード専用です。

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

## MCP 登録

MCP クライアント（Claude Desktop、VS Code など）の設定に追加:

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
