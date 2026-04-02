# 微信小程序派单系统 - 云函数批量部署脚本
# 使用方法：在微信开发者工具中打开终端，运行：powershell -File deploy.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  微信小程序派单系统 - 云函数部署工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在项目根目录
if (-not (Test-Path "project.config.json")) {
    Write-Host "❌ 错误：请在项目根目录运行此脚本" -ForegroundColor Red
    exit 1
}

# 云函数列表（按优先级排序）
$cloudFunctions = @(
    @{ Name = "init"; Priority = "⭐ 优先"; Desc = "初始化数据库" },
    @{ Name = "admin"; Priority = "⭐ 优先"; Desc = "管理员接口" },
    @{ Name = "craftsmanWorks"; Priority = "⭐ 优先"; Desc = "工作记录管理" },
    @{ Name = "craftsman"; Priority = "必要"; Desc = "手艺人管理" },
    @{ Name = "order"; Priority = "必要"; Desc = "订单管理" },
    @{ Name = "user"; Priority = "必要"; Desc = "用户管理" },
    @{ Name = "sms"; Priority = "可选"; Desc = "短信服务" },
    @{ Name = "subscribe"; Priority = "可选"; Desc = "订阅消息" },
    @{ Name = "style"; Priority = "可选"; Desc = "样式管理" },
    @{ Name = "message"; Priority = "可选"; Desc = "消息通知" },
    @{ Name = "getAccessToken"; Priority = "可选"; Desc = "微信Token" },
    @{ Name = "initTestData"; Priority = "可选"; Desc = "测试数据" }
)

Write-Host "📋 云函数部署清单：" -ForegroundColor Yellow
Write-Host ""

foreach ($func in $cloudFunctions) {
    $path = "cloudfunctions/$($func.Name)"
    $exists = Test-Path $path
    $status = if ($exists) { "✅ 存在" } else { "❌ 缺失" }
    $color = if ($exists) { "Green" } else { "Red" }
    
    Write-Host "  $($func.Priority) [$($func.Name)] $($func.Desc) - " -NoNewline
    Write-Host $status -ForegroundColor $color
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 node_modules
Write-Host "📦 检查 node_modules..." -ForegroundColor Yellow
$needInstall = @()

foreach ($func in $cloudFunctions) {
    $path = "cloudfunctions/$($func.Name)"
    $nodeModulesPath = "$path/node_modules"
    
    if (Test-Path $path) {
        if (-not (Test-Path $nodeModulesPath)) {
            $needInstall += $func.Name
        }
    }
}

if ($needInstall.Count -gt 0) {
    Write-Host "⚠️ 以下云函数缺少 node_modules，需要部署：" -ForegroundColor Yellow
    $needInstall | ForEach-Object { Write-Host "   - $_" }
} else {
    Write-Host "✅ 所有云函数 node_modules 检查完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 部署步骤说明
Write-Host "🚀 部署步骤：" -ForegroundColor Green
Write-Host ""
Write-Host "1. 打开微信开发者工具" -ForegroundColor White
Write-Host "2. 在'云函数'文件夹中，右键点击以下函数：" -ForegroundColor White
Write-Host ""
Write-Host "   ⭐ 优先部署（必须）：" -ForegroundColor Yellow
Write-Host "      - init" -ForegroundColor Cyan
Write-Host "      - admin" -ForegroundColor Cyan
Write-Host "      - craftsmanWorks" -ForegroundColor Cyan
Write-Host ""
Write-Host "   必要部署：" -ForegroundColor Yellow
Write-Host "      - craftsman" -ForegroundColor Cyan
Write-Host "      - order" -ForegroundColor Cyan
Write-Host "      - user" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. 选择'创建并部署：云端安装依赖'" -ForegroundColor White
Write-Host ""
Write-Host "4. 部署完成后，调用 init 云函数初始化数据库：" -ForegroundColor White
Write-Host "   在控制台执行：" -ForegroundColor Gray
Write-Host "   wx.cloud.callFunction({ name: 'init' })" -ForegroundColor Magenta
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 app.json
Write-Host "📱 检查页面配置..." -ForegroundColor Yellow
$appJson = Get-Content "app.json" | ConvertFrom-Json
$userDetailExists = $appJson.pages -contains "pages/admin/userDetail"

if ($userDetailExists) {
    Write-Host "✅ userDetail 页面已注册" -ForegroundColor Green
} else {
    Write-Host "❌ userDetail 页面未注册，请检查 app.json" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署检查完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Read-Host "按 Enter 键退出"
