/**
 * User 云函数 - SQL 版本
 * 直接使用 CloudBase SQL 数据库
 */

const cloud = require('wx-server-sdk')
const { UserDB, CraftsmanDB, DispatcherDB, VerifyCodeDB } = require('../db')

cloud.init({
  env: 'cloudbase-9gg5wxnh64aaabbc'
})

const db = cloud.database()
const _ = db.command

// 管理员手机号
const ADMIN_PHONE = '13810062394'

exports.main = async (event, context) => {
  const { action, data } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'login':
        return await login(OPENID)
      case 'registerCraftsman':
        return await registerCraftsman(OPENID, data)
      case 'verifyDispatcher':
        return await verifyDispatcher(OPENID, data)
      case 'getUserInfo':
        return await getUserInfo(OPENID)
      case 'switchRole':
        return await switchRole(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 登录
async function login(openid) {
  // 从 SQL 查询用户
  let user = await UserDB.getByOpenid(openid)
  
  if (!user) {
    // 创建新用户
    await UserDB.create({
      openid,
      role: 'guest',
      roles: ['guest'],
      current_role: 'guest',
      status: 'active'
    })
    
    user = await UserDB.getByOpenid(openid)
  }
  
  // 检查管理员
  const isAdmin = user.phone === ADMIN_PHONE || (user.roles && user.roles.includes('admin'))
  
  // 获取角色信息
  const rolesInfo = {}
  if (user.roles && user.roles.includes('craftsman')) {
    rolesInfo.craftsman = await CraftsmanDB.getByOpenid(openid)
  }
  if (user.roles && user.roles.includes('dispatcher')) {
    rolesInfo.dispatcher = await DispatcherDB.getByOpenid(openid)
  }
  
  return {
    code: 0,
    data: {
      ...user,
      roles: typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles,
      isAdmin,
      rolesInfo
    }
  }
}

// 注册手艺人
async function registerCraftsman(openid, data) {
  const { name, phone, wechatId, specialty, experience, address, verifyCode } = data
  
  // 验证必填字段
  if (!name || !phone || !specialty || !experience || !address) {
    return { code: -1, message: '请填写完整信息' }
  }
  
  // 验证验证码 - 从 SQL
  const codeRecord = await VerifyCodeDB.verify(phone, verifyCode, 'craftsman')
  if (!codeRecord) {
    return { code: -1, message: '验证码错误或已过期' }
  }
  
  // 检查是否已注册
  const existing = await CraftsmanDB.getByOpenid(openid)
  if (existing) {
    return { code: -1, message: '您已注册为手艺人' }
  }
  
  // 检查手机号
  const phoneExists = await CraftsmanDB.getByPhone(phone)
  if (phoneExists) {
    return { code: -1, message: '该手机号已被注册' }
  }
  
  const isAdminPhone = phone === ADMIN_PHONE
  
  // 创建手艺人 - SQL
  await CraftsmanDB.create({
    openid,
    name,
    phone,
    wechatId,
    specialty,
    experience,
    address,
    status: isAdminPhone ? 'active' : 'pending'
  })
  
  // 获取或创建用户
  let user = await UserDB.getByOpenid(openid)
  const roles = user ? 
    (typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles) : 
    ['guest']
  
  if (!roles.includes('craftsman')) {
    roles.push('craftsman')
  }
  
  if (isAdminPhone && !roles.includes('admin')) {
    roles.push('admin')
  }
  
  if (user) {
    await UserDB.update(openid, {
      roles,
      role: roles[0],
      current_role: user.role === 'guest' ? 'craftsman' : user.current_role,
      phone
    })
  } else {
    await UserDB.create({
      openid,
      role: isAdminPhone ? 'admin' : 'craftsman',
      roles,
      current_role: isAdminPhone ? 'admin' : 'craftsman',
      phone,
      status: 'active'
    })
  }
  
  // 标记验证码已使用
  await VerifyCodeDB.markUsed(codeRecord.id)
  
  return {
    code: 0,
    message: isAdminPhone ? '注册成功' : '注册成功，请等待审核',
    data: {
      status: isAdminPhone ? 'active' : 'pending',
      isAdmin: isAdminPhone,
      roles
    }
  }
}

// 验证派单人
async function verifyDispatcher(openid, data) {
  const { phone, name, company, verifyCode } = data
  
  // 验证必填字段
  if (!phone || !name || !verifyCode) {
    return { code: -1, message: '请填写完整信息' }
  }
  
  // 验证验证码 - SQL
  const codeRecord = await VerifyCodeDB.verify(phone, verifyCode, 'dispatcher')
  if (!codeRecord) {
    return { code: -1, message: '验证码错误或已过期' }
  }
  
  // 检查是否已注册
  const existing = await DispatcherDB.getByOpenid(openid)
  if (existing) {
    return { code: -1, message: '您已注册为派单人' }
  }
  
  // 检查手机号
  const phoneExists = await DispatcherDB.getByPhone(phone)
  if (phoneExists) {
    return { code: -1, message: '该手机号已被注册' }
  }
  
  const isAdminPhone = phone === ADMIN_PHONE
  
  // 创建派单人 - SQL
  await DispatcherDB.create({
    openid,
    name,
    phone,
    company,
    status: isAdminPhone ? 'active' : 'pending'
  })
  
  // 获取或创建用户
  let user = await UserDB.getByOpenid(openid)
  const roles = user ? 
    (typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles) : 
    ['guest']
  
  if (!roles.includes('dispatcher')) {
    roles.push('dispatcher')
  }
  
  if (isAdminPhone && !roles.includes('admin')) {
    roles.push('admin')
  }
  
  if (user) {
    await UserDB.update(openid, {
      roles,
      role: roles[0],
      current_role: user.role === 'guest' ? 'dispatcher' : user.current_role,
      phone
    })
  } else {
    await UserDB.create({
      openid,
      role: isAdminPhone ? 'admin' : 'dispatcher',
      roles,
      current_role: isAdminPhone ? 'admin' : 'dispatcher',
      phone,
      status: 'active'
    })
  }
  
  // 标记验证码已使用
  await VerifyCodeDB.markUsed(codeRecord.id)
  
  return {
    code: 0,
    message: isAdminPhone ? '认证成功' : '认证成功，请等待审核',
    data: {
      status: isAdminPhone ? 'active' : 'pending',
      isAdmin: isAdminPhone,
      roles
    }
  }
}

// 获取用户信息
async function getUserInfo(openid) {
  const user = await UserDB.getByOpenid(openid)
  if (!user) {
    return { code: -1, message: '用户不存在' }
  }
  
  return { code: 0, data: user }
}

// 切换角色
async function switchRole(openid, data) {
  const { role } = data
  
  await UserDB.update(openid, { current_role: role })
  
  return { code: 0, message: '切换成功', data: { currentRole: role } }
}
