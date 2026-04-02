const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 管理员手机号
const ADMIN_PHONE = '13810062394'

// 密码加密函数
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// 验证密码
function verifyPassword(password, hashedPassword) {
  return hashPassword(password) === hashedPassword
}

/**
 * 角色隔离：从 roleApplications 中获取所有已通过审批的角色
 * @param {Object} user - 用户数据对象
 * @returns {Array} - 已通过审批的角色数组
 */
function getValidatedRoles(user) {
  // 优先从 roleApplications 中获取 active 状态的角色
  const roleApps = user.roleApplications || []
  const activeRoles = roleApps
    .filter(app => app.status === 'active')
    .map(app => app.role)
  
  // 合并传统的 roles 数组（向下兼容）
  const legacyRoles = user.roles || []
  
  // 去重后返回
  return [...new Set([...activeRoles, ...legacyRoles])]
}

exports.main = async (event, context) => {
  const { action, data } = event
  const { OPENID } = cloud.getWXContext()
  
  console.log(`[user] 请求: action=${action}, OPENID=${OPENID}`)
  
  try {
    switch (action) {
      case 'login':
        return await login(OPENID)
      case 'loginByPhone':
        return await loginByPhone(data)
      case 'registerCraftsman':
        return await registerCraftsman(OPENID, data)
      case 'verifyDispatcher':
        return await verifyDispatcher(OPENID, data)
      case 'getUserInfo':
        return await getUserInfo(OPENID)
      case 'updateUserInfo':
        return await updateUserInfo(OPENID, data)
      case 'isAdmin':
        return await checkIsAdmin(OPENID)
      case 'switchRole':
        return await switchRole(OPENID, data)
      case 'getUserRoles':
        return await getUserRoles(OPENID)
      case 'updateAvatar':
        return await updateAvatar(OPENID, data)
      // 新接口：角色申请和审批
      case 'applyRole':
        return await applyRole(OPENID, data)
      case 'getRoleApplicationStatus':
        return await getRoleApplicationStatus(OPENID, data)
      case 'checkRoleAccess':
        return await checkRoleAccess(OPENID, data)
      case 'initAdmin':
        return await initAdmin(data)
      case 'getOpenid':
        return { code: 0, openid: OPENID || null }
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 检查是否为管理员
// 检查是否为管理员（不再根据手机号自动设置，必须显式授予）
async function checkIsAdmin(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: 0, isAdmin: false }
  }
  
  const user = userRes.data[0]
  // 使用角色隔离检查是否有管理员权限
  const validRoles = getValidatedRoles(user)
  return { code: 0, isAdmin: validRoles.includes('admin') }
}

// 登录（微信一键登录）
async function login(openid) {
  // 以openid查找用户
  const userRes = await db.collection('users').where({ openid }).get()
  
  if (userRes.data.length === 0) {
    // 用户不存在，返回错误，需要先注册
    return {
      code: -1001,
      message: '该用户未注册，请先注册账号',
      data: {
        needRegister: true
      }
    }
  }
  
  const user = userRes.data[0]
  const roleApps = user.roleApplications || []
  
  console.log('[login] 用户登录:', { phone: user.phone, roleApps: roleApps.map(a => ({role: a.role, status: a.status})) })
  
  // 角色隔离：查找所有已通过审批的角色（active状态）
  const activeApps = roleApps.filter(app => app.status === 'active')
  
  if (activeApps.length === 0) {
    // 没有已通过的角色，检查是否有审核中的角色
    const pendingApps = roleApps.filter(app => app.status === 'pending')
    if (pendingApps.length > 0) {
      // 有审核中的角色，但没有已通过的
      console.log('[login] 拦截：有审核中的角色，但无已通过的', pendingApps)
      return {
        code: -1002,
        message: `您有 ${pendingApps.length} 个角色申请正在审核中，请等待管理员审批后再登录`,
        data: {
          needApproval: true,
          pendingRoles: pendingApps.map(app => app.role),
          status: 'pending'
        }
      }
    }
    
    // 没有任何角色（无审核中也无已通过）
    console.log('[login] 拦截：没有任何角色')
    return {
      code: -1003,
      message: '您的账号尚未通过审批，请等待管理员审批',
      data: {
        needApproval: true
      }
    }
  }
  
  // 有已通过的角色，可以登录
  // 角色隔离：只返回已通过的角色，pending 状态的角色不影响登录
  const validRoles = activeApps.map(app => app.role)
  
  console.log('[login] 已通过的角色:', validRoles)
  
  // 检查是否为管理员
  const isAdmin = await checkAdminStatus(openid, user)
  if (isAdmin && !validRoles.includes('admin')) {
    validRoles.push('admin')
  }
  
  console.log('[login] 登录成功:', { phone: user.phone, validRoles, pendingCount: roleApps.filter(app => app.status === 'pending').length })
  
  // 获取用户角色信息（只包含已通过的）
  const rolesInfo = await getUserRolesInfo(openid, user)
  
  return {
    code: 0,
    data: {
      ...user,
      isAdmin,
      roles: validRoles,
      currentRole: validRoles[0],
      rolesInfo,
      // 附加审核中的角色信息（仅用于展示）
      pendingRoles: roleApps.filter(app => app.status === 'pending').map(app => ({
        role: app.role,
        status: app.status,
        applyTime: app.applyTime
      }))
    }
  }
}

// 手机号+密码登录
async function loginByPhone(data) {
  const { phone, password } = data
  
  if (!phone || !password) {
    return { code: -1, message: '请输入手机号和密码' }
  }
  
  // 查找用户
  const userRes = await db.collection('users').where({ phone }).get()
  
  if (userRes.data.length === 0) {
    return { code: -1001, message: '该手机号未注册，请先注册账号' }
  }
  
  const user = userRes.data[0]
  
  // 验证密码
  if (!user.password) {
    return { code: -1, message: '该账号未设置密码，请使用微信登录' }
  }
  
  if (!verifyPassword(password, user.password)) {
    return { code: -1, message: '密码错误' }
  }
  
  // 角色隔离：查找所有已通过审批的角色
  const roleApps = user.roleApplications || []
  const activeApps = roleApps.filter(app => app.status === 'active')
  
  if (activeApps.length === 0) {
    // 没有已通过的角色，检查是否有审核中的
    const pendingApps = roleApps.filter(app => app.status === 'pending')
    if (pendingApps.length > 0) {
      console.log('[loginByPhone] 拦截：有审核中的角色', pendingApps)
      return {
        code: -1002,
        message: `您有 ${pendingApps.length} 个角色申请正在审核中，请等待管理员审批后再登录`,
        data: {
          needApproval: true,
          pendingRoles: pendingApps.map(app => app.role),
          status: 'pending'
        }
      }
    }
    
    console.log('[loginByPhone] 拦截：没有任何角色')
    return {
      code: -1003,
      message: '您的账号尚未通过审批，请等待管理员审批',
      data: {
        needApproval: true
      }
    }
  }
  
  // 有已通过的角色，可以登录
  const validRoles = activeApps.map(app => app.role)
  
  // 检查是否为管理员
  const isAdmin = await checkAdminStatus(user.openid, user)
  if (isAdmin && !validRoles.includes('admin')) {
    validRoles.push('admin')
  }
  
  console.log('[loginByPhone] 登录成功:', { phone: user.phone, validRoles, pendingCount: roleApps.filter(app => app.status === 'pending').length })
  
  // 获取用户角色信息
  const rolesInfo = await getUserRolesInfo(user.openid, user)
  
  return {
    code: 0,
    message: '登录成功',
    data: {
      ...user,
      isAdmin,
      roles: validRoles,
      currentRole: validRoles[0],
      rolesInfo
    }
  }
}

// 检查管理员状态
// 注意：不再根据手机号自动设置管理员，管理员权限必须显式授予
async function checkAdminStatus(openid, user) {
  // 只检查是否已显式授予 admin 角色
  const validRoles = getValidatedRoles(user)
  return validRoles.includes('admin')
}

// 获取用户所有角色信息
async function getUserRolesInfo(openid, user) {
  const rolesInfo = {}
  const roles = user.roles || [user.role]
  
  // 获取手艺人信息
  if (roles.includes('craftsman')) {
    const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
    if (craftsmanRes.data.length > 0) {
      rolesInfo.craftsman = craftsmanRes.data[0]
    }
  }
  
  // 获取派单人信息
  if (roles.includes('dispatcher')) {
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0) {
      rolesInfo.dispatcher = dispatcherRes.data[0]
    }
  }
  
  return rolesInfo
}

// 获取当前登录用户信息（带身份验证）
// 确保只能获取自己的数据，完全隔离其他账号
async function getUserInfo(openid) {
  // 通过openid查找用户（openid是微信登录凭证）
  const userRes = await db.collection('users').where({ openid }).get()
  
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  
  // 身份验证：确保openid匹配
  if (user.openid !== openid) {
    console.error('[getUserInfo] 身份验证失败')
    return { code: -1, message: '身份验证失败' }
  }
  
  const isAdmin = await checkAdminStatus(openid, user)
  
  // 角色隔离：只返回已通过审批的角色
  const validRoles = getValidatedRoles(user)
  if (isAdmin && !validRoles.includes('admin')) {
    validRoles.push('admin')
  }
  
  // 使用筛选后的角色获取角色信息（基于openid查询，确保数据隔离）
  const userWithValidRoles = { ...user, roles: validRoles }
  const rolesInfo = await getUserRolesInfo(openid, userWithValidRoles)
  
  return {
    code: 0,
    data: {
      ...user,
      isAdmin,
      roles: validRoles,
      currentRole: validRoles[0] || user.currentRole || user.role,
      rolesInfo,
      // 附加审核中的角色信息
      pendingRoles: (user.roleApplications || [])
        .filter(app => app.status === 'pending')
        .map(app => ({ role: app.role, status: app.status, applyTime: app.applyTime }))
    }
  }
}

// 根据手机号获取用户信息
async function getUserInfoByPhone(phone) {
  const userRes = await db.collection('users').where({ phone }).get()
  
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  const isAdmin = await checkAdminStatus(user.openid, user)
  
  // 角色隔离：只返回已通过审批的角色
  const validRoles = getValidatedRoles(user)
  if (isAdmin && !validRoles.includes('admin')) {
    validRoles.push('admin')
  }
  
  // 使用筛选后的角色获取角色信息
  const userWithValidRoles = { ...user, roles: validRoles }
  const rolesInfo = await getUserRolesInfo(user.openid, userWithValidRoles)
  
  return {
    code: 0,
    data: {
      ...user,
      isAdmin,
      roles: validRoles,
      currentRole: validRoles[0] || user.currentRole || user.role,
      rolesInfo,
      // 附加审核中的角色信息
      pendingRoles: (user.roleApplications || [])
        .filter(app => app.status === 'pending')
        .map(app => ({ role: app.role, status: app.status, applyTime: app.applyTime }))
    }
  }
}

// 获取用户所有角色
async function getUserRoles(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  const isAdmin = await checkAdminStatus(openid, user)
  
  // 角色隔离：只返回已通过审批的角色
  const validRoles = getValidatedRoles(user)
  if (isAdmin && !validRoles.includes('admin')) {
    validRoles.push('admin')
  }
  
  // 使用筛选后的角色获取角色信息
  const userWithValidRoles = { ...user, roles: validRoles }
  const rolesInfo = await getUserRolesInfo(openid, userWithValidRoles)
  
  // 构建可用角色列表
  const availableRoles = []
  
  if (isAdmin) {
    availableRoles.push({ value: 'admin', label: '管理员', icon: '👑' })
  }
  
  // 使用经过角色隔离筛选的角色
  const roles = validRoles
  
  if (roles.includes('craftsman') && rolesInfo.craftsman) {
    availableRoles.push({ 
      value: 'craftsman', 
      label: '手艺人', 
      icon: '👨‍🎨',
      info: rolesInfo.craftsman 
    })
  }
  
  if (roles.includes('dispatcher') && rolesInfo.dispatcher) {
    availableRoles.push({ 
      value: 'dispatcher', 
      label: '派单人', 
      icon: '📋',
      info: rolesInfo.dispatcher 
    })
  }
  
  return {
    code: 0,
    data: {
      currentRole: user.currentRole || user.role,
      availableRoles,
      isAdmin
    }
  }
}

// 切换角色（新版本，支持角色申请系统）
async function switchRole(openid, data) {
  const { role } = data
  
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  
  // 角色隔离：只允许切换已通过审批的角色
  const validRoles = getValidatedRoles(user)
  
  // 检查是否已有该角色（且已通过审批）
  if (validRoles.includes(role)) {
    // 已有该角色，直接切换
    await db.collection('users').doc(user._id).update({
      data: {
        currentRole: role,
        updateTime: db.serverDate()
      }
    })
    
    return {
      code: 0,
      message: '切换成功',
      data: { 
        currentRole: role,
        status: 'active'
      }
    }
  }
  
  // 没有该角色，检查申请状态
  const roleApps = user.roleApplications || []
  const app = roleApps.find(a => a.role === role)
  
  if (app) {
    if (app.status === 'pending') {
      return {
        code: -1,
        message: '您的申请正在审核中，请耐心等待',
        data: {
          status: 'pending',
          role
        }
      }
    } else if (app.status === 'rejected') {
      return {
        code: -1,
        message: '您的申请已被拒绝，请重新申请',
        data: {
          status: 'rejected',
          role,
          rejectReason: app.rejectReason
        }
      }
    }
  }
  
  // 没有申请记录
  return {
    code: -1,
    message: '您尚未申请该角色',
    data: {
      status: 'none',
      role
    }
  }
}

// 履约分配置
const RELIABILITY_CONFIG = {
  INITIAL_SCORE: 5.0,
  MAX_SCORE: 6.0,
  MIN_SCORE: 0.0,
  LEVELS: {
    EXCELLENT: { min: 4.0, label: '优秀' },
    MEDIUM: { min: 2.0, label: '中等' },
    WARNING: { min: 0.4, label: '警告' },
    DANGER: { min: 0, label: '危险' }
  }
}

// 计算履约等级
function calculateReliabilityLevel(score) {
  if (score >= RELIABILITY_CONFIG.LEVELS.EXCELLENT.min) {
    return RELIABILITY_CONFIG.LEVELS.EXCELLENT
  } else if (score >= RELIABILITY_CONFIG.LEVELS.MEDIUM.min) {
    return RELIABILITY_CONFIG.LEVELS.MEDIUM
  } else if (score >= RELIABILITY_CONFIG.LEVELS.WARNING.min) {
    return RELIABILITY_CONFIG.LEVELS.WARNING
  }
  return RELIABILITY_CONFIG.LEVELS.DANGER
}

// 注册手艺人
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
    const existingCraftsman = existRes.data[0]
    // 根据状态返回不同提示
    if (existingCraftsman.status === 'active') {
      return { code: -1, message: '您已通过审核，请勿重复注册' }
    } else if (existingCraftsman.status === 'pending') {
      return { code: -1, message: '您的申请正在审核中，请耐心等待' }
    } else if (existingCraftsman.status === 'rejected') {
      // 被拒绝的可以重新注册，先删除旧记录
      await db.collection('craftsmen').doc(existingCraftsman._id).remove()
      // 继续执行后续注册逻辑
    }
  }
  
  // 检查手机号是否已被注册
  const phoneRes = await db.collection('craftsmen').where({ phone }).get()
  if (phoneRes.data.length > 0) {
    return { code: -1, message: '该手机号已被注册' }
  }
  
  // 初始履约分
  const initialReliabilityScore = RELIABILITY_CONFIG.INITIAL_SCORE
  const reliabilityLevel = calculateReliabilityLevel(initialReliabilityScore)
  
  // 创建手艺人记录（所有用户都需要审批）
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
      reliabilityScore: initialReliabilityScore,
      reliabilityLevel: reliabilityLevel.label,
      status: 'pending', // 所有用户都需要审批
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 获取用户当前角色
  const userRes = await db.collection('users').where({ openid }).get()
  
  // 如果用户不存在，先创建用户（所有用户都需要审批）
  if (userRes.data.length === 0) {
    console.log('用户不存在，创建新用户')
    
    await db.collection('users').add({
      data: {
        openid,
        role: '', // 未审批旰无角色
        roles: [], // 空数组，审批通过后添加
        currentRole: '',
        phone,
        status: 'pending',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    // 标记验证码为已使用
    await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
      data: { used: true, usedTime: db.serverDate() }
    })
    
    return {
      code: 0,
      message: '认证成功，请等待审核',
      data: {
        craftsmanId: craftsmanRes._id,
        status: 'pending',
        isAdmin: false,
        roles: []
      }
    }
  }
  
  const user = userRes.data[0]
  
  // 所有用户都需要审批，不更新 roles 数组
  // 等待管理员在 admin 云函数中审批通过后再更新
  const updateData = {
    phone,
    updateTime: db.serverDate()
  }
  
  await db.collection('users').doc(user._id).update({ data: updateData })
  
  // 标记验证码为已使用
  await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
    data: { used: true, usedTime: db.serverDate() }
  })
  
  return {
    code: 0,
    message: '注册成功，请等待审核',
    data: {
      craftsmanId: craftsmanRes._id,
      status: 'pending',
      isAdmin: false,
      roles: currentRoles
    }
  }
}

// 验证派单人身份
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
    const existingDispatcher = existRes.data[0]
    // 根据状态返回不同提示
    if (existingDispatcher.status === 'active') {
      return { code: -1, message: '您已通过审核，请勿重复注册' }
    } else if (existingDispatcher.status === 'pending') {
      return { code: -1, message: '您的申请正在审核中，请耐心等待' }
    } else if (existingDispatcher.status === 'rejected') {
      // 被拒绝的可以重新注册，先删除旧记录
      await db.collection('dispatchers').doc(existingDispatcher._id).remove()
      // 继续执行后续注册逻辑
    }
  }
  
  // 检查手机号是否已被注册
  const phoneRes = await db.collection('dispatchers').where({ phone }).get()
  if (phoneRes.data.length > 0) {
    return { code: -1, message: '该手机号已被注册' }
  }
  
  // 创建派单人记录（所有用户都需要审批）
  const dispatcherRes = await db.collection('dispatchers').add({
    data: {
      openid,
      name,
      phone,
      company: company || '',
      status: 'pending', // 所有用户都需要审批
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 获取用户当前角色
  const userRes = await db.collection('users').where({ openid }).get()
  
  // 如果用户不存在，创建新用户（所有用户都需要审批）
  if (userRes.data.length === 0) {
    await db.collection('users').add({
      data: {
        openid,
        role: '', // 未审批旰无角色
        roles: [], // 空数组，审批通过后添加
        currentRole: '',
        phone,
        status: 'pending',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    // 标记验证码为已使用
    await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
      data: { used: true, usedTime: db.serverDate() }
    })
    
    return {
      code: 0,
      message: '认证成功，请等待审核',
      data: {
        dispatcherId: dispatcherRes._id,
        status: 'pending',
        isAdmin: false,
        roles: []
      }
    }
  }
  
  const user = userRes.data[0]
  
  // 所有用户都需要审批，不更新 roles 数组
  // 等待管理员在 admin 云函数中审批通过后再更新
  const updateData = {
    phone,
    updateTime: db.serverDate()
  }
  
  await db.collection('users').doc(user._id).update({ data: updateData })
  
  // 标记验证码为已使用
  await db.collection('verifyCodes').doc(codeRes.data[0]._id).update({
    data: { used: true, usedTime: db.serverDate() }
  })
  
  return {
    code: 0,
    message: '认证成功，请等待审核',
    data: {
      dispatcherId: dispatcherRes._id,
      status: 'pending',
      isAdmin: false,
      roles: []
    }
  }
}

// 更新用户信息
async function updateUserInfo(openid, data) {
  const { name, avatarUrl } = data
  
  await db.collection('users').where({ openid }).update({
    data: {
      name,
      avatarUrl,
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '更新成功' }
}

// 更新头像
async function updateAvatar(openid, data) {
  const { avatarUrl, role } = data
  
  if (!avatarUrl) {
    return { code: -1, message: '头像地址不能为空' }
  }
  
  // 更新用户表
  await db.collection('users').where({ openid }).update({
    data: {
      avatarUrl,
      updateTime: db.serverDate()
    }
  })
  
  // 根据角色更新对应的角色表
  if (role === 'craftsman') {
    const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
    if (craftsmanRes.data.length > 0) {
      await db.collection('craftsmen').doc(craftsmanRes.data[0]._id).update({
        data: {
          avatarUrl,
          updateTime: db.serverDate()
        }
      })
    }
  } else if (role === 'dispatcher') {
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0) {
      await db.collection('dispatchers').doc(dispatcherRes.data[0]._id).update({
        data: {
          avatarUrl,
          updateTime: db.serverDate()
        }
      })
    }
  }
  
  return { code: 0, message: '头像更新成功', data: { avatarUrl } }
}

// ==================== 新角色管理系统 ====================

/**
 * 申请角色
 * 流程：
 * 1. 以手机号为唯一Key查询用户
 * 2. 如果手机号已注册，更新微信openid并检查角色
 * 3. 如果手机号未注册，创建新用户（支持同一微信号不同手机号）
 * 4. 支持同一微信号不同手机号注册多个账号
 */
async function applyRole(openid, data) {
  const { role, applyData } = data
  const { name, phone, ...extraData } = applyData
  
  if (!role || !['craftsman', 'dispatcher'].includes(role)) {
    return { code: -1, message: '无效的角色类型' }
  }
  
  // 如果没有openid（测试环境），生成一个临时值
  if (!openid) {
    openid = 'test_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    console.log('[applyRole] 使用临时openid:', openid)
  }
  
  console.log('[applyRole] 开始注册:', { openid, role, phone, name })
  
  // 以手机号为唯一Key查询用户
  const userRes = await db.collection('users').where({ phone }).get()
  let user = null
  let userId = null
  
  if (userRes.data.length > 0) {
    user = userRes.data[0]
    userId = user._id
    
    console.log('[applyRole] 手机号已存在:', { userId, existingOpenid: user.openid, currentOpenid: openid })
    
    // 更新openid（可能是同一用户换了微信号登录）
    if (user.openid !== openid) {
      console.log('[applyRole] 更新openid')
      await db.collection('users').doc(userId).update({
        data: { openid, updateTime: db.serverDate() }
      })
      user.openid = openid
    }
    
    // 检查是否已有该角色
    const roles = user.roles || [user.role]
    if (roles.includes(role)) {
      console.log('[applyRole] 用户已有该角色:', roles)
      return { code: -1, message: '该手机号已注册此角色，请直接登录' }
    }
    
    // 检查 roleApplications
    const roleApps = user.roleApplications || []
    const existingApp = roleApps.find(app => app.role === role)
    
    if (existingApp) {
      if (existingApp.status === 'pending') {
        return { code: -1, message: '您的申请正在审核中，请耐心等待' }
      } else if (existingApp.status === 'active') {
        return { code: -1, message: '您已通过审核，请勿重复申请' }
      } else if (existingApp.status === 'rejected') {
        // 被拒绝，允许重新申请，删除旧记录
        await db.collection('users').doc(userId).update({
          data: {
            roleApplications: roleApps.filter(app => app.role !== role)
          }
        })
      }
    }
  } else {
    console.log('[applyRole] 手机号未注册，将创建新用户:', { phone, name, openid })
  }
  
  // 创建新的申请记录（管理员手机号也需要审批，不再自动通过）
  const newApplication = {
    role,
    status: 'pending',
    applyTime: db.serverDate(),
    applyData: extraData
  }
  
  // 更新或创建用户记录
  if (user) {
    // 更新现有用户（手机号已注册，添加新角色）
    const updateData = {
      roleApplications: _.push([newApplication]),
      updateTime: db.serverDate()
    }
    
    // 所有用户（包括管理员手机号）都需要审批，不更新 roles 数组
    // 等待审批通过后再更新 roles
    
    await db.collection('users').doc(userId).update({ data: updateData })
  } else {
    // 创建新用户（手机号未注册）
    // 所有用户初始时 roles 为空数组，只有审批通过后才添加角色
    
    // 密码加密存储
    const hashedPassword = extraData.password ? hashPassword(extraData.password) : null
    
    const newUser = {
      openid,
      phone,
      name,
      password: hashedPassword,
      roles: [], // 初始为空，审批通过后才添加
      currentRole: '', // 初始为空
      roleApplications: [newApplication],
      isAdmin: false, // 管理员权限必须显式授予
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
    
    try {
      console.log('[applyRole] 开始插入数据库...')
      const addResult = await db.collection('users').add({ data: newUser })
      console.log('[applyRole] 数据库插入结果:', addResult)
      userId = addResult._id || (addResult.data && addResult.data._id)
      console.log('[applyRole] 新用户ID:', userId)
    } catch (dbErr) {
      console.error('[applyRole] 数据库插入失败:', dbErr)
      return { code: -1, message: '数据库写入失败: ' + dbErr.message }
    }
  }
  
  // 不再自动创建角色详情记录，所有用户都需要等待审批通过后才创建
  
  // 发送通知给管理员
  try {
    await db.collection('adminNotifications').add({
      data: {
        type: 'roleApplication',
        userId: userId,
        phone: phone,
        name: name,
        role: role,
        status: 'pending',
        createTime: db.serverDate(),
        read: false
      }
    })
    console.log('[applyRole] 已发送管理员通知')
  } catch (err) {
    console.error('[applyRole] 发送通知失败:', err)
  }
  
  return {
    code: 0,
    message: '申请已提交，请等待管理员审批',
    data: {
      status: 'pending',
      role
    }
  }
}

/**
 * 获取角色申请状态
 */
async function getRoleApplicationStatus(openid, data) {
  const { role } = data
  
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: 0, data: { hasApplication: false } }
  }
  
  const user = userRes.data[0]
  
  // 角色隔离：只检查已通过审批的角色
  const validRoles = getValidatedRoles(user)
  if (validRoles.includes(role)) {
    return {
      code: 0,
      data: {
        hasRole: true,
        status: 'active',
        role
      }
    }
  }
  
  // 检查申请记录
  const roleApps = user.roleApplications || []
  const app = roleApps.find(a => a.role === role)
  
  if (app) {
    return {
      code: 0,
      data: {
        hasApplication: true,
        status: app.status,
        role,
        applyTime: app.applyTime,
        rejectReason: app.rejectReason
      }
    }
  }
  
  return { code: 0, data: { hasApplication: false } }
}

/**
 * 检查角色访问权限
 */
async function checkRoleAccess(openid, data) {
  const { role } = data
  
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  
  // 角色隔离：只检查已通过审批的角色
  const validRoles = getValidatedRoles(user)
  
  // 已有该角色（且已通过审批）
  if (validRoles.includes(role)) {
    return {
      code: 0,
      data: {
        hasAccess: true,
        status: 'active'
      }
    }
  }
  
  // 检查申请状态
  const roleApps = user.roleApplications || []
  const app = roleApps.find(a => a.role === role)
  
  if (app) {
    if (app.status === 'pending') {
      return {
        code: 0,
        data: {
          hasAccess: false,
          status: 'pending',
          message: '您的申请正在审核中，请耐心等待'
        }
      }
    } else if (app.status === 'rejected') {
      return {
        code: 0,
        data: {
          hasAccess: false,
          status: 'rejected',
          rejectReason: app.rejectReason,
          message: '您的申请被拒绝'
        }
      }
    }
  }
  
  return {
    code: 0,
    data: {
      hasAccess: false,
      status: 'none',
      message: '您尚未申请该角色'
    }
  }
}

/**
 * 创建手艺人记录
 */
async function createCraftsmanRecord(openid, userId, data, isActive) {
  const { name, phone, specialty = '', experience = '', address = '', wechatId = '', idCard = '' } = data
  
  await db.collection('craftsmen').add({
    data: {
      userId,
      openid,
      name,
      phone,
      wechatId,
      specialty,
      experience,
      address,
      idCard,
      starLevel: 3,
      performance: '良好',
      totalOrders: 0,
      completedOrders: 0,
      rating: 5.0,
      status: isActive ? 'active' : 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
}

/**
 * 创建派单人记录
 */
async function createDispatcherRecord(openid, userId, data, isActive) {
  const { name, phone, company = '', experience = '', wechatId = '' } = data
  
  await db.collection('dispatchers').add({
    data: {
      userId,
      openid,
      name,
      phone,
      wechatId,
      company,
      experience,
      status: isActive ? 'active' : 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
}

/**
 * 初始化管理员账号
 * 硬编码管理员手机号：13810062394
 */
async function initAdmin(data) {
  const { phone, password, name = '管理员' } = data
  
  // 验证手机号是否为管理员手机号
  if (phone !== ADMIN_PHONE) {
    return { code: -1, message: '非管理员手机号' }
  }
  
  // 检查是否已存在
  const userRes = await db.collection('users').where({ phone }).get()
  
  const hashedPassword = hashPassword(password)
  
  if (userRes.data.length > 0) {
    // 更新现有管理员账号
    const user = userRes.data[0]
    const updateData = {
      password: hashedPassword,
      roles: ['admin', 'dispatcher'], // 管理员同时有派单人角色
      role: 'admin',
      currentRole: 'admin',
      isAdmin: true,
      status: 'active',
      'roleApplications.0.status': 'active',
      updateTime: db.serverDate()
    }
    
    await db.collection('users').doc(user._id).update({ data: updateData })
    
    return {
      code: 0,
      message: '管理员账号已更新',
      data: { phone, isAdmin: true }
    }
  } else {
    // 创建新的管理员账号
    const newUser = {
      openid: '', // 等待微信绑定
      phone,
      name,
      password: hashedPassword,
      roles: ['admin', 'dispatcher'],
      role: 'admin',
      currentRole: 'admin',
      isAdmin: true,
      status: 'active',
      roleApplications: [{
        role: 'admin',
        status: 'active',
        applyTime: db.serverDate(),
        approveTime: db.serverDate(),
        approveBy: 'system'
      }, {
        role: 'dispatcher',
        status: 'active',
        applyTime: db.serverDate(),
        approveTime: db.serverDate(),
        approveBy: 'system'
      }],
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
    
    const userRes = await db.collection('users').add({ data: newUser })
    
    // 创建派单人记录
    await db.collection('dispatchers').add({
      data: {
        userId: userRes._id,
        openid: '',
        name,
        phone,
        company: '平台管理员',
        experience: '多年管理经验',
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    return {
      code: 0,
      message: '管理员账号已创建',
      data: { phone, isAdmin: true }
    }
  }
}
