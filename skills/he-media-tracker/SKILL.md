---
name: he-media-tracker
description: 管理影视和书籍的观影/阅读记录，包括搜索、添加想看/已看、评分、查看列表。使用内嵌的 he 脚本执行操作，零依赖，API 密钥通过代理服务器安全隐藏。当用户提到想看、已看、搜电影、搜剧、搜书、评分、观看记录、阅读记录时触发。
---

# 禾 · 媒体记录助手

通过内嵌的 `he` 脚本帮用户管理影视和书籍记录。所有命令输出 JSON，零 npm 依赖，仅需 Node.js 18+。API 密钥通过代理服务器隐藏，用户无需配置任何密钥。

## 首次设置

脚本位于本 Skill 目录下的 `scripts/he.mjs`。执行以下命令创建全局快捷方式：

```bash
# 1. 先尝试在已安装的 Skill 目录中查找脚本
SCRIPT=$(find . ~/.claude ~/.cursor ~/.agents ~/.codex -path "*/he-media-tracker/scripts/he.mjs" -type f 2>/dev/null | head -1)
# 2. 如果未找到（部分安装器不复制 scripts/ 目录），从 CDN 下载
if [ -z "$SCRIPT" ]; then
  mkdir -p "$HOME/.local/share/he/scripts"
  curl -fsSL https://cdn.jsdelivr.net/gh/Lynneu/he-media-tracker@main/scripts/he.mjs -o "$HOME/.local/share/he/scripts/he.mjs"
  SCRIPT="$HOME/.local/share/he/scripts/he.mjs"
fi
chmod +x "$SCRIPT" && sudo ln -sf "$SCRIPT" /usr/local/bin/he
```

之后所有 `he` 命令可直接使用。如果未创建快捷方式，用 `node "$SCRIPT"` 替代 `he`。

## 认证流程

**用户必须先注册/登录才能使用记录功能。** 搜索不需要登录。

### 新用户注册
用户说"注册" / "我要用这个" / "怎么开始"：
1. 问用户邮箱和用户名
2. 问用户设置密码
3. 执行 `he register --email xxx --password xxx --username xxx`
4. 如果返回 session=true → 告诉用户已自动登录
5. 如果返回 session=false → 告诉用户需要先验证邮箱，然后执行 `he login`

### 已有用户登录
用户说"登录" / "我要登录"：
1. 问用户邮箱和密码
2. 执行 `he login --email xxx --password xxx`
3. 成功后告诉用户可以开始使用了

### 检查登录状态
如果不确定用户是否已登录，执行 `he whoami` 检查。

## 命令参考

| 命令 | 用途 | 需登录 |
|------|------|--------|
| `he register --email --password --username` | 注册新账号 | 否 |
| `he login --email --password` | 登录 | 否 |
| `he logout` | 退出登录 | 否 |
| `he whoami` | 查看当前身份 | 否 |
| `he search "关键词"` | 搜索影视/书籍 | 否 |
| `he add --title --type --status [--rating --cover --external-id --external-source]` | 添加记录 | 是 |
| `he list [--status] [--type]` | 查看列表 | 是 |
| `he update <id> [--status --rating --review]` | 更新记录 | 是 |
| `he delete <id>` | 删除记录 | 是 |

类型：`movie` `tv` `book` | 状态：`watched`（已看）`wishlist`（想看）

## 对话流程

### 1. 添加记录（最常见）

用户说"加 XXX 到想看" / "我看了 XXX" / "帮我加一部电影"：

1. 先执行 `he search "XXX"` 搜索
2. 解析 JSON 结果，如果有多个匹配 → 列出来让用户选：
   ```
   找到以下结果：
   1. 三体 (电视剧, 2023)
   2. 三体 (电影, 2019)
   3. 三体 (书籍)
   请问是哪个？
   ```
3. 用户选定后，确认状态："已看还是想看？"
   - 如果用户一开始就说"想看"或"已看"，跳过此步
4. 如果是"已看" → 问："打几分？（1-5星）"
5. 执行 `he add --title "..." --type "..." --status "..." --rating N --cover "..." --external-id "..." --external-source "..."`
6. 回复："已添加到想看/已看 ✓"

### 2. 搜索

用户说"搜一下 XXX" / "帮我找 XXX"：

1. 执行 `he search "XXX"`
2. 格式化展示结果（标题 + 类型 + 年份 + 简介）
3. 问："要加入记录吗？"

### 3. 查看列表

用户说"我有哪些想看" / "看了什么"：

1. 执行 `he list --status wishlist`（或 watched）
2. 格式化为列表展示
3. 可以追问："要把哪个标记为已看？"

### 4. 标记已看

用户说"XXX 看完了"：

1. 执行 `he list --status wishlist` 看是否在想看列表
2. 在列表中 → `he update <id> --status watched`
3. 不在列表中 → 先 `he search "XXX"` 确认 → `he add` 添加为 watched
4. 问："打几分？"
5. 用户回答后 → `he update <id> --rating N`

### 5. 评分

用户说"给 XXX 打 4 星"：

1. 执行 `he list` 找到对应记录 ID
2. 执行 `he update <id> --rating 4`

## 注意事项

- 执行记录操作前先 `he whoami` 确认已登录，未登录则引导用户先 login
- 不要一次性问太多信息，一步步引导
- 搜索结果展示要简洁，不要显示完整 JSON
- 如果 CLI 返回 error，用自然语言告诉用户发生了什么
- cover_url、external_id、external_source 从搜索结果中获取并传给 add 命令
