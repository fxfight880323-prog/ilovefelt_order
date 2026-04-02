# CloudBase MySQL 数据库设计

## 数据库连接信息
- 环境ID: cloudbase-9gg5wxnh64aaabbc
- 类型: CloudBase MySQL

## 表结构设计

### 1. users - 用户表
```sql
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100) NOT NULL UNIQUE COMMENT '微信openid',
    role VARCHAR(20) DEFAULT 'guest' COMMENT '主角色',
    roles JSON COMMENT '所有角色数组',
    current_role VARCHAR(20) DEFAULT 'guest' COMMENT '当前角色',
    phone VARCHAR(20) COMMENT '手机号',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态',
    name VARCHAR(50) COMMENT '姓名',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid),
    INDEX idx_role (role),
    INDEX idx_current_role (current_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

### 2. craftsmen - 手艺人表
```sql
CREATE TABLE IF NOT EXISTS craftsmen (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100) NOT NULL UNIQUE COMMENT '微信openid',
    name VARCHAR(50) NOT NULL COMMENT '姓名',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    wechat_id VARCHAR(50) COMMENT '微信号',
    code VARCHAR(20) COMMENT '制作师代号',
    specialty VARCHAR(100) COMMENT '擅长工艺',
    experience VARCHAR(50) COMMENT '从业经验',
    address VARCHAR(200) COMMENT '所在地区',
    id_card VARCHAR(20) COMMENT '身份证号',
    star_level TINYINT DEFAULT 3 COMMENT '星级 1-5',
    performance VARCHAR(10) DEFAULT '中' COMMENT '履约情况 优/中/差',
    total_orders INT DEFAULT 0 COMMENT '总接单数',
    completed_orders INT DEFAULT 0 COMMENT '完成订单数',
    rating DECIMAL(2,1) DEFAULT 5.0 COMMENT '评分',
    avatar_url VARCHAR(500) COMMENT '头像',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态 pending/active',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid),
    INDEX idx_phone (phone),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='手艺人表';
```

### 3. dispatchers - 派单人表
```sql
CREATE TABLE IF NOT EXISTS dispatchers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100) NOT NULL UNIQUE COMMENT '微信openid',
    name VARCHAR(50) NOT NULL COMMENT '姓名',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    company VARCHAR(100) COMMENT '公司名称',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid),
    INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='派单人表';
```

### 4. orders - 订单表
```sql
CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL COMMENT '订单名称',
    style_id INT COMMENT '样式ID',
    style_name VARCHAR(100) COMMENT '样式名称',
    quantity INT DEFAULT 1 COMMENT '数量',
    price DECIMAL(10,2) COMMENT '单价',
    total_price DECIMAL(10,2) COMMENT '总价',
    receive_date DATE COMMENT '收货日期',
    dispatch_date DATE COMMENT '派单日期',
    remark TEXT COMMENT '备注',
    image_url VARCHAR(500) COMMENT '订单图片',
    
    -- 派单人信息
    dispatcher_id INT COMMENT '派单人ID',
    dispatcher_name VARCHAR(50) COMMENT '派单人姓名',
    
    -- 手艺人信息
    craftsman_id INT COMMENT '手艺人ID',
    craftsman_name VARCHAR(50) COMMENT '手艺人姓名',
    craftsman_phone VARCHAR(20) COMMENT '手艺人电话',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态 pending/accepted/shipped/completed/cancelled',
    
    -- 物流信息
    tracking_number VARCHAR(100) COMMENT '运单号',
    tracking_company VARCHAR(50) COMMENT '物流公司',
    ship_date TIMESTAMP COMMENT '发货时间',
    
    -- 完成信息
    complete_photos JSON COMMENT '完成照片数组',
    complete_date TIMESTAMP COMMENT '完成时间',
    
    -- 评价
    rating TINYINT COMMENT '评分',
    rating_comment TEXT COMMENT '评价内容',
    
    -- 接单时间
    accept_date TIMESTAMP COMMENT '接单时间',
    
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_craftsman_id (craftsman_id),
    INDEX idx_dispatcher_id (dispatcher_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';
```

### 5. styles - 样式表
```sql
CREATE TABLE IF NOT EXISTS styles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '样式名称',
    description TEXT COMMENT '描述',
    image_url VARCHAR(500) COMMENT '图片URL',
    status TINYINT DEFAULT 1 COMMENT '状态 1启用 0禁用',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='样式表';
```

### 6. verify_codes - 验证码表
```sql
CREATE TABLE IF NOT EXISTS verify_codes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    code VARCHAR(10) NOT NULL COMMENT '验证码',
    type VARCHAR(20) NOT NULL COMMENT '类型 craftsman/dispatcher',
    used TINYINT DEFAULT 0 COMMENT '是否已使用 0/1',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expire_time TIMESTAMP COMMENT '过期时间',
    used_time TIMESTAMP COMMENT '使用时间',
    INDEX idx_phone_code (phone, code),
    INDEX idx_expire (expire_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验证码表';
```

### 7. sms_logs - 短信日志表
```sql
CREATE TABLE IF NOT EXISTS sms_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    phone_to VARCHAR(20) COMMENT '接收手机号',
    content TEXT COMMENT '内容',
    type VARCHAR(50) COMMENT '类型',
    status VARCHAR(20) DEFAULT 'sent' COMMENT '状态',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信日志表';
```

### 8. notices - 公告表
```sql
CREATE TABLE IF NOT EXISTS notices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL COMMENT '标题',
    content TEXT COMMENT '内容',
    type VARCHAR(20) DEFAULT 'normal' COMMENT '类型',
    status TINYINT DEFAULT 1 COMMENT '状态 1显示 0隐藏',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告表';
```

### 9. ratings - 评分表
```sql
CREATE TABLE IF NOT EXISTS ratings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL COMMENT '订单ID',
    craftsman_id INT NOT NULL COMMENT '手艺人ID',
    score TINYINT NOT NULL COMMENT '评分 1-5',
    comment TEXT COMMENT '评价内容',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_craftsman_id (craftsman_id),
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评分表';
```

### 10. admin_requests - 管理员审核表
```sql
CREATE TABLE IF NOT EXISTS admin_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100) COMMENT '申请人openid',
    type VARCHAR(50) COMMENT '类型',
    info JSON COMMENT '申请信息',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态 pending/approved/rejected',
    reason TEXT COMMENT '拒绝原因',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员审核表';
```

## 初始化数据

```sql
-- 插入默认样式
INSERT INTO styles (name, description, status) VALUES
('木工', '木制工艺品', 1),
('陶艺', '陶瓷制品', 1),
('编织', '编织手工艺品', 1),
('刺绣', '刺绣作品', 1),
('雕刻', '雕刻艺术品', 1),
('绘画', '手绘作品', 1),
('其他', '其他类型', 1);
```
