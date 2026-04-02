/**
 * 在微信开发者工具控制台运行此脚本
 * 用于验证修复是否成功
 */

console.log('验证修复状态...\n');

// 检查数据库状态
const users = wx.getStorageSync('users') || [];
console.log('总用户数:', users.length);
users.forEach((u, i) => {
  console.log(`用户${i+1}: ${u.phone}, 状态: ${u.status}`);
});

// 快速测试函数
window.testRegister = function(phone) {
  phone = phone || '138' + Date.now().toString().slice(-8);
  console.log('\u6d4b试注册:', phone);
  const users = wx.getStorageSync('users') || [];
  users.push({
    phone: phone,
    name: '测试',
    status: 'pending',
    roles: []
  });
  wx.setStorageSync('users', users);
  console.log('注册成功，请返回登录页测试');
};

console.log('\n运行 testRegister() 创建测试用户');
