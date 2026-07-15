# 禾 · 媒体记录助手

通过 AI 对话管理影视和书籍的观影/阅读记录。搜索影视书籍、添加想看/已看、评分、查看列表，一句话搞定。

## 特性

- **零配置**：安装 Skill 即可用，无需配置任何 API 密钥
- **安全**：所有 API 密钥通过代理服务器隐藏，不暴露在客户端
- **零依赖**：仅需 Node.js 18+，无需 npm install
- **多平台**：支持 Claude Code、Cursor、Codex 等 70+ AI 工具
- **影视 + 书籍**：TMDB 电影/剧集搜索 + Open Library 书籍搜索

## 安装

### 通过 skills.sh 安装（推荐）

```bash
npx skills add Lynneu/he-media-tracker -a claude-code
```

将 `claude-code` 替换为你的 AI 工具名称（如 `cursor`、`codex` 等）。

### 手动安装

```bash
git clone https://github.com/Lynneu/he-media-tracker.git
cd he-media-tracker
chmod +x scripts/he.mjs
sudo ln -sf "$(pwd)/scripts/he.mjs" /usr/local/bin/he
```

## 使用

### 注册账号

```bash
he register --email your@email.com --password yourpassword --username 你的名字
```

### 登录

```bash
he login --email your@email.com --password yourpassword
```

### 搜索影视/书籍

```bash
he search "三体"
he search "三体" --type movie
he search "三体" --type tv
he search "三体" --type book
```

### 添加记录

```bash
# 添加到想看
he add --title "三体" --type tv --status wishlist

# 添加到已看并评分
he add --title "三体" --type tv --status watched --rating 5
```

### 查看列表

```bash
he list                        # 所有记录
he list --status wishlist      # 想看列表
he list --status watched       # 已看列表
he list --type movie           # 只看电影
```

### 更新记录

```bash
he update <id> --status watched      # 标记为已看
he update <id> --rating 5            # 评分
he update <id> --review "很好看"     # 写评论
```

### 删除记录

```bash
he delete <id>
```

### 查看登录状态

```bash
he whoami
```

### 退出登录

```bash
he logout
```

## 通过 AI 对话使用

安装 Skill 后，在支持的 AI 工具中直接对话：

- "帮我搜一下《三体》"
- "把《三体》加到想看"
- "我看完了《流浪地球》，打 5 星"
- "我有哪些想看的？"
- "给《三体》打 4 星"

AI 会自动调用 `he` 脚本完成操作。

## 命令一览

| 命令 | 用途 | 需登录 |
|------|------|--------|
| `he register` | 注册新账号 | 否 |
| `he login` | 登录 | 否 |
| `he logout` | 退出登录 | 否 |
| `he whoami` | 查看当前身份 | 否 |
| `he search` | 搜索影视/书籍 | 否 |
| `he add` | 添加记录 | 是 |
| `he list` | 查看列表 | 是 |
| `he update` | 更新记录 | 是 |
| `he delete` | 删除记录 | 是 |

## 架构

```
用户 → AI 对话 → SKILL.md（对话流程指令）
                    ↓ 执行
                 he.mjs（CLI 脚本，零密钥）
                    ↓ 调用
              API 代理服务器（持有所有密钥）
                    ↓ 转发
         ┌── TMDB API（搜索影视）
         ├── Open Library（搜索书籍）
         └── Supabase（注册/登录/数据存储）
```

所有 API 密钥存储在代理服务器端，客户端脚本中不包含任何密钥。用户数据通过 Supabase RLS（行级安全）隔离，每个用户只能访问自己的数据。

## 技术要求

- Node.js 18+（内置 `fetch` API）
- 网络连接（用于调用代理服务器）

## License

MIT
