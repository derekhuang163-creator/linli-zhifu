# 邻里智服（Linli Zhifu）

AI 驱动的社区可信上门服务平台。

## MVP 0.2

当前已经具备：

- 微信小程序用户端
- 自然语言需求输入
- AI 需求结构化解析接口
- L1-L4 风险初筛
- 高风险关键词规则拦截
- 服务者推荐演示
- 演示订单生成

### 后端启动

进入 `server/`：

`npm install`

复制 `.env.example` 为 `.env`，配置：

`OPENAI_API_KEY=你的API Key`

然后：

`npm run dev`

没有 API Key 时，系统自动进入本地演示解析模式。

### 小程序接后端

修改 `miniapp/config.js`：

`const API_BASE_URL = "https://你的服务器域名";`

正式微信小程序需要配置 HTTPS request 合法域名。

## 产品路线

下一步进入真正业务闭环：用户登录、服务者注册/审核、数据库、订单状态机、接单、履约、支付、售后、信用分和物业端。
