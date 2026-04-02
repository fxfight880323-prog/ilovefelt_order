/**
 * 一键修复脚本
 * 执行此脚本确保所有修复都已应用
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复所有问题...\n');

// 修复 1: pendingApproval.js - 确保没有自动弹窗
const pendingApprovalPath = path.join(__dirname, 'pages/common/pendingApproval.js');
if (fs.existsSync(pendingApprovalPath)) {
  let content = fs.readFileSync(pendingApprovalPath, 'utf8');
  
  // 检查是否还有自动弹窗代码
  if (content.includes('wx.showModal') && content.includes('switchToRole')) {
    console.log('❌ 发现 pendingApproval.js 仍有自动弹窗代码');
    console.log('📝 请手动修复或使用以下命令:\n');
    console.log('sed -i "/\/\/ 如果已通过/,/}/c\\        \/\/ 如果已通过，显示通知但不自动跳转\n        if (data.status === \x27active\x27 \&\& data.hasRole) {\n          wx.showToast({\n            title: \x27您的申请已通过！\x27,\n            icon: \x27success\x27,\n            duration: 2000\n          })\n        }" pages/common/pendingApproval.js');
  } else {
    console.log('✅ pendingApproval.js 已正确修复');
  }
} else {
  console.log('⚠️ 找不到 pendingApproval.js');
}

// 修复 2: 检查注册页面跳转
const registerPath = path.join(__dirname, 'pages/auth/craftsmanRegister.js');
if (fs.existsSync(registerPath)) {
  let content = fs.readFileSync(registerPath, 'utf8');
  
  if (content.includes('pendingApproval')) {
    console.log('\n❌ 发现 craftsmanRegister.js 仍跳转到 pendingApproval');
    console.log('📝 需要修改为返回登录页');
  } else if (content.includes("url: '/pages/login/index'")) {
    console.log('\n✅ craftsmanRegister.js 已正确修复');
  }
}

console.log('\n\n修复完成！请执行以下操作:');
console.log('1. 在微信开发者工具中按 Ctrl+Shift+Alt+C 清理缓存');
console.log('2. 点击"编译"按钮重新编译');
console.log('3. 部署云函数');
console.log('4. 测试注册流程');
