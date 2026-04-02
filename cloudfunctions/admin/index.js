const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 管理员手机号
const ADMIN_PHONE = '13810062394'

// 检查是否为管理员
async function checkAdmin(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length > 0 && userRes.data[0].role === 'admin') {
    return true
  }
  
  // 检查是否是管理员手机号
  const craftsmanRes = await db.collection('craftsmen').where({ openid, phone: ADMIN_PHONE }).get()
  const dispatcherRes = await db.collection('dispatchers').where({ openid, phone: ADMIN_PHONE }).get()
  
  if (craftsmanRes.data.length > 0 || dispatcherRes.data.length > 0) {
    // 更新用户为管理员
    if (userRes.data.length > 0) {
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: { role: 'admin', updateTime: db.serverDate() }
      })
    }
    return true
  }
  
  return false
}

exports.main = async (event, context) => {
  const { action, data } = event
  const { OPENID } = cloud.getWXContext()
  
  // 检查管理员权限
  const isAdmin = await checkAdmin(OPENID)
  if (!isAdmin && action !== 'isAdmin') {
    return { code: -1, message: '无权限访问' }
  }
  
  try {
    switch (action) {
      case 'isAdmin':
        return { code: 0, isAdmin }
      case 'getCraftsmanList':
        return await getCraftsmanList()
      case 'getCraftsmanDetail':
        return await getCraftsmanDetail(data)
      case 'getDispatcherList':
        return await getDispatcherList()
      case 'getDispatcherDetail':
        return await getDispatcherDetail(data)
      case 'getPendingList':
        return await getPendingList()
      case 'getPendingDispatchers':
        return await getPendingDispatchers()
      case 'reviewCraftsman':
        return await reviewCraftsman(data)
      case 'reviewDispatcher':
        return await reviewDispatcher(data)
      // 新角色申请审批系统
      case 'getRoleApplications':
        return await getRoleApplications(data)
      case 'reviewRoleApplication':
        return await reviewRoleApplication(OPENID, data)
      case 'deleteCraftsman':
        return await deleteCraftsman(data)
      case 'deleteDispatcher':
        return await deleteDispatcher(data)
      case 'updateDispatcher':
        return await updateDispatcher(data)
      case 'getStats':
        return await getStats()
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 获取手艺人列表
async function getCraftsmanList() {
  const list = await db.collection('craftsmen')
    .orderBy('createTime', 'desc')
    .get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 获取手艺人详情
async function getCraftsmanDetail(data) {
  const { craftsmanId } = data
  
  const craftsman = await db.collection('craftsmen').doc(craftsmanId).get()
  
  if (!craftsman.data) {
    return { code: -1, message: '手艺人不存在' }
  }
  
  return {
    code: 0,
    data: craftsman.data
  }
}

// 获取派单人列表
async function getDispatcherList() {
  const list = await db.collection('dispatchers')
    .orderBy('createTime', 'desc')
    .get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 获取派单人详情
async function getDispatcherDetail(data) {
  const { dispatcherId } = data
  
  const dispatcher = await db.collection('dispatchers').doc(dispatcherId).get()
  
  if (!dispatcher.data) {
    return { code: -1, message: '派单人不存在' }
  }
  
  return {
    code: 0,
    data: dispatcher.data
  }
}

// 获取待审核列表
async function getPendingList() {
  const list = await db.collection('craftsmen')
    .where({
      status: 'pending'
    })
    .orderBy('createTime', 'desc')
    .get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 审核手艺人
async function reviewCraftsman(data) {
  const { craftsmanId, approved, reason } = data
  
  // 获取手艺人信息
  const craftsman = await db.collection('craftsmen').doc(craftsmanId).get()
  if (!craftsman.data) {
    return { code: -1, message: '手艺人不存在' }
  }
  
  const { openid } = craftsman.data
  
  if (approved) {
    // 通过审核
    await db.collection('craftsmen').doc(craftsmanId).update({
      data: {
        status: 'active',
        updateTime: db.serverDate()
      }
    })
    
    // 更新用户角色状态
    await db.collection('users').where({ openid }).update({
      data: {
        status: 'active',
        updateTime: db.serverDate()
      }
    })
  } else {
    // 拒绝审核
    await db.collection('craftsmen').doc(craftsmanId).update({
      data: {
        status: 'rejected',
        rejectReason: reason,
        updateTime: db.serverDate()
      }
    })
  }
  
  return {
    code: 0,
    message: approved ? '已通过' : '已拒绝'
  }
}

// 删除手艺人
async function deleteCraftsman(data) {
  const { craftsmanId } = data
  
  // 获取手艺人信息
  const craftsman = await db.collection('craftsmen').doc(craftsmanId).get()
  if (!craftsman.data) {
    return { code: -1, message: '手艺人不存在' }
  }
  
  const { openid, phone } = craftsman.data
  
  // 不能删除管理员
  if (phone === ADMIN_PHONE) {
    return { code: -1, message: '不能删除管理员账号' }
  }
  
  // 删除手艺人记录
  await db.collection('craftsmen').doc(craftsmanId).remove()
  
  // 更新用户角色为游客
  await db.collection('users').where({ openid }).update({
    data: {
      role: 'guest',
      status: 'pending',
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '删除成功' }
}

// 删除派单人
async function deleteDispatcher(data) {
  const { dispatcherId } = data
  
  // 获取派单人信息
  const dispatcher = await db.collection('dispatchers').doc(dispatcherId).get()
  if (!dispatcher.data) {
    return { code: -1, message: '派单人不存在' }
  }
  
  const { openid, phone } = dispatcher.data
  
  // 不能删除管理员
  if (phone === ADMIN_PHONE) {
    return { code: -1, message: '不能删除管理员账号' }
  }
  
  // 删除派单人记录
  await db.collection('dispatchers').doc(dispatcherId).remove()
  
  // 更新用户角色为游客
  await db.collection('users').where({ openid }).update({
    data: {
      role: 'guest',
      status: 'pending',
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '删除成功' }
}

// 更新派单人
async function updateDispatcher(data) {
  const { id, name, phone, wechatId, company } = data
  
  if (!id) {
    return { code: -1, message: '缺少派单人ID' }
  }
  
  if (!name || !name.trim()) {
    return { code: -1, message: '姓名不能为空' }
  }
  
  const updateData = {
    name: name.trim(),
    phone: phone || '',
    wechatId: wechatId || '',
    company: company || '',
    updateTime: db.serverDate()
  }
  
  await db.collection('dispatchers').doc(id).update({ data: updateData })
  
  return { code: 0, message: '更新成功' }
}

// 获取待审核派单人列表
async function getPendingDispatchers() {
  const res = await db.collection('dispatchers')
    .where({ status: 'pending' })
    .orderBy('createTime', 'desc')
    .get()
  
  return {
    code: 0,
    data: res.data
  }
}

// 审批派单人
async function reviewDispatcher(data) {
  const { dispatcherId, approved, reason = '' } = data
  
  if (!dispatcherId) {
    return { code: -1, message: '缺少派单人ID' }
  }
  
  const dispatcher = await db.collection('dispatchers').doc(dispatcherId).get()
  if (!dispatcher.data) {
    return { code: -1, message: '派单人不存在' }
  }
  
  const updateData = {
    status: approved ? 'active' : 'rejected',
    updateTime: db.serverDate()
  }
  
  if (!approved) {
    updateData.rejectReason = reason
  }
  
  await db.collection('dispatchers').doc(dispatcherId).update({ data: updateData })
  
  // 如果通过审核，更新用户角色
  if (approved) {
    const openid = dispatcher.data.openid
    const userRes = await db.collection('users').where({ openid }).get()
    
    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      const roles = user.roles || [user.role]
      
      if (!roles.includes('dispatcher')) {
        roles.push('dispatcher')
      }
      
      await db.collection('users').doc(user._id).update({
        data: {
          roles,
          currentRole: 'dispatcher',
          updateTime: db.serverDate()
        }
      })
    }
  }
  
  return { 
    code: 0, 
    message: approved ? '已通过审核' : '已拒绝申请',
    data: { status: approved ? 'active' : 'rejected' }
  }
}

// 获取统计数据
async function getStats() {
  const craftsmanCount = await db.collection('craftsmen').count()
  const dispatcherCount = await db.collection('dispatchers').count()
  const pendingCraftsmanCount = await db.collection('craftsmen').where({ status: 'pending' }).count()
  const pendingDispatcherCount = await db.collection('dispatchers').where({ status: 'pending' }).count()
  
  return {
    code: 0,
    data: {
      craftsmanCount: craftsmanCount.total,
      dispatcherCount: dispatcherCount.total,
      pendingCount: pendingCraftsmanCount.total + pendingDispatcherCount.total
    }
  }
}

// ==================== 新角色申请审批系统 ====================

/**
 * 获取角色申请列表（从 users 表查询）
 */
async function getRoleApplications(data) {
  const { status = 'pending', role = '' } = data
  
  // 查询所有有待审批申请的用户
  const userRes = await db.collection('users').get()
  
  let applications = []
  
  userRes.data.forEach(user => {
    const roleApps = user.roleApplications || []
    roleApps.forEach(app => {
      if (app.status === status) {
        // 如果指定了角色，只返回该角色的申请
        if (!role || app.role === role) {
          applications.push({
            _id: `${user._id}_${app.role}`,  // 生成唯一ID
            userId: user._id,
            openid: user.openid,
            phone: user.phone,
            name: user.name || app.applyData?.name,
            role: app.role,
            status: app.status,
            applyData: app.applyData,
            applyTime: app.applyTime,
            approveTime: app.approveTime,
            rejectReason: app.rejectReason
          })
        }
      }
    })
  })
  
  // 按申请时间排序
  applications.sort((a, b) => b.applyTime - a.applyTime)
  
  return {
    code: 0,
    data: applications
  }
}

/**
 * 审批角色申请（直接从 users 表更新）
 */
async function reviewRoleApplication(adminOpenid, data) {
  const { applicationId, approved, reason = '' } = data
  
  if (!applicationId) {
    return { code: -1, message: '缺少申请ID' }
  }
  
  // 从 applicationId 解析 userId 和 role
  // applicationId 格式：userId_role
  const lastUnderscoreIndex = applicationId.lastIndexOf('_')
  if (lastUnderscoreIndex === -1) {
    return { code: -1, message: '无效的申请ID' }
  }
  
  const userId = applicationId.substring(0, lastUnderscoreIndex)
  const role = applicationId.substring(lastUnderscoreIndex + 1)
  
  // 获取用户信息
  const userRes = await db.collection('users').doc(userId).get()
  if (!userRes.data) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data
  let roleApps = user.roleApplications || []
  
  // 找到对应的申请记录
  const appIndex = roleApps.findIndex(a => a.role === role)
  if (appIndex === -1) {
    return { code: -1, message: '申请记录不存在' }
  }
  
  const application = roleApps[appIndex]
  const { applyData, applyData: { name, phone } = {} } = application
  
  // 更新申请记录
  roleApps[appIndex].status = approved ? 'active' : 'rejected'
  roleApps[appIndex].approveTime = db.serverDate()
  roleApps[appIndex].approveBy = adminOpenid
  roleApps[appIndex].rejectReason = approved ? '' : reason
  
  const updateData = {
    roleApplications: roleApps,
    updateTime: db.serverDate()
  }
  
  // 如果通过，添加角色到 roles
  if (approved) {
    const roles = user.roles || [user.role]
    if (!roles.includes(role)) {
      roles.push(role)
      updateData.roles = roles
    }
    
    // 创建对应的角色详情记录
    if (role === 'craftsman') {
      await createCraftsmanFromApplication(userId, user.openid, { 
        name: name || user.name, 
        phone: phone || user.phone, 
        ...applyData 
      })
    } else if (role === 'dispatcher') {
      await createDispatcherFromApplication(userId, user.openid, { 
        name: name || user.name, 
        phone: phone || user.phone, 
        ...applyData 
      })
    }
  }
  
  await db.collection('users').doc(userId).update({ data: updateData })
  
  return {
    code: 0,
    message: approved ? '审批通过' : '已拒绝',
    data: {
      status: approved ? 'active' : 'rejected',
      role
    }
  }
}

/**
 * 从申请创建手艺人记录
 */
async function createCraftsmanFromApplication(userId, openid, data) {
  const { name, phone, specialty = '', experience = '', address = '', wechatId = '' } = data
  
  // 检查是否已存在（按手机号检查更可靠）
  const existRes = await db.collection('craftsmen').where({ phone }).get()
  if (existRes.data.length > 0) {
    // 更新状态和openid
    await db.collection('craftsmen').doc(existRes.data[0]._id).update({
      data: {
        status: 'active',
        openid: openid || existRes.data[0].openid,
        updateTime: db.serverDate()
      }
    })
    return
  }
  
  // 检查openid是否已存在（避免重复）
  if (openid) {
    const openidRes = await db.collection('craftsmen').where({ openid }).get()
    if (openidRes.data.length > 0) {
      // 更新状态
      await db.collection('craftsmen').doc(openidRes.data[0]._id).update({
        data: {
          status: 'active',
          updateTime: db.serverDate()
        }
      })
      return
    }
  }
  
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
      starLevel: 3,
      performance: '良好',
      totalOrders: 0,
      completedOrders: 0,
      rating: 5.0,
      status: 'active',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
}

/**
 * 从申请创建派单人记录
 */
async function createDispatcherFromApplication(userId, openid, data) {
  const { name, phone, company = '', experience = '', wechatId = '' } = data
  
  // 检查是否已存在（按手机号检查更可靠）
  const existRes = await db.collection('dispatchers').where({ phone }).get()
  if (existRes.data.length > 0) {
    // 更新状态和openid
    await db.collection('dispatchers').doc(existRes.data[0]._id).update({
      data: {
        status: 'active',
        openid: openid || existRes.data[0].openid,
        updateTime: db.serverDate()
      }
    })
    return
  }
  
  // 检查openid是否已存在（避免重复）
  if (openid) {
    const openidRes = await db.collection('dispatchers').where({ openid }).get()
    if (openidRes.data.length > 0) {
      // 更新状态
      await db.collection('dispatchers').doc(openidRes.data[0]._id).update({
        data: {
          status: 'active',
          updateTime: db.serverDate()
        }
      })
      return
    }
  }
  
  await db.collection('dispatchers').add({
    data: {
      userId,
      openid,
      name,
      phone,
      wechatId,
      company,
      experience,
      status: 'active',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
}
