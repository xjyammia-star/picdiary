# 绘忆 PicDiary

AI日记日历 · AI Diary Calendar

## 技术栈

- **前端**: React + TypeScript + Vite
- **部署**: Vercel
- **数据库**: Neon PostgreSQL（存用户/元数据）
- **图片存储**: Cloudinary（存图片文件）
- **文字生图**: Google Vertex AI · Imagen 4 Standard
- **照片风格化**: Gemini 2.5 Flash Image (Nano Banana)
- **日记生成**: 豆包 Seed 2.0 Lite

---

## 本地开发

```bash
npm install
cp .env.example .env.local
# 填写 .env.local 中的所有环境变量
npm run dev
```

---

## 环境变量说明

### Neon 数据库
```
DATABASE_URL=postgresql://...
```
在 https://neon.tech 创建项目后获取连接字符串。

**首次部署后需要初始化数据库表**，访问 `/api/init-db` 一次即可（之后可删除该路由）。

### JWT
```
JWT_SECRET=随机长字符串（建议32位以上）
```

### Cloudinary
```
CLOUDINARY_CLOUD_NAME=你的cloud_name
CLOUDINARY_API_KEY=你的api_key
CLOUDINARY_API_SECRET=你的api_secret
```
在 https://cloudinary.com 注册后在 Dashboard 获取。

### Google Vertex AI（Imagen 4 + Gemini）
```
GOOGLE_PROJECT_ID=你的GCP项目ID
GOOGLE_LOCATION=us-central1
GOOGLE_SERVICE_ACCOUNT_KEY=base64编码的服务账号JSON
```

服务账号需要 `Vertex AI User` 角色。
将 JSON key 文件 base64 编码：
```bash
base64 -i your-service-account.json | tr -d '\n'
```

### 豆包
```
DOUBAO_API_KEY=你的豆包API Key
DOUBAO_MODEL=doubao-seed-2-0-lite-32k
```

---

## Vercel 部署

1. 将项目 push 到 GitHub（用户名 xjyammia-star）
2. 在 Vercel 导入仓库
3. 在 Vercel 项目设置中添加所有环境变量
4. 部署完成后访问 `/api/init-db` 初始化数据库

---

## 数据库表结构

```sql
users            -- 用户账号（邮箱+密码hash）
diary_entries    -- 每条图片记录（输入、风格、Cloudinary URL）
diary_notes      -- AI生成的日记（每天一篇）
```

---

## 成本估算

| 操作 | 模型 | 费用 |
|------|------|------|
| 文字生图 | Imagen 4 Standard | $0.04/张 |
| 照片风格化 | Gemini 2.5 Flash Image | $0.039/张 |
| 日记生成 | 豆包 Seed 2.0 Lite | 极低 |

$300 GCP赠金 ≈ 可生成约 7,500 张图片。
