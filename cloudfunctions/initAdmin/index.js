/**
 * 初始化管理员集合
 * 创建管理员账号：13810062394 / 880323
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 密码加密（简单MD5）
function encryptPassword(password) {
  const crypto = require('crypto')
  return crypto.createHash('md5').update(password).digest('hex')
}

exports.main = async (event, context) => {
  const { action } = event
  
  try {
    // 检查集合是否存在，不存在则创建
    try {
      await db.collection('adminUsers').limit(1).get()
      console.log('adminUsers 集合已存在')
    } catch (err) {
      // 集合不存在，需要创建
      console.log('adminUsers 集合不存在，尝试创建...')
      // 云开发会自动创建集合，只需插入数据
    }

    if (action === 'init') {
      // 检查管理员是否已存在
      const { data: existing } = await db.collection('adminUsers')
        .where({ phone: '13810062394' })
        .get()

      if (existing.length > 0) {
        // 更新密码
        await db.collection('adminUsers').doc(existing[0]._id).update({
          data: {
            password: encryptPassword('880323'),
            name: '超级管理员',
            roles: ['admin'],
            updateTime: db.serverDate()
          }
        })
        return {
          success: true,
          msg: '管理员密码已更新为 880323'
        }
      }

      // 创建新管理员
      const result = await db.collection('adminUsers').add({
        data: {
          phone: '13810062394',
          password: encryptPassword('880323'),
          name: '超级管理员',
          roles: ['admin'],
          isSuperAdmin: true,
          status: 'active',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })

      return {
        success: true,
        msg: '管理员创建成功',
        data: { _id: result._id }
      }
    }

    if (action === 'verify') {
      const { phone, password } = event
      const { data } = await db.collection('adminUsers')
        .where({
          phone,
          password: encryptPassword(password),
          status: 'active'
        })
        .get()

      if (data.length === 0) {
        return { success: false, msg: '账号或密码错误' }
      }

      return {
        success: true,
        msg: '验证成功',
        data: {
          phone: data[0].phone,
          name: data[0].name,
          roles: data[0].roles
        }
      }
    }

    if (action === 'list') {
      const { data } = await db.collection('adminUsers').get()
      return {
        success: true,
        data: data.map(item => ({
          _id: item._id,
          phone: item.phone,
          name: item.name,
          roles: item.roles,
          status: item.status,
          createTime: item.createTime
        }))
      }
    }

    return { success: false, msg: '未知操作' }

  } catch (err) {
    console.error('操作失败:', err)
    return { success: false, msg: err.message }
  }
}
