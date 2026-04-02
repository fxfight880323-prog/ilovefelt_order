@echo off
chcp 65001
cls

echo ======================================
echo CloudBase MySQL 集成部署脚本
echo ======================================
echo.

echo 步骤 1: 请确保已创建 CloudBase MySQL 实例
echo 步骤 2: 请在 CloudBase 控制台执行 init_mysql.sql
echo.

echo 正在检查文件...
if exist "cloudfunctions\mysql_proxy\index.js" (
    echo ✓ mysql_proxy 云函数文件存在
) else (
    echo ✗ mysql_proxy 云函数文件不存在
    exit /b 1
)

if exist "cloudfunctions\mysql_sync\init_mysql.sql" (
    echo ✓ SQL 初始化文件存在
) else (
    echo ✗ SQL 初始化文件不存在
    exit /b 1
)

echo.
echo ======================================
echo 部署步骤:
echo ======================================
echo.
echo 1. 在微信开发者工具中:
echo    - 右键 cloudfunctions/mysql_proxy
echo    - 选择 "创建并部署:云端安装依赖"
echo.
echo 2. 在云开发控制台:
echo    - 进入 云函数 -^> mysql_proxy -^> 配置
echo    - 添加环境变量:
echo      MYSQL_HOST=your-host.mysql.gz.cdb.myqcloud.com
echo      MYSQL_PORT=3306
echo      MYSQL_USER=root
echo      MYSQL_PASSWORD=your-password
echo      MYSQL_DATABASE=cloudbase-9gg5wxnh64aaabbc
echo.
echo 3. 重新部署 mysql_proxy 云函数
echo.
echo 4. 测试连接:
echo    - 在云函数控制台测试 mysql_proxy
echo    - 参数: { "action": "query", "sql": "SELECT 1" }
echo.
echo 5. (可选) 部署 migrate_data 云函数
echo    - 用于迁移历史数据
echo.
echo 6. 修改现有云函数:
echo    - 参考 user_mysql_example.js
echo    - 在 user/order/sms 云函数中添加 MySQL 同步
echo.
echo ======================================
echo 配置文件位置:
echo ======================================
echo.
echo SQL 文件: cloudfunctions/mysql_sync/init_mysql.sql
echo 配置说明: cloudfunctions/mysql_proxy/CONFIG.md
echo 部署指南: MYSQL_SYNC_GUIDE.md
echo.

pause
