-- 逆熵 ANTIENTROPY · D1 schema v1
-- 部署：wrangler d1 execute antientropy-db --file=db/schema.sql  （或 Dashboard → D1 → 执行 SQL）

CREATE TABLE IF NOT EXISTS devices (
  id         TEXT PRIMARY KEY,        -- 稳定 device_id（每台浏览器一个 UUID，localStorage）
  ua         TEXT,                    -- User-Agent（判手机/桌面）
  country    TEXT,                    -- cf-ipcountry（国家代码，免费）
  ip_masked  TEXT,                    -- IP 末两段打码，保护隐私
  account    TEXT,                    -- 当前绑定的账号（可空；一台设备可换绑）
  created    INTEGER,
  last_seen  INTEGER
);

CREATE TABLE IF NOT EXISTS accounts (
  username   TEXT PRIMARY KEY,        -- 唯一约束：重名直接不让建，避免数据重合
  pass_hash  TEXT,
  salt       TEXT,
  created    INTEGER,
  last_seen  INTEGER
);

CREATE TABLE IF NOT EXISTS device_account (
  device_id  TEXT,
  username   TEXT,
  linked_at  INTEGER,
  PRIMARY KEY (device_id, username)   -- 一个账号可绑多台设备（你 3 浏览器 = 1 人）
);

CREATE TABLE IF NOT EXISTS feedback (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  who      TEXT,                      -- device_id 或 username
  type     TEXT,                      -- bug | idea | sensitive
  text     TEXT,
  status   TEXT DEFAULT 'new',        -- new | done
  created  INTEGER
);

CREATE TABLE IF NOT EXISTS chat_usage (
  key   TEXT,                         -- device_id 或 username
  day   TEXT,                         -- YYYY-MM-DD
  count INTEGER DEFAULT 0,
  PRIMARY KEY (key, day)              -- 云端限次：按账号/设备 + 日期
);

CREATE TABLE IF NOT EXISTS chat_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  who      TEXT,
  role     TEXT,
  content  TEXT,
  created  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_devices_account ON devices(account);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created);
