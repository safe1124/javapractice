# 📚 勉強時間記録Bot

Discord上で勉強時間を自動記録・管理するBotです。音声チャンネルでの自動追跡とスラッシュコマンドによる手動記録に対応しています。

## ✨ 主な機能

- 🎙️ **音声チャンネル自動追跡**: study系チャンネルに入退室すると自動で勉強時間を記録
- 📊 **統計・ランキング**: 個人統計、全体ランキング、ティアシステム
- ✅ **ToDoリスト管理**: タスクの追加・完了・削除
- 🏆 **月間ティアシステム**: 勉強時間に応じた9段階のティア（ノービス～チャレンジャー）
- 📱 **入退室通知**: 専用チャンネルでメンバーの入退室を可視化

## 🚀 クイックスタート

### 1. 必要な環境

- Node.js v16以上
- npm または yarn
- Discord Bot Token
- Supabase アカウント（データベース用）

### 2. インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd discord

# 依存関係をインストール
npm install
```

### 3. Supabase データベースのセットアップ

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. SQL Editorで以下のテーブルを作成：

```sql
-- study_records テーブル
CREATE TABLE study_records (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  date TEXT NOT NULL,
  week TEXT NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- todos テーブル
CREATE TABLE todos (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_study_records_user_id ON study_records(user_id);
CREATE INDEX idx_study_records_month ON study_records(month);
CREATE INDEX idx_todos_user_id ON todos(user_id);
```

3. Project Settings → API から以下を取得：
   - `Project URL`
   - `anon public` key
   - `service_role` key

### 4. 設定ファイルの準備

`.env`ファイルを作成：

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```env
# Discord Bot Token
DISCORD_TOKEN=あなたのDiscordボットトークン

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Server Configuration (Optional)
PORT=3000

# Chatbot API (Optional)
CHATBOT_API_URL=https://mellifluous-sopapillas-516e40.netlify.app
```

### 5. Discord Developer Portalでの設定

[Discord Developer Portal](https://discord.com/developers/applications)にアクセスし、以下を設定：

1. **Bot作成**
   - New Application → Bot → Add Bot

2. **Intents有効化**（必須）
   - Bot → Privileged Gateway Intents
   - ✅ **Server Members Intent** （オプション：ウェルカムメッセージ用）
   - ✅ **Voice States Intent** （必須：音声チャンネル追跡用）

3. **Botトークン取得**
   - Bot → Token → Copy

4. **Bot招待**
   - OAuth2 → URL Generator
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: 
     - Send Messages
     - Embed Links
     - Read Message History
     - View Channels
     - Connect (Voice)

### 6. Botの起動

#### ローカル環境

```bash
node index.js
```

起動成功すると以下のメッセージが表示されます：

```
☁️ Supabaseデータベースを使用します
ログイン完了：YourBot#1234
✅ 13個のスラッシュコマンドをGuildに登録しました
🎯 봇이 명령어를 받을 준비가 되었습니다!
```

#### Render でのデプロイ

1. [Render](https://render.com)でアカウント作成
2. 「New +」→「Web Service」を選択
3. GitHubリポジトリを接続
4. 以下の設定を入力：
   - **Name**: `discord-study-bot`（任意）
   - **Region**: `Singapore`（推奨）
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. 環境変数を追加：
   - `DISCORD_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
6. 「Create Web Service」をクリック

**注意**: Renderの無料プランは15分間アクティビティがないとスリープします。
[UptimeRobot](https://uptimerobot.com)などで定期的にpingすることで24時間稼働できます。

## 📖 使い方

詳細な使用方法は [使い方.md](./使い方.md) を参照してください。

### 基本的なコマンド

| コマンド | 説明 |
|---------|------|
| `/startstudy` | 勉強を開始 |
| `/pausestudy` | 勉強を一時停止 |
| `/stopstudy` | 勉強を終了して記録 |
| `/stats` | 個人統計を表示 |
| `/rank` | 月間ランキングを表示 |
| `/globalstats` | 全体統計を表示 |
| `/todoadd` | ToDoを追加 |
| `/todolist` | ToDo一覧を表示 |
| `/todocomplete` | ToDoを完了 |
| `/tododelete` | ToDoを削除 |
| `/task @ユーザー` | 他ユーザーのToDoを表示 |

### 音声チャンネル自動追跡

1. サーバーに「study」を含む名前の音声チャンネルを作成
   - 例：`StudyRoom1`, `studyroom`, `Study Hall`

2. `#入退室管理` という名前のテキストチャンネルを作成

3. study系チャンネルに入退室すると自動で記録されます

## 🏗️ プロジェクト構成

```
discord/
├── index.js              # メインBotファイル
├── package.json          # 依存関係定義
├── render.yaml           # Render デプロイ設定
├── .env                  # 環境変数（要作成、gitignore対象）
├── .env.example          # .envのテンプレート
├── config.json           # 設定ファイル（gitignore対象）
├── supabase_tables.sql   # Supabase テーブル作成SQL
├── .gitignore            # Git除外設定
├── 使い方.md             # 詳細な使用説明書
└── README.md             # このファイル
```

## 🎯 ティアシステム

月間勉強時間に応じて9段階のティアが付与されます：

| ティア | 必要時間 | 絵文字 |
|--------|----------|--------|
| チャレンジャー | 70時間以上 | 🔥 |
| グランドマスター | 60時間以上 | 👑 |
| マスター | 50時間以上 | ⭐ |
| ダイヤモンド | 40時間以上 | 💎 |
| プラチナ | 30時間以上 | 🤍 |
| ゴールド | 20時間以上 | 🏆 |
| シルバー | 10時間以上 | 🥈 |
| ブロンズ | 5時間以上 | 🥉 |
| ノービス | 5時間未満 | 🌱 |

## 🔧 トラブルシューティング

### Botが応答しない

```bash
# Botのプロセスを確認
ps aux | grep "node index.js"

# Botを再起動
pkill -f "node index.js"
node index.js
```

### 音声チャンネル追跡が動作しない

1. Discord Developer Portalで **Voice States Intent** が有効か確認
2. 音声チャンネル名に「study」が含まれているか確認
3. `#入退室管理` チャンネルが存在するか確認
4. Botに適切な権限があるか確認

### コマンドが表示されない

1. Botを再起動してコマンドキャッシュをクリア
2. Discordクライアントを再起動
3. スラッシュコマンド入力時に候補が表示されるまで待つ

## 📊 データベース

Supabase (PostgreSQL) を使用して以下のデータを保存：

- **study_records**: 勉強記録（ユーザーID、開始/終了時刻、勉強時間、日付/週/月）
- **todos**: ToDoリスト（ユーザーID、タスク内容、完了状態、作成日時）

クラウドデータベースのため、複数のサーバーやデプロイ環境で同じデータを共有できます。

## 🎨 カスタマイズ

### タイムゾーン変更

`index.js` の14行目：

```javascript
const TIMEZONE = 'Asia/Seoul'; // お好みのタイムゾーンに変更
```

### 対象チャンネル名変更

`index.js` の190-191行目：

```javascript
const STUDY_ROOM_NAME = 'studyroom'; // 任意の名前
const MANAGEMENT_CHANNEL_NAME = '入退室管理'; // 任意の名前
```

### ティア条件変更

`index.js` の19-32行目の `getTierByMinutes` 関数を編集

## 🔒 セキュリティ

⚠️ **重要**: 以下のファイルは絶対にGitHubにプッシュしないでください：

- `.env` - 環境変数（Botトークン、Supabase APIキーなど含む）
- `config.json` - 設定ファイル（Botトークン含む）
- `*.db` - データベースファイル
- `*.log` - ログファイル

これらは`.gitignore`で除外されています。

### 環境変数の管理

**必ず `.env.example` をコピーして `.env` ファイルを作成してください：**

```bash
cp .env.example .env
```

その後、以下の値を実際の値に置き換えてください：

1. **DISCORD_TOKEN**: [Discord Developer Portal](https://discord.com/developers/applications) から取得
2. **SUPABASE_URL**: Supabase プロジェクト設定から取得
3. **SUPABASE_SERVICE_KEY**: Supabase プロジェクト設定（API → Service Role）から取得

### 👮 ベストプラクティス

- ✅ 本番環境では必ず環境変数を使用
- ✅ Supabaseは**Service Role Key**を使用（サーバー側処理用）
- ✅ **絶対に** APIキーをコード内にハードコーディングしない
- ✅ Gitにコミットする前に必ず `.env` がコミット対象外か確認
- ✅ もしAPIキーをプッシュしてしまった場合は、すぐにSupabaseで新しいキーを再生成

## 📝 ライセンス

MIT License

## 🙏 謝辞

このBotを使用してくださりありがとうございます！
勉強を頑張ってください！💪📚

---

**バージョン**: 3.0.0 (Supabase対応)  
**最終更新**: 2025年10月
