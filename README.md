# Firefly III MCP Server (`firefly-iii-mcp`)

适用于 [Firefly III](https://www.firefly-iii.org/) 个人财务管理系统的标准 **Model Context Protocol (MCP)** 服务端（TypeScript / Node.js）。支持在 Claude Desktop、Cursor、Antigravity、Windsurf 等任意兼容 MCP 的客户端中通过自然语言查账、管账户、记账与搜索流水。

## 功能特性（Tools）

### 系统与财务概览
| Tool | 说明 |
| :--- | :--- |
| `get_system_info` | 检查与 Firefly III 实例的连通性，返回系统版本、API 版本及当前登录用户信息 |
| `get_financial_summary` | 获取指定日期范围内的财务概览（净资产、收支汇总、待付账单、可支配余额等） |

### 账户管理（Accounts）
| Tool | 说明 |
| :--- | :--- |
| `list_accounts` | 查询账户列表及余额（支持按 `asset` / `expense` / `revenue` / `liability` / `cash` 过滤及指定历史日期余额） |
| `get_account` | 根据账户 ID 获取单个账户详情与余额 |
| `search_accounts` | 按名称、卡号/账号、IBAN 或 ID 搜索账户 |
| `create_account` | 创建新账户（自动为资产账户补充默认 `defaultAsset` 角色，并对负债/信用卡必填项做前置校验） |
| `update_account` | 更新账户信息（支持部分字段更新，未传 `name` 时自动保留原账户名） |
| `delete_account` | 根据 ID 删除账户 |
| `list_account_transactions` | 查询指定账户名下的交易流水（支持日期范围与交易类型筛选） |

### 交易记录（Transactions）
| Tool | 说明 |
| :--- | :--- |
| `list_transactions` | 按日期范围（`start` / `end`）和类型（`withdrawal` / `deposit` / `transfer`）分页查询交易记录 |
| `get_transaction` | 获取单笔（或拆分交易组）的完整明细 |
| `search_transactions` | 使用 Firefly III 高级搜索语法检索交易（例如 `type:withdrawal category_is:"餐饮" amount_more:50`） |
| `create_transaction` | 创建支出（`withdrawal`）、收入（`deposit`）或转账（`transfer`），支持单笔及多笔拆分记账（Split Transactions）、多币种、分类、预算与标签 |
| `update_transaction` | 修改已有交易记录或拆分明细 |
| `delete_transaction` | 删除指定交易记录 |

---

## 前置准备：获取 Firefly III Personal Access Token

1. 登录你的 Firefly III 网页端。
2. 进入 **Options（选项） -> Profile（个人资料） -> OAuth** 页面。
3. 在 **Personal Access Tokens** 区域点击 **Create New Token**，输入名称（例如 `MCP Server`）并复制生成的长 Token。

---

## 本地构建与运行

环境要求：**Node.js >= 20**

```bash
# 安装依赖
npm install

# 编译 TypeScript 到 dist/
npm run build

# 运行单元测试与 MCP 协议集成测试
npm test
```

## 在 MCP 客户端中配置

### 方式一：直接使用本地构建产物

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "node",
      "args": ["/path/to/firefly-iii-mcp/dist/index.js"],
      "env": {
        "FIREFLY_III_URL": "https://your-firefly-instance.example.com",
        "FIREFLY_III_PAT": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
      }
    }
  }
}
```

### 方式二：发布到 npm 后通过 `npx` 启动

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "npx",
      "args": ["-y", "firefly-iii-mcp"],
      "env": {
        "FIREFLY_III_URL": "https://your-firefly-instance.example.com",
        "FIREFLY_III_PAT": "your_personal_access_token"
      }
    }
  }
}
```

## 环境变量说明

| 变量名 | 必填 | 说明 |
| :--- | :---: | :--- |
| `FIREFLY_III_URL` | 是 | Firefly III 实例地址（如 `http://localhost:8080` 或 `https://money.example.com`，兼容自动去除末尾 `/api/v1`）。亦支持别名 `FIREFLY_BASE_URL` |
| `FIREFLY_III_PAT` | 是 | Firefly III OAuth Personal Access Token。亦支持别名 `FIREFLY_III_TOKEN` |
| `FIREFLY_III_TIMEOUT_MS` | 否 | 请求超时时间（毫秒），默认 `30000` |

## 许可协议

MIT
