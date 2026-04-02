/**
 * User 云函数 - MySQL 同步版本示例
 * 
 * 此文件展示如何在现有 user 云函数中添加 MySQL 同步功能
 * 
 * 使用方式：
 * 1. 将此代码合并到原有的 cloudfunctions/user/index.js 中
 * 2. 在每个数据库操作后添加 MySQL 同步调用
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 管理员手机号
const ADMIN_PHONE = '13810062394'

// MySQL 同步开关
const ENABLE_MYSQL_SYNC = true

/**
 * 同步数据到 MySQL
 * @param {string} table - 表名
 * @param {object} data - 数据
 * @param {string} action - 操作类型 insert/update
 */
async function syncToMySQL(table, data, action = 'insert') {
  if (!ENABLE_MYSQL_SYNC) return
  
  try {
    const res = await cloud.callFunction({
      name: 'mysql_proxy',
      data: {
        action: action === 'insert' ? `insert${capitalize(table)}` : `update${capitalize(table)}`,
        data: data,
        where: action === 'update' ? { openid: data.openid } : undefined
      }
    })
    
    if (res.result.code !== 0) {
      console.error(`MySQL sync failed for ${table}:`, res.result.message)
    } else {
      console.log(`MySQL sync success for ${table}`)
    }
  } catch (err) {
    console.error(`MySQL sync error for ${table}:`, err)
    // 不抛出错误，避免影响主流程
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ==================== 修改后的 verifyDispatcher 函数 ====================

async function verifyDispatcher(openid, data) {
  const { phone, name, company, verifyCode } = data
  
  // 验证必填字段
  if (!phone || !name || !verifyCode) {
    return { code: -1, message: '请填写完整信息' }
  }
  
  // 验证验证码
  const codeRes = await db.collection('verifyCodes').where({
    phone,
    code: verifyCode,
    type: 'dispatcher',
    used: false,
    expireTime: _.gte(new Date())
  }).get()
  
  if (codeRes.data.length === 0) {
    return { code: -1, message: '验证码错误或已过期' }
  }
  
  // 检查用户是否已注册为派单人
  const existRes = await db.collection('dispatchers').where({ openid }).get()
  if (existRes.data.length > 0) {
    return { code: -1, message: '您已注册为派单人' }
  }
  
  // 检查手机号是否已被注册
  const phoneRes = await db.collection('dispatchers').where({ phone }).get()
  if (phoneRes.data.length > 0) {
    return { code: -1, message: '该手机号已被注册' }
  }
  
  // 如果是管理员手机号，直接通过
  const isAdminPhone = phone === ADMIN_PHONE
  
  // ====== 创建派单人记录（云数据库）======
  const dispatcherRes = await db.collection('dispatchers').add({
    data: {
      openid,
      name,
      phone,
      company: company || '',
      status: isAdminPhone ? 'active' : 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // ====== 同步到 MySQL ======
  await syncToMySQL('Dispatcher', {
    openid,
    name,
    phone,
    company: company || '',
    status: isAdminPhone ? 'active' : 'pending'
  }, 'insert')
  
  // 获取用户当前角色
  const userRes = await db.collection('users').where({ openid }).get()
  
  // 如果用户不存在，先创建用户
  if (userRes.data.length === 0) {
    const newRoles = ['dispatcher']
    if (isAdminPhone) newRoles.push('admin')
    
    // ====== 创建用户（云数据库）======
    await db.collection('users').add({
      data: {
        openid,
        role: isAdminPhone ? 'admin' : 'dispatcher',
        roles: newRoles,
        currentRole: isAdminPhone ? 'admin' : 'dispatcher',
        phone,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    // ====== 同步到 MySQL ======
    await syncToMySQL('User', {
      openid,
      role: isAdminPhone ? 'admin' : 'dispatcher',
      roles: newRoles,
      current_role: isAdminPhone ? 'admin' : 'dispatcher',
      phone,
      status: 'active'
    }, 'insert')
    
    // 标记验证码为已使用
    await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
      data: { used: true, usedTime: db.serverDate() }
    })
    
    return {
      code: 0,
      message: isAdminPhone ? '认证成功' : '认证成功，请等待审核',
      data: {
        dispatcherId: dispatcherRes._id,
        status: isAdminPhone ? 'active' : 'pending',
        isAdmin: isAdminPhone,
        roles: newRoles
      }
    }
  }
  
  const user = userRes.data[0]
  const currentRoles = user.roles || [user.role]
  
  // 添加派单人角色
  if (!currentRoles.includes('dispatcher')) {
    currentRoles.push('dispatcher')
  }
  
  // 更新用户角色
  const updateData = {
    roles: currentRoles,
    role: currentRoles[0],
    phone,
    status: 'active',
    updateTime: db.serverDate()
  }
  
  // 如果是第一个角色，设置当前角色
  if (user.role === 'guest') {
    updateData.currentRole = 'dispatcher'
    updateData.role = 'dispatcher'
  }
  
  // 如果是管理员手机号，添加 admin 角色
  if (isAdminPhone && !currentRoles.includes('admin')) {
    currentRoles.push('admin')
    updateData.roles = currentRoles
  }
  
  // ====== 更新用户（云数据库）======
  await db.collection('users').doc(user._id).update({ data: updateData })
  
  // ====== 同步到 MySQL ======
  await syncToMySQL('User', {
    openid,
    ...updateData
  }, 'update')
  
  // 标记验证码为已使用
  await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
    data: { used: true, usedTime: db.serverDate() }
  })
  
  return {
    code: 0,
    message: isAdminPhone ? '认证成功' : '认证成功，请等待审核',
    data: {
      dispatcherId: dispatcherRes._id,
      status: isAdminPhone ? 'active' : 'pending',
      isAdmin: isAdminPhone,
      roles: currentRoles
    }
  }
}

// ==================== 修改后的 registerCraftsman 函数 ====================

async function registerCraftsman(openid, data) {
  const { name, phone, wechatId, specialty, experience, address, idCard, verifyCode } = data
  
  // 验证必填字段
  if (!name || !phone || !specialty || !experience || !address) {
    return { code: -1, message: '请填写完整信息' }
  }
  
  // 验证验证码
  const codeRes = await db.collection('verifyCodes').where({
    phone,
    code: verifyCode,
    type: 'craftsman',
    used: false,
    expireTime: _.gte(new Date())
  }).get()
  
  if (codeRes.data.length === 0) {
    return { code: -1, message: '验证码错误或已过期' }
  }
  
  // 检查用户是否已注册为手艺人
  const existRes = await db.collection('craftsmen').where({ openid }).get()
  if (existRes.data.length > 0) {
    return { code: -1, message: '您已注册为手艺人' }
  }
  
  // 检查手机号是否已被注册
  const phoneRes = await db.collection('craftsmen').where({ phone }).get()
  if (phoneRes.data.length > 0) {
    return { code: -1, message: '该手机号已被注册' }
  }
  
  // 如果是管理员手机号，直接通过
  const isAdminPhone = phone === ADMIN_PHONE
  
  // ====== 创建手艺人记录（云数据库）======
  const craftsmanRes = await db.collection('craftsmen').add({
    data: {
      openid,
      name,
      phone,
      wechatId: wechatId || '',
      specialty: specialty || '',
      experience: experience || '',
      address: address || '',
      idCard: idCard || '',
      starLevel: 3,
      performance: '良好',
      totalOrders: 0,
      completedOrders: 0,
      rating: 5.0,
      status: isAdminPhone ? 'active' : 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // ====== 同步到 MySQL ======
  await syncToMySQL('Craftsman', {
    openid,
    name,
    phone,
    wechat_id: wechatId || '',
    specialty: specialty || '',
    experience: experience || '',
    address: address || '',
    id_card: idCard || '',
    star_level: 3,
    performance: '良好',
    total_orders: 0,
    completed_orders: 0,
    rating: 5.0,
    status: isAdminPhone ? 'active' : 'pending'
  }, 'insert')
  
  // 获取用户当前角色
  const userRes = await db.collection('users').where({ openid }).get()
  
  // 如果用户不存在，创建新用户
  if (userRes.data.length === 0) {
    const newRoles = ['craftsman']
    if (isAdminPhone) newRoles.push('admin')
    
    await db.collection('users').add({
      data: {
        openid,
        role: isAdminPhone ? 'admin' : 'craftsman',
        roles: newRoles,
        currentRole: isAdminPhone ? 'admin' : 'craftsman',
        phone,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    await syncToMySQL('User', {
      openid,
      role: isAdminPhone ? 'admin' : 'craftsman',
      roles: newRoles,
      current_role: isAdminPhone ? 'admin' : 'craftsman',
      phone,
      status: 'active'
    }, 'insert')
    
    // 标记验证码为已使用
    await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
      data: { used: true, usedTime: db.serverDate() }
    })
    
    return {
      code: 0,
      message: isAdminPhone ? '注册成功' : '注册成功，请等待审核',
      data: {
        craftsmanId: craftsmanRes._id,
        status: isAdminPhone ? 'active' : 'pending',
        isAdmin: isAdminPhone,
        roles: newRoles
      }
    }
  }
  
  const user = userRes.data[0]
  const currentRoles = user.roles || [user.role]
  
  // 添加手艺人角色
  if (!currentRoles.includes('craftsman')) {
    currentRoles.push('craftsman')
  }
  
  // 更新用户角色
  const updateData = {
    roles: currentRoles,
    role: currentRoles[0],
    phone,
    status: 'active',
    updateTime: db.serverDate()
  }
  
  if (user.role === 'guest') {
    updateData.currentRole = 'craftsman'
    updateData.role = 'craftsman'
  }
  
  if (isAdminPhone && !currentRoles.includes('admin')) {
    currentRoles.push('admin')
    updateData.roles = currentRoles
  }
  
  await db.collection('users').doc(user._id).update({ data: updateData })
  
  await syncToMySQL('User', {
    openid,
    ...updateData
  }, 'update')
  
  // 标记验证码为已使用
  await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
    data: { used: true, usedTime: db.serverDate() }
  })
  
  return {
    code: 0,
    message: isAdminPhone ? '注册成功' : '注册成功，请等待审核',
    data: {
      craftsmanId: craftsmanRes._id,
      status: isAdminPhone ? 'active' : 'pending',
      isAdmin: isAdminPhone,
      roles: currentRoles
    }
  }
}

module.exports = {
  verifyDispatcher,
  registerCraftsman,
  syncToMySQL
}
