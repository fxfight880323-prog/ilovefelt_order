const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ========== 工具函数 ==========

// 获取用户角色信息
async function getUserRole(openid) {
  const res = await db.collection('users')
    .where({ openid: openid })
    .limit(1)
    .get()
  
  if (!res.data.length) {
    return { 
      role: null, 
      roles: [],
      approved: false,
      userInfo: null 
    }
  }
  
  const user = res.data[0]
  const roles = user.roles || [user.role].filter(Boolean)
  
  return { 
    role: user.currentRole || user.role || null,
    roles: roles,
    approved: roles.length > 0 || user.status === 'active',
    userInfo: user
  }
}

// 检查是否为管理员
async function isAdmin(openid) {
  const { roles } = await getUserRole(openid)
  return roles.includes('admin')
}

// 统一返回格式
function success(data = null, msg = '操作成功') {
  return { success: true, code: 0, data, msg }
}

function error(msg = '操作失败', code = -1) {
  return { success: false, code, msg }
}

// ========== 主入口 ==========

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { module, action, data = {} } = event

  console.log(`[API] ${module}.${action} OPENID: ${OPENID}`)

  try {
    // ========== 注册模块 ==========
    if (module === 'auth') {
      return await handleAuth(action, data, OPENID)
    }

    // ========== 审批模块（管理员） ==========
    if (module === 'admin') {
      return await handleAdmin(action, data, OPENID)
    }

    // ========== 订单模块 ==========
    if (module === 'order') {
      return await handleOrder(action, data, OPENID)
    }

    // ========== 用户模块 ==========
    if (module === 'user') {
      return await handleUser(action, data, OPENID)
    }

    return error('未知模块: ' + module)

  } catch (err) {
    console.error(`[API Error] ${module}.${action}:`, err)
    return error(err.message || '服务器内部错误')
  }
}

// ========== 注册/认证模块 ==========
async function handleAuth(action, data, OPENID) {
  // 检查是否已注册
  if (action === 'checkStatus') {
    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    
    if (userRes.data.length === 0) {
      return success({ registered: false, approved: false }, '未注册')
    }
    
    const user = userRes.data[0]
    const roleApps = user.roleApplications || []
    const activeRoles = roleApps.filter(app => app.status === 'active').map(app => app.role)
    const pendingRoles = roleApps.filter(app => app.status === 'pending').map(app => app.role)
    
    return success({
      registered: true,
      approved: activeRoles.length > 0,
      roles: activeRoles,
      pendingRoles: pendingRoles,
      currentRole: user.currentRole || activeRoles[0] || null,
      phone: user.phone
    }, '已注册')
  }

  // 新用户注册
  if (action === 'register') {
    const { name, phone, requestRole, password, ...extraData } = data
    
    if (!name || !phone || !requestRole) {
      return error('缺少必要信息')
    }
    
    if (!['craftsman', 'dispatcher'].includes(requestRole)) {
      return error('无效的角色类型')
    }

    // 检查是否已存在（按openid）
    const existingByOpenid = await db.collection('users').where({ openid: OPENID }).get()
    
    // 如果已存在该openid用户
    if (existingByOpenid.data.length > 0) {
      const user = existingByOpenid.data[0]
      const roleApps = user.roleApplications || []
      const existingApp = roleApps.find(app => app.role === requestRole)
      
      // 已审批通过 → 直接登录
      if (existingApp && existingApp.status === 'active') {
        return success({
          registered: true,
          approved: true,
          roles: [requestRole],
          phone: user.phone,
          name: user.name
        }, '已审批通过，可直接登录')
      }
      
      // 检查是否有被拒绝的记录
      if (existingApp && existingApp.status === 'rejected') {
        // 被拒绝过，允许重新提交
        // 更新旧申请状态
        const updatedApps = roleApps.map(app => {
          if (app.role === requestRole) {
            return {
              ...app,
              status: 'pending',
              applyTime: db.serverDate(),
              applyData: { name, phone, ...extraData },
              rejectReason: '' // 清空拒绝原因
            }
          }
          return app
        })
        
        await db.collection('users').doc(user._id).update({
          data: {
            name,
            phone,
            roleApplications: updatedApps,
            updateTime: db.serverDate()
          }
        })
        
        // 重新创建申请记录（如果集合存在）
        try {
          await db.collection('adminNotifications').add({
            data: {
              type: 'roleApplication',
              userId: user._id,
              phone,
              name,
              role: requestRole,
              status: 'pending',
              read: false,
              createTime: db.serverDate()
            }
          })
        } catch (e) {
          console.log('adminNotifications 集合不存在，跳过')
        }
        
        return success(null, '已重新提交申请，等待管理员审批')
      }
      
      // 审核中
      if (existingApp && existingApp.status === 'pending') {
        return error('您的申请正在审核中，请耐心等待', -1002)
      }
      
      // 已有用户，申请新角色
      const newApplication = {
        role: requestRole,
        status: 'pending',
        applyTime: db.serverDate(),
        applyData: extraData
      }
      
      await db.collection('users').doc(user._id).update({
        data: {
          roleApplications: _.push([newApplication]),
          updateTime: db.serverDate()
        }
      })
      
      await createRoleDetail(requestRole, user._id, OPENID, { name, phone, ...extraData })
      
      return success(null, '申请已提交，等待管理员审批')
    }

    // 检查是否已存在（按手机号）- 处理换设备登录的情况
    const existingByPhone = await db.collection('users').where({ phone }).get()
    if (existingByPhone.data.length > 0) {
      // 手机号已存在，更新openid并检查角色
      const user = existingByPhone.data[0]
      const roleApps = user.roleApplications || []
      const existingApp = roleApps.find(app => app.role === requestRole)
      
      if (existingApp) {
        if (existingApp.status === 'active') {
          return error('该手机号已注册此角色，请直接登录')
        } else if (existingApp.status === 'pending') {
          return error('您的申请正在审核中，请耐心等待', -1002)
        } else if (existingApp.status === 'rejected') {
          // 被拒绝，允许重新申请
          const updatedApps = roleApps.map(app => {
            if (app.role === requestRole) {
              return {
                ...app,
                status: 'pending',
                applyTime: db.serverDate(),
                applyData: { name, phone, ...extraData }
              }
            }
            return app
          })
          
          await db.collection('users').doc(user._id).update({
            data: {
              openid: OPENID, // 更新openid
              roleApplications: updatedApps,
              updateTime: db.serverDate()
            }
          })
          
          return success(null, '已重新提交申请，等待管理员审批')
        }
      }
      
      // 手机号已存在，但申请新角色
      return error('该手机号已注册，请使用其他手机号或直接登录')
    }

    // 全新用户
    const newUser = {
      openid: OPENID,
      phone,
      name,
      roles: [],
      currentRole: '',
      roleApplications: [{
        role: requestRole,
        status: 'pending',
        applyTime: db.serverDate(),
        applyData: extraData
      }],
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
    
    if (password) {
      newUser.password = require('crypto').createHash('sha256').update(password).digest('hex')
    }

    const userRes = await db.collection('users').add({ data: newUser })
    
    // 创建角色详情记录
    await createRoleDetail(requestRole, userRes._id, OPENID, { name, phone, ...extraData })
    
    // 创建管理员通知（如果集合存在）
    try {
      await db.collection('adminNotifications').add({
        data: {
          type: 'roleApplication',
          userId: userRes._id,
          phone,
          name,
          role: requestRole,
          status: 'pending',
          read: false,
          createTime: db.serverDate()
        }
      })
    } catch (e) {
      // 集合不存在时忽略
      console.log('adminNotifications 集合不存在，跳过通知创建')
    }

    return success(null, '注册成功，等待管理员审批')
  }

  // 手机号登录
  if (action === 'loginByPhone') {
    const { phone, password } = data
    
    if (!phone || !password) {
      return error('请输入手机号和密码')
    }

    const userRes = await db.collection('users').where({ phone }).get()
    if (userRes.data.length === 0) {
      return error('该手机号未注册')
    }

    const user = userRes.data[0]
    const hashedPassword = require('crypto').createHash('sha256').update(password).digest('hex')
    
    if (user.password !== hashedPassword) {
      return error('密码错误')
    }

    // 更新openid（如果换了设备登录）
    if (user.openid !== OPENID) {
      await db.collection('users').doc(user._id).update({
        data: { openid: OPENID, updateTime: db.serverDate() }
      })
    }

    // 检查角色状态
    const roleApps = user.roleApplications || []
    const activeRoles = roleApps.filter(app => app.status === 'active').map(app => app.role)
    const pendingRoles = roleApps.filter(app => app.status === 'pending').map(app => app.role)

    if (activeRoles.length === 0) {
      if (pendingRoles.length > 0) {
        return error('您的申请正在审核中，请耐心等待', -1002)
      }
      return error('您的账号尚未通过审批', -1003)
    }

    return success({
      roles: activeRoles,
      pendingRoles: pendingRoles,
      currentRole: user.currentRole || activeRoles[0],
      phone: user.phone,
      name: user.name
    }, '登录成功')
  }

  return error('未知操作: ' + action)
}

// ========== 管理员模块 ==========
async function handleAdmin(action, data, OPENID) {
  // 检查管理员权限
  if (!await isAdmin(OPENID)) {
    return error('无管理员权限')
  }

  // 获取待审批列表
  if (action === 'getPendingRequests') {
    const userRes = await db.collection('users').get()
    
    const applications = []
    userRes.data.forEach(user => {
      const roleApps = user.roleApplications || []
      roleApps.forEach(app => {
        if (app.status === 'pending') {
          applications.push({
            id: `${user._id}_${app.role}`,
            userId: user._id,
            openid: user.openid,
            phone: user.phone,
            name: user.name || app.applyData?.name,
            role: app.role,
            applyData: app.applyData,
            applyTime: app.applyTime,
            status: app.status
          })
        }
      })
    })
    
    applications.sort((a, b) => b.applyTime - a.applyTime)
    return success(applications)
  }

  // 审批通过/拒绝
  if (action === 'approve') {
    const { applicationId, approved, reason = '' } = data
    
    if (!applicationId) {
      return error('缺少申请ID')
    }

    // 解析 applicationId: userId_role
    const lastUnderscore = applicationId.lastIndexOf('_')
    if (lastUnderscore === -1) {
      return error('无效的申请ID')
    }
    
    const userId = applicationId.substring(0, lastUnderscore)
    const role = applicationId.substring(lastUnderscore + 1)

    const userRes = await db.collection('users').doc(userId).get()
    if (!userRes.data) {
      return error('用户不存在')
    }

    const user = userRes.data
    const roleApps = user.roleApplications || []
    const appIndex = roleApps.findIndex(a => a.role === role)
    
    if (appIndex === -1) {
      return error('申请记录不存在')
    }

    // 更新申请状态
    roleApps[appIndex].status = approved ? 'active' : 'rejected'
    roleApps[appIndex].approveTime = db.serverDate()
    roleApps[appIndex].approveBy = OPENID
    if (!approved) {
      roleApps[appIndex].rejectReason = reason
    }

    const updateData = {
      roleApplications: roleApps,
      updateTime: db.serverDate()
    }

    // 如果通过，添加角色
    if (approved) {
      const currentRoles = user.roles || []
      if (!currentRoles.includes(role)) {
        currentRoles.push(role)
        updateData.roles = currentRoles
      }
      
      // 激活角色详情记录
      await activateRoleDetail(role, user.openid, userId)
    }

    await db.collection('users').doc(userId).update({ data: updateData })

    return success({ 
      status: approved ? 'active' : 'rejected',
      role 
    }, approved ? '审批通过' : '已拒绝')
  }

  // 获取统计数据
  if (action === 'getStats') {
    const userCount = await db.collection('users').count()
    const craftsmanCount = await db.collection('craftsmen').count()
    const dispatcherCount = await db.collection('dispatchers').count()
    const orderCount = await db.collection('orders').count()
    
    return success({
      userCount: userCount.total,
      craftsmanCount: craftsmanCount.total,
      dispatcherCount: dispatcherCount.total,
      orderCount: orderCount.total
    })
  }

  return error('未知操作: ' + action)
}

// ========== 订单模块 ==========
async function handleOrder(action, data, OPENID) {
  const { role, roles, approved } = await getUserRole(OPENID)
  
  if (!approved) {
    return error('账号未审批')
  }

  // 创建订单
  if (action === 'create') {
    if (!roles.includes('dispatcher') && !roles.includes('admin')) {
      return error('无权创建订单')
    }

    const { name, styleId, styleName, quantity, price, receiveDate, remark } = data
    
    if (!name || !quantity || !price) {
      return error('缺少必要信息')
    }

    // 生成订单编号
    const orderCode = generateOrderCode()

    const orderData = {
      orderCode,
      name,
      styleId: styleId || '',
      styleName: styleName || '',
      quantity: parseInt(quantity),
      price: parseFloat(price),
      totalPrice: parseFloat(price) * parseInt(quantity),
      receiveDate: receiveDate ? new Date(receiveDate) : null,
      remark: remark || '',
      dispatcherId: OPENID,
      dispatcherName: data.dispatcherName || '',
      craftsmanId: '',
      craftsmanName: '',
      status: 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    const res = await db.collection('orders').add({ data: orderData })
    return success({ orderId: res._id, orderCode }, '订单创建成功')
  }

  // 获取订单列表
  if (action === 'list') {
    let where = {}
    
    if (roles.includes('craftsman')) {
      // 手艺人看自己的订单或待接单
      const craftsmanRes = await db.collection('craftsmen').where({ openid: OPENID }).get()
      if (craftsmanRes.data.length > 0) {
        const craftsmanId = craftsmanRes.data[0]._id
        where = _.or([
          { craftsmanId },
          { status: 'pending' }
        ])
      }
    } else if (roles.includes('dispatcher')) {
      // 派单人看自己创建的订单
      where = { dispatcherId: OPENID }
    }
    // admin看全部

    const res = await db.collection('orders')
      .where(where)
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
    
    return success(res.data)
  }

  // 获取订单详情
  if (action === 'getDetail') {
    const { orderId } = data
    if (!orderId) return error('缺少订单ID')

    const res = await db.collection('orders').doc(orderId).get()
    if (!res.data) return error('订单不存在')

    return success(res.data)
  }

  // 接单
  if (action === 'accept') {
    if (!roles.includes('craftsman')) {
      return error('非手艺人')
    }

    const { orderId } = data
    const order = (await db.collection('orders').doc(orderId).get()).data
    
    if (!order) return error('订单不存在')
    if (order.status !== 'pending') return error('该订单已被接')

    const craftsmanRes = await db.collection('craftsmen').where({ openid: OPENID }).get()
    if (craftsmanRes.data.length === 0) return error('手艺人信息不存在')
    
    const craftsman = craftsmanRes.data[0]

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'accepted',
        craftsmanId: craftsman._id,
        craftsmanName: craftsman.name,
        acceptTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    // 更新手艺人接单数
    await db.collection('craftsmen').doc(craftsman._id).update({
      data: {
        totalOrders: _.inc(1),
        updateTime: db.serverDate()
      }
    })

    return success(null, '接单成功')
  }

  // 取消订单
  if (action === 'cancel') {
    const { orderId, reason } = data
    const order = (await db.collection('orders').doc(orderId).get()).data
    
    if (!order) return error('订单不存在')
    
    // 权限检查
    const canCancel = 
      roles.includes('admin') ||
      (order.dispatcherId === OPENID && ['pending'].includes(order.status)) ||
      (order.craftsmanId && order.status === 'accepted')
    
    if (!canCancel) return error('无权取消')

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'cancelled',
        cancelReason: reason || '',
        cancelledBy: OPENID,
        cancelTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    // 如果已接单，更新手艺人统计
    if (order.craftsmanId && order.status === 'accepted') {
      await db.collection('craftsmen').doc(order.craftsmanId).update({
        data: {
          totalOrders: _.inc(-1),
          updateTime: db.serverDate()
        }
      })
    }

    return success(null, '订单已取消')
  }

  // 完成订单
  if (action === 'complete') {
    if (!roles.includes('craftsman')) {
      return error('非手艺人')
    }

    const { orderId, photos = [] } = data
    const order = (await db.collection('orders').doc(orderId).get()).data
    
    if (!order) return error('订单不存在')
    if (order.status !== 'accepted') return error('订单状态不可完成')

    const craftsmanRes = await db.collection('craftsmen').where({ openid: OPENID }).get()
    if (craftsmanRes.data.length === 0 || order.craftsmanId !== craftsmanRes.data[0]._id) {
      return error('无权操作')
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'completed',
        completePhotos: photos,
        completeTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    // 更新手艺人完成数
    await db.collection('craftsmen').doc(order.craftsmanId).update({
      data: {
        completedOrders: _.inc(1),
        updateTime: db.serverDate()
      }
    })

    return success(null, '订单已完成')
  }

  // 获取手艺人列表（用于派单选择）
  if (action === 'getCraftsmen') {
    const res = await db.collection('craftsmen')
      .where({ status: 'active' })
      .orderBy('starLevel', 'desc')
      .get()
    
    return success(res.data)
  }

  return error('未知操作: ' + action)
}

// ========== 用户模块 ==========
async function handleUser(action, data, OPENID) {
  if (action === 'getInfo') {
    const { role, roles, userInfo } = await getUserRole(OPENID)
    
    if (!userInfo) {
      return error('用户不存在')
    }

    // 获取角色详情
    const rolesInfo = {}
    
    if (roles.includes('craftsman')) {
      const cRes = await db.collection('craftsmen').where({ openid: OPENID }).get()
      if (cRes.data.length > 0) {
        rolesInfo.craftsman = cRes.data[0]
      }
    }
    
    if (roles.includes('dispatcher')) {
      const dRes = await db.collection('dispatchers').where({ openid: OPENID }).get()
      if (dRes.data.length > 0) {
        rolesInfo.dispatcher = dRes.data[0]
      }
    }

    return success({
      openid: OPENID,
      phone: userInfo.phone,
      name: userInfo.name,
      roles,
      currentRole: userInfo.currentRole || roles[0],
      rolesInfo
    })
  }

  if (action === 'switchRole') {
    const { role } = data
    const { roles } = await getUserRole(OPENID)
    
    if (!roles.includes(role)) {
      return error('无权切换到该角色')
    }

    await db.collection('users').where({ openid: OPENID }).update({
      data: {
        currentRole: role,
        updateTime: db.serverDate()
      }
    })

    return success(null, '切换成功')
  }

  return error('未知操作: ' + action)
}

// ========== 辅助函数 ==========

// 生成订单编号
function generateOrderCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const letter1 = letters[Math.floor(Math.random() * letters.length)]
  const letter2 = letters[Math.floor(Math.random() * letters.length)]
  
  const now = new Date()
  const year = String(now.getFullYear()).slice(2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  
  return letter1 + letter2 + year + month + day + random
}

// 创建角色详情记录
async function createRoleDetail(role, userId, openid, data) {
  const { name, phone, ...extra } = data
  
  if (role === 'craftsman') {
    const exist = await db.collection('craftsmen').where({ phone }).get()
    if (exist.data.length > 0) {
      // 更新现有记录
      await db.collection('craftsmen').doc(exist.data[0]._id).update({
        data: {
          userId,
          openid,
          status: 'pending',
          updateTime: db.serverDate()
        }
      })
      return
    }
    
    await db.collection('craftsmen').add({
      data: {
        userId,
        openid,
        name,
        phone,
        specialty: extra.specialty || '',
        experience: extra.experience || '',
        starLevel: 3,
        status: 'pending',
        totalOrders: 0,
        completedOrders: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
  } else if (role === 'dispatcher') {
    const exist = await db.collection('dispatchers').where({ phone }).get()
    if (exist.data.length > 0) {
      await db.collection('dispatchers').doc(exist.data[0]._id).update({
        data: {
          userId,
          openid,
          status: 'pending',
          updateTime: db.serverDate()
        }
      })
      return
    }
    
    await db.collection('dispatchers').add({
      data: {
        userId,
        openid,
        name,
        phone,
        company: extra.company || '',
        status: 'pending',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
  }
}

// 激活角色详情记录
async function activateRoleDetail(role, openid, userId) {
  if (role === 'craftsman') {
    const res = await db.collection('craftsmen').where({ openid }).get()
    if (res.data.length > 0) {
      await db.collection('craftsmen').doc(res.data[0]._id).update({
        data: {
          status: 'active',
          updateTime: db.serverDate()
        }
      })
    }
  } else if (role === 'dispatcher') {
    const res = await db.collection('dispatchers').where({ openid }).get()
    if (res.data.length > 0) {
      await db.collection('dispatchers').doc(res.data[0]._id).update({
        data: {
          status: 'active',
          updateTime: db.serverDate()
        }
      })
    }
  }
}
