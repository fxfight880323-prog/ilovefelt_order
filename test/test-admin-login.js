/**
 * 测试超级管理员登录
 * 在微信开发者工具控制台执行: await testAdminLogin()
 */

async function testAdminLogin() {
  console.log('🧪 测试超级管理员登录...\n')
  
  // 测试1: 检查登录状态
  console.log('测试1: 检查登录状态 (checkStatus)')
  try {
    const checkRes = await wx.cloud.callFunction({
      name: 'api',
      data: { module: 'auth', action: 'checkStatus' }
    })
    console.log('  返回:', JSON.stringify(checkRes.result, null, 2))
  } catch (err) {
    console.log('  错误:', err.message)
  }
  
  // 测试2: 超级管理员登录
  console.log('\n测试2: 超级管理员登录 (loginByPhone)')
  console.log('  手机号: 13810062394')
  console.log('  密码: 880323')
  
  try {
    const loginRes = await wx.cloud.callFunction({
      name: 'api',
      data: {
        module: 'auth',
        action: 'loginByPhone',
        phone: '13810062394',
        password: '880323'
      }
    })
    
    const result = loginRes.result
    console.log('  返回:', JSON.stringify(result, null, 2))
    
    if (result.success) {
      console.log('\n✅ 登录成功!')
      console.log('  - 姓名:', result.data.name)
      console.log('  - 角色:', result.data.roles?.join(', '))
      console.log('  - 是否超级管理员:', result.data.isSuperAdmin ? '是' : '否')
      
      // 保存登录状态到本地
      wx.setStorageSync('userRole', 'admin')
      wx.setStorageSync('isAdmin', true)
      wx.setStorageSync('adminInfo', {
        phone: result.data.phone,
        name: result.data.name
      })
      
      return { success: true, data: result.data }
    } else {
      console.log('\n❌ 登录失败:', result.msg)
      return { success: false, msg: result.msg }
    }
  } catch (err) {
    console.error('\n❌ 登录接口调用失败:', err.message)
    console.log('请确保:')
    console.log('  1. cloudfunctions/api 已部署')
    console.log('  2. 数据库中有超级管理员记录')
    return { success: false, msg: err.message }
  }
}

// 测试3: 验证管理员权限
async function testAdminPermission() {
  console.log('\n测试3: 验证管理员权限 (getPendingRequests)')
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'api',
      data: { module: 'admin', action: 'getPendingRequests' }
    })
    
    console.log('  返回:', JSON.stringify(res.result, null, 2))
    
    if (res.result.success) {
      console.log('\n✅ 管理员权限验证通过!')
      console.log('  - 待审批数量:', res.result.data.total)
    } else {
      console.log('\n❌ 权限验证失败:', res.result.msg)
    }
  } catch (err) {
    console.error('\n❌ 权限接口调用失败:', err.message)
  }
}

// 完整测试流程
async function runFullTest() {
  const loginResult = await testAdminLogin()
  
  if (loginResult.success) {
    await testAdminPermission()
  }
  
  console.log('\n========================================')
  console.log('测试完成!')
  console.log('========================================')
}

// 挂载到全局
if (typeof window !== 'undefined') {
  window.testAdminLogin = testAdminLogin
  window.testAdminPermission = testAdminPermission
  window.runFullTest = runFullTest
}
if (typeof globalThis !== 'undefined') {
  globalThis.testAdminLogin = testAdminLogin
  globalThis.testAdminPermission = testAdminPermission
  globalThis.runFullTest = runFullTest
}

console.log('✅ 测试脚本已加载')
console.log('执行命令:')
console.log('  - await testAdminLogin()      // 测试登录')
console.log('  - await testAdminPermission() // 测试权限')
console.log('  - await runFullTest()         // 完整测试')
