/**
 * 检查超级管理员账户
 * 在微信开发者工具控制台执行
 */

async function checkAdmin() {
  const db = wx.cloud.database()
  
  console.log('🔍 检查超级管理员账户...\n')
  
  try {
    const { data } = await db.collection('users')
      .where({ phone: '13810062394' })
      .get()
    
    if (data.length === 0) {
      console.log('❌ 超级管理员不存在\n')
      console.log('执行以下代码创建：')
      console.log(`
db.collection('users').add({
  data: {
    phone: '13810062394',
    password: '880323',
    name: '超级管理员',
    roles: ['admin'],
    currentRole: 'admin',
    isSuperAdmin: true,
    roleApplications: [{ role: 'admin', status: 'active' }],
    createTime: new Date()
  }
})
      `)
      return
    }
    
    const user = data[0]
    
    console.log('📋 账户信息：')
    console.log('  ID:', user._id)
    console.log('  姓名:', user.name)
    console.log('  手机号:', user.phone)
    console.log('  密码:', user.password)
    console.log('  密码长度:', user.password?.length)
    console.log('  角色:', user.roles)
    console.log('  当前角色:', user.currentRole)
    console.log('  是否超级管理员:', user.isSuperAdmin)
    console.log('')
    
    // 测试密码
    const testPassword = '880323'
    const storedPassword = user.password
    
    console.log('🔐 密码验证测试：')
    console.log('  输入密码:', testPassword)
    console.log('  存储密码:', storedPassword)
    console.log('  直接比较:', testPassword === storedPassword)
    
    // MD5比较
    const crypto = require('crypto')
    const md5Password = crypto.createHash('md5').update(testPassword).digest('hex')
    console.log('  MD5加密:', md5Password)
    console.log('  MD5比较:', md5Password === storedPassword)
    console.log('')
    
    // 如果不匹配，更新密码
    if (testPassword !== storedPassword && md5Password !== storedPassword) {
      console.log('⚠️ 密码不匹配，正在修复...')
      
      await db.collection('users').doc(user._id).update({
        data: {
          password: '880323',
          updateTime: new Date()
        }
      })
      
      console.log('✅ 密码已修复为: 880323')
    } else {
      console.log('✅ 密码验证通过')
    }
    
    // 测试登录
    console.log('\n🧪 测试登录接口...')
    const loginRes = await wx.cloud.callFunction({
      name: 'api',
      data: {
        module: 'auth',
        action: 'loginByPhone',
        phone: '13810062394',
        password: '880323'
      }
    })
    
    console.log('  结果:', loginRes.result)
    
  } catch (err) {
    console.error('❌ 错误:', err)
  }
}

checkAdmin()

if (typeof window !== 'undefined') window.checkAdmin = checkAdmin
if (typeof globalThis !== 'undefined') globalThis.checkAdmin = checkAdmin
