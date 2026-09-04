# 接入真实 Google 登录

本地开发默认用邮箱魔法链接，链接只进本地邮件捕获器，所以每次都要去取。
接上 Google 之后是一次点击，不碰邮箱，而且和生产用的是同一条代码路径。

需要你自己去 Google 控制台申请凭据——我不能代你注册账号或填写凭据。
申请完只需要把两个值粘进 `.env.local`。

## 1. 在 Google Cloud 建 OAuth 客户端

1. 打开 <https://console.cloud.google.com/apis/credentials>
2. 选一个项目（没有就新建一个）
3. 如果是第一次，先配置 **OAuth 同意屏幕**：
   - User Type 选 **External**
   - 填应用名称、支持邮箱、开发者邮箱即可
   - 发布状态保持 **Testing**，并把你自己的 Google 邮箱加进 **Test users**
4. **Create Credentials → OAuth client ID**
   - Application type：**Web application**
   - **Authorized redirect URIs** 填入这一条，必须一字不差：

     ```
     http://127.0.0.1:54321/auth/v1/callback
     ```

     这是 **Supabase 的**回调地址，不是应用的。应用自己的
     `http://127.0.0.1:3000/auth/callback` 已经在
     `supabase/config.toml` 的 `auth.additional_redirect_urls` 里了。
5. 创建后拿到 **Client ID** 和 **Client secret**

## 2. 写进本地环境

在 `.env.local` 里填上（这个文件已被 gitignore，不会进版本库）：

```dotenv
GOOGLE_CLIENT_ID=<你的 client id>
GOOGLE_SECRET=<你的 client secret>
```

## 3. 打开开关并重启

把 `supabase/config.toml` 里 `[auth.external.google]` 的 `enabled` 改成 `true`：

```toml
[auth.external.google]
enabled = true
```

然后**必须重启容器**——`config.toml` 只在容器启动时读取，`supabase db reset`
不会重新加载：

```bash
supabase stop && supabase start
```

## 4. 验证

```bash
pnpm dev:web
```

打开 <http://127.0.0.1:3000>，点「使用 Google 登录」，走完 Google 授权后应当
直接落到 `/w/<工作区 id>/library`。首次登录会自动创建个人空间「我的空间」。

确认 provider 已生效：

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  'http://127.0.0.1:54321/auth/v1/authorize?provider=google'
```

- `302` → 已启用，会跳转到 Google
- `400 provider is not enabled` → 开关没打开，或者容器没重启

## 常见问题

**`redirect_uri_mismatch`**
Google 里填的回调地址和实际不一致。必须是
`http://127.0.0.1:54321/auth/v1/callback`，注意是 `127.0.0.1` 不是 `localhost`，
端口是 Supabase 的 `54321` 不是应用的 `3000`。

**授权回来后又被弹回登录页**
浏览器地址栏用的是 `localhost` 而不是 `127.0.0.1`。两者在浏览器看来是不同主机，
Cookie 不互通。始终用 `127.0.0.1:3000`。

**`Error 403: access_denied`**
同意屏幕还在 Testing 状态，而当前 Google 账号不在 Test users 列表里。

## 生产环境

同样的配置，区别只是：

- 回调地址换成 `https://<你的 supabase 域名>/auth/v1/callback`
- `GOOGLE_CLIENT_ID` / `GOOGLE_SECRET` 放在部署环境的密钥管理里，不进版本库
- 同意屏幕需要发布，并按 Google 要求完成验证

应用代码不需要任何改动：provider 名称和 redirect 契约已由
`apps/web/src/features/auth/service.ts` 的单元测试锁定。
