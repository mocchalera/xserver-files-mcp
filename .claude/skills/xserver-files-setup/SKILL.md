---
name: xserver-files-setup
description: XServer Files MCP/CLI の初期セットアップを対話的に実行する。リポジトリのクローン後、設定ファイル作成・SSH 鍵生成・接続確認・MCP 登録までをガイドする。
---

# XServer Files セットアップスキル

## いつ使うか

- このリポジトリをクローンした直後
- 新しい XServer サーバーを追加するとき
- セットアップが壊れて最初からやり直すとき
- ユーザーが「セットアップして」「設定して」「使えるようにして」と言ったとき

## 前提確認

セットアップを始める前に以下を確認する。満たさない場合はユーザーに伝えて中断する。

```bash
node --version   # v20 以上が必要
```

## 手順

以下の Phase を上から順に実行する。各 Phase の冒頭にエージェントの行動指示がある。

---

### Phase 1: インストール

**行動:** 自動実行。ユーザーへの質問なし。

```bash
npm install
```

成功したら動作確認を実行:

```bash
XSERVER_FILES_CONFIG=config/example.config.json node src/cli.js servers
```

JSON が出力されれば Phase 2 へ進む。

---

### Phase 2: ユーザー情報の収集

**行動:** ユーザーに以下の情報を質問する。一度にまとめて聞くこと。

> 設定ファイルを作成するために、XServer の情報を教えてください。XServer サーバーパネル（https://secure.xserver.ne.jp/xapanel/login/xserver/server/ ）で確認できます。
>
> 1. **サーバー ID** — サーバーパネル上部に表示されています（例: `sv12345`）
> 2. **操作対象のドメイン** — ドメイン設定のドメイン一覧に表示されています（例: `example.com`）
> 3. **ドキュメントルート** — ドメイン一覧の「ドキュメントルート」列（例: `/home/sv12345/example.com/public_html`）。不明な場合は省略可（`/home/<サーバーID>/<ドメイン>/public_html` をデフォルトとして使用します）
> 4. **ローカルワークスペースのパス** — サイトファイルの pull 先ディレクトリ（例: `~/Dev/xserver-sites`）。特に希望がなければデフォルトのままにします

複数ドメインがある場合はすべて聞く。複数サーバーがある場合はサーバーごとに聞く。

---

### Phase 3: 設定ファイルの作成

**行動:** Phase 2 の回答をもとに自動生成する。ユーザーへの質問なし。

```bash
mkdir -p ~/.config/xserver-files-mcp
```

`~/.config/xserver-files-mcp/config.json` を以下の形式で作成:

```json
{
  "defaultServer": "<サーバーID>",
  "localWorkspaceRoot": "<ワークスペースパス or ~/Dev/xserver-sites>",
  "servers": {
    "<サーバーID>": {
      "host": "<サーバーID>.xsrv.jp",
      "port": 10022,
      "username": "<サーバーID>",
      "privateKeyPath": "~/.ssh/xserver_<サーバーID>",
      "roots": {
        "<ドメイン>": "<ドキュメントルート or /home/<サーバーID>/<ドメイン>/public_html>"
      }
    }
  }
}
```

作成後、設定が正しく読めるか確認:

```bash
node src/cli.js servers
```

エラーが出た場合は設定ファイルの JSON 構文を見直して修正する。

---

### Phase 4: SSH 鍵の生成

**行動:** 既存の鍵があるか確認してから実行する。

```bash
ls ~/.ssh/xserver_<サーバーID> 2>/dev/null
```

鍵が既に存在する場合はユーザーに確認してから次のステップに進む:

> `~/.ssh/xserver_<サーバーID>` に SSH 鍵が既にあります。この鍵を使いますか？新しく作り直しますか？

鍵がない場合、または作り直す場合:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/xserver_<サーバーID> -C xserver-<サーバーID> -N ""
```

パスフレーズを設定したい場合は `-N ""` を外してユーザーに入力してもらう。パスフレーズを設定した場合は、設定ファイルに `"passphraseEnv": "XSERVER_<サーバーID大文字>_KEY_PASSPHRASE"` を追加し、環境変数の設定方法をユーザーに案内する。

公開鍵の内容を表示:

```bash
cat ~/.ssh/xserver_<サーバーID>.pub
```

---

### Phase 5: XServer サーバーパネルで公開鍵を登録（ユーザー操作）

**行動:** 以下のメッセージをユーザーに提示して、完了報告を待つ。エージェントはこの操作を代行できない。

> **この操作は XServer のサーバーパネルで手動で行う必要があります。**
>
> 1. XServer サーバーパネル（https://secure.xserver.ne.jp/xapanel/login/xserver/server/ ）にログイン
> 2. **「SSH設定」** を開く
> 3. **「ONにする」** をクリック（既に ON の場合はスキップ）
> 4. **「公開鍵登録・更新」** タブを開く
> 5. 以下の公開鍵を全文コピーして貼り付け:
>
> ```
> （Phase 4 で表示した公開鍵の内容をここに貼る）
> ```
>
> 6. **「確認画面へ進む」** → **「登録する」** をクリック
>
> 完了したら教えてください。

ユーザーが「完了」と報告したら Phase 6 へ。

---

### Phase 6: 接続テスト

**行動:** 自動実行。

```bash
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -p 10022 -i ~/.ssh/xserver_<サーバーID> <サーバーID>@<サーバーID>.xsrv.jp 'pwd'
```

成功（`/home/<サーバーID>` 等が出力される）なら Phase 7 へ。

失敗した場合の対処:

| エラー | 原因 | 対処 |
|---|---|---|
| `Connection refused` | SSH が OFF、またはポート番号が違う | ユーザーに XServer パネルで SSH 設定が ON か確認してもらう |
| `Permission denied` | 公開鍵が未登録、または鍵ペアが不一致 | Phase 5 をやり直す。鍵を再生成する場合は Phase 4 から |
| `Connection timed out` | ホスト名が間違っている | サーバー ID を再確認 |

3 回試行して解決しない場合は、現在の状態をまとめてユーザーに報告し、手動での確認を依頼する。

---

### Phase 7: doctor で最終確認

**行動:** 自動実行。

```bash
node src/cli.js doctor
```

全項目が `[PASS]` ならセットアップ完了。ユーザーに以下を報告:

> セットアップが完了しました。以下のコマンドですぐに使えます:
>
> ```bash
> node src/cli.js ls <ドメイン> .          # リモートファイル一覧
> node src/cli.js read <ドメイン> .htaccess # ファイル読み取り
> node src/cli.js --help                    # 全コマンド一覧
> ```

`[FAIL]` がある場合は以下の対応表に従う:

| 出力 | 対処 |
|---|---|
| `[FAIL] Config loaded` | Phase 3 に戻り設定ファイルを修正 |
| `[FAIL] SSH key exists` | Phase 4 に戻り鍵を確認・再生成 |
| `[FAIL] SFTP connection` | Phase 5〜6 に戻り公開鍵登録と接続テストをやり直す |

---

## サーバー追加

既にセットアップ済みの環境に新しいサーバーを追加する場合は、Phase 2 から繰り返す。設定ファイルの `servers` に新しいエントリを追加し、Phase 4〜7 を新サーバー分だけ実行する。既存サーバーの設定には触れないこと。

## やってはいけないこと

- ユーザーの既存の `~/.config/xserver-files-mcp/config.json` を確認なしに上書きしない。既存ファイルがある場合は内容を読んで、追加・修正の差分だけを提案する。
- 秘密鍵（`~/.ssh/xserver_*`）の内容を表示・コピー・送信しない。公開鍵（`.pub`）のみ扱う。
- XServer サーバーパネルへのログインをエージェントが試みない。Phase 5 は必ずユーザーに委ねる。
- パスフレーズをファイルに書き込まない。環境変数経由でのみ扱う。
