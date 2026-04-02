/**
 * 统一API云函数 - 派单系统
 * 包含：认证、管理员、订单、用户模块
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 统一响应格式
const success = (data = null, msg = '操作成功') => ({ success: true, code: 0, data, msg })
const error = (msg = '操作失败', code = -1) => ({ success: false, code, msg })

// 密码加密
function encryptPassword(password) {
  const crypto = require('crypto')
  return crypto.createHash('md5').update(password).digest('hex')
}

// 验证密码（支持明文和加密）
function verifyPassword(inputPassword, storedPassword) {
  console.log('[Password Verify] 输入:', inputPassword, '存储:', storedPassword)
  // 如果存储的是明文，直接比较
  if (inputPassword === storedPassword) {
    console.log('[Password Verify] 明文匹配成功')
    return true
  }
  // 如果存储的是MD5加密，比较加密后的值
  const encrypted = encryptPassword(inputPassword)
  console.log('[Password Verify] MD5:', encrypted)
  if (encrypted === storedPassword) {
    console.log('[Password Verify] MD5匹配成功')
    return true
  }
  console.log('[Password Verify] 匹配失败')
  return false
}

// 生成订单号
function generateOrderNo() {
  return 'DD' + Date.now().toString().slice(-10) + Math.random().toString(36).substr(2, 3).toUpperCase()
}

// 获取用户角色
async function getUserRole(openid) {
  if (!openid) return { role: null, user: null }
  
  const { data } = await db.collection('users').where({ openid }).get()
  if (data.length === 0) return { role: null, user: null }
  
  const user = data[0]
  const activeApps = user.roleApplications?.filter(app => app.status === 'active') || []
  
  return {
    role: user.currentRole || (activeApps[0]?.role),
    roles: user.roles || [],
    user,
    isSuperAdmin: user.phone === '13810062394' && user.roles?.includes('admin')
  }
}

// 主入口
exports.main = async (event, context) => {
  const { module, action, ...data } = event
  const { OPENID } = cloud.getWXContext()
  
  console.log(`[API] ${module}.${action} openid=${OPENID}`, data)
  
  try {
    switch (module) {
      case 'auth':
        return await handleAuth(action, data, OPENID)
      case 'admin':
        return await handleAdmin(action, data, OPENID)
      case 'order':
        return await handleOrder(action, data, OPENID)
      case 'user':
        return await handleUser(action, data, OPENID)
      default:
        return error('未知模块')
    }
  } catch (err) {
    console.error(`[API Error] ${module}.${action}:`, err)
    return error(err.message || '系统错误')
  }
}

// 认证模块
async function handleAuth(action, data, openid) {
  switch (action) {
    case 'checkStatus': {
      const { data: users } = await db.collection('users').where({ openid }).get()
      
      if (users.length === 0) {
        return success({ registered: false, approved: false, role: null }, '未注册')
      }
      
      const user = users[0]
      const activeApps = user.roleApplications?.filter(app => app.status === 'active') || []
      const pendingApps = user.roleApplications?.filter(app => app.status === 'pending') || []
      
      const isApproved = activeApps.length > 0
      const currentRole = user.currentRole || (isApproved ? activeApps[0].role : null)
      const pendingRole = pendingApps.length > 0 ? pendingApps[0].role : null
      
      // 超级管理员特殊处理
      const isSuperAdmin = user.phone === '13810062394' && user.roles?.includes('admin')
      
      return success({
        registered: true,
        approved: isApproved,
        role: currentRole,
        roles: user.roles || [],
        pendingRole,
        isSuperAdmin,
        phone: user.phone,
        name: user.name
      }, isApproved ? '已审批通过' : pendingRole ? '审核中' : '未审批')
    }
    
    case 'register': {
      const { phone, password, name, requestRole } = data
      
      if (!phone || !password || !name || !requestRole) {
        return error('缺少必要信息', -1001)
      }
      
      // 验证角色
      if (!['craftsman', 'dispatcher'].includes(requestRole)) {
        return error('无效的角色类型', -1001)
      }
      
      // 检查是否已注册
      const { data: existing } = await db.collection('users').where({ phone }).get()
      
      if (existing.length > 0) {
        const user = existing[0]
        const existingApp = user.roleApplications?.find(app => app.role === requestRole)
        
        if (existingApp) {
          if (existingApp.status === 'active') {
            return success({ approved: true }, '已审批通过')
          }
          if (existingApp.status === 'pending') {
            return error('您的申请正在审核中，请耐心等待', -1002)
          }
          if (existingApp.status === 'rejected') {
            // 更新为待审批
            const updatedApps = user.roleApplications.map(app => 
              app.role === requestRole ? { ...app, status: 'pending', applyTime: new Date() } : app
            )
            await db.collection('users').doc(user._id).update({
              data: { roleApplications: updatedApps }
            })
            return success(null, '已重新提交申请')
          }
        } else {
          // 添加新角色申请
          await db.collection('users').doc(user._id).update({
            data: {
              roleApplications: _.push([{
                role: requestRole,
                status: 'pending',
                applyTime: new Date()
              }])
            }
          })
        }
        
        return success(null, '申请已提交，等待审批')
      }
      
      // 创建新用户
      const newUser = {
        openid,
        phone,
        password: encryptPassword(password),
        name,
        roles: [],
        roleApplications: [{
          role: requestRole,
          status: 'pending',
          applyTime: new Date()
        }],
        currentRole: null,
        createTime: new Date()
      }
      
      await db.collection('users').add({ data: newUser })
      
      // 添加到对应角色集合
      if (requestRole === 'craftsman') {
        await db.collection('craftsmen').add({
          data: {
            openid,
            phone,
            name,
            status: 'pending',
            createTime: new Date()
          }
        })
      } else if (requestRole === 'dispatcher') {
        await db.collection('dispatchers').add({
          data: {
            openid,
            phone,
            name,
            status: 'pending',
            createTime: new Date()
          }
        })
      }
      
      return success(null, '注册成功，请等待审批')
    }
    
    case 'loginByPhone': {
      const { phone, password } = data
      
      console.log('[Login] phone:', phone, 'password:', password)
      
      if (!phone || !password) {
        return error('请输入手机号和密码', -1001)
      }
      
      // 先查找用户
      const { data: users } = await db.collection('users').where({ phone }).get()
      
      console.log('[Login] 找到用户:', users.length)
      
      if (users.length === 0) {
        return error('账号不存在', -1003)
      }
      
      const user = users[0]
      console.log('[Login] 用户密码:', user.password)
      
      // 验证密码（支持明文和加密）
      if (!verifyPassword(password, user.password)) {
        console.log('[Login] 密码验证失败')
        return error('账号或密码错误', -1003)
      }
      
      console.log('[Login] 密码验证成功')
      if (!user.openid) {
        await db.collection('users').doc(user._id).update({ data: { openid } })
      }
      
      // 检查是否有活跃角色
      const activeApps = user.roleApplications?.filter(app => app.status === 'active') || []
      const currentRole = user.currentRole || (activeApps[0]?.role)
      
      // 超级管理员检查
      const isSuperAdmin = phone === '13810062394' && user.roles?.includes('admin')
      
      if (!currentRole && !isSuperAdmin) {
        return error('账号未审批', -1004)
      }
      
      return success({
        phone: user.phone,
        name: user.name,
        roles: user.roles || [],
        currentRole,
        isSuperAdmin
      }, '登录成功')
    }
    
    default:
      return error('未知操作')
  }
}

// 管理员模块
async function handleAdmin(action, data, openid) {
  // 验证超级管理员权限
  const userInfo = await getUserRole(openid)
  if (!userInfo.isSuperAdmin && !userInfo.roles.includes('admin')) {
    return error('无权限访问', -403)
  }
  
  switch (action) {
    case 'getPendingRequests': {
      const { data: users } = await db.collection('users').get()
      
      const pendingList = []
      users.forEach(user => {
        const pendingApps = user.roleApplications?.filter(app => app.status === 'pending') || []
        pendingApps.forEach(app => {
          pendingList.push({
            userId: user._id,
            phone: user.phone,
            name: user.name,
            role: app.role,
            applyTime: app.applyTime
          })
        })
      })
      
      return success({ list: pendingList, total: pendingList.length })
    }
    
    case 'approve': {
      const { userId, role, approved, reason } = data
      
      if (!userId || !role) {
        return error('缺少必要参数')
      }
      
      const { data: users } = await db.collection('users').where({ _id: userId }).get()
      if (users.length === 0) {
        return error('用户不存在')
      }
      
      const user = users[0]
      const roleApps = user.roleApplications || []
      const appIndex = roleApps.findIndex(app => app.role === role && app.status === 'pending')
      
      if (appIndex === -1) {
        return error('未找到待审批的申请')
      }
      
      // 更新申请状态
      roleApps[appIndex].status = approved ? 'active' : 'rejected'
      roleApps[appIndex].reviewTime = new Date()
      roleApps[appIndex].reviewer = openid
      if (reason) roleApps[appIndex].reason = reason
      
      // 如果批准，添加角色
      let newRoles = user.roles || []
      if (approved && !newRoles.includes(role)) {
        newRoles.push(role)
      }
      
      await db.collection('users').doc(userId).update({
        data: {
          roleApplications: roleApps,
          roles: newRoles,
          currentRole: approved ? role : user.currentRole
        }
      })
      
      // 更新角色集合状态
      const targetColl = role === 'craftsman' ? 'craftsmen' : 'dispatchers'
      const { data: roleDocs } = await db.collection(targetColl).where({ phone: user.phone }).get()
      
      if (roleDocs.length > 0) {
        await db.collection(targetColl).doc(roleDocs[0]._id).update({
          data: {
            status: approved ? 'active' : 'rejected',
            updateTime: new Date()
          }
        })
      }
      
      return success(null, approved ? '审批通过' : '已拒绝')
    }
    
    case 'getStats': {
      // 统计数据
      const { total: userCount } = await db.collection('users').count()
      const { total: craftsmanCount } = await db.collection('craftsmen').where({ status: 'active' }).count()
      const { total: dispatcherCount } = await db.collection('dispatchers').where({ status: 'active' }).count()
      const { total: orderCount } = await db.collection('orders').count()
      
      // 待审批数量
      const { data: pendingUsers } = await db.collection('users').get()
      let pendingCount = 0
      pendingUsers.forEach(u => {
        pendingCount += (u.roleApplications?.filter(app => app.status === 'pending').length || 0)
      })
      
      return success({
        userCount,
        craftsmanCount,
        dispatcherCount,
        orderCount,
        pendingCount
      })
    }
    
    case 'getCraftsmenList': {
      const { page = 1, pageSize = 20, status } = data
      const skip = (page - 1) * pageSize
      
      let where = {}
      if (status) where.status = status
      
      const { data: list } = await db.collection('craftsmen')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      const { total } = await db.collection('craftsmen').where(where).count()
      
      return success({ list, total, page, pageSize })
    }
    
    case 'getDispatchersList': {
      const { page = 1, pageSize = 20, status } = data
      const skip = (page - 1) * pageSize
      
      let where = {}
      if (status) where.status = status
      
      const { data: list } = await db.collection('dispatchers')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      const { total } = await db.collection('dispatchers').where(where).count()
      
      return success({ list, total, page, pageSize })
    }
    
    case 'getOrdersList': {
      const { page = 1, pageSize = 20, status, orderNo } = data
      const skip = (page - 1) * pageSize
      
      let where = {}
      if (status) where.status = status
      if (orderNo) where.orderNo = db.RegExp({ regexp: orderNo, options: 'i' })
      
      const { data: list } = await db.collection('orders')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      const { total } = await db.collection('orders').where(where).count()
      
      return success({ list, total, page, pageSize })
    }
    
    case 'updateCraftsman': {
      const { id, name, phone, status, remark } = data
      
      if (!id) return error('缺少ID参数')
      
      const updateData = { updateTime: new Date() }
      if (name !== undefined) updateData.name = name
      if (phone !== undefined) updateData.phone = phone
      if (status !== undefined) updateData.status = status
      if (remark !== undefined) updateData.remark = remark
      
      await db.collection('craftsmen').doc(id).update({ data: updateData })
      
      // 同步更新users集合
      if (phone && (name !== undefined || status !== undefined)) {
        const { data: users } = await db.collection('users').where({ phone }).get()
        if (users.length > 0) {
          const userUpdate = { updateTime: new Date() }
          if (name !== undefined) userUpdate.name = name
          if (status !== undefined) {
            const roleApps = users[0].roleApplications || []
            const appIndex = roleApps.findIndex(app => app.role === 'craftsman')
            if (appIndex >= 0) {
              roleApps[appIndex].status = status
              userUpdate.roleApplications = roleApps
            }
          }
          await db.collection('users').doc(users[0]._id).update({ data: userUpdate })
        }
      }
      
      return success(null, '更新成功')
    }
    
    case 'updateDispatcher': {
      const { id, name, phone, status, remark } = data
      
      if (!id) return error('缺少ID参数')
      
      const updateData = { updateTime: new Date() }
      if (name !== undefined) updateData.name = name
      if (phone !== undefined) updateData.phone = phone
      if (status !== undefined) updateData.status = status
      if (remark !== undefined) updateData.remark = remark
      
      await db.collection('dispatchers').doc(id).update({ data: updateData })
      
      // 同步更新users集合
      if (phone && (name !== undefined || status !== undefined)) {
        const { data: users } = await db.collection('users').where({ phone }).get()
        if (users.length > 0) {
          const userUpdate = { updateTime: new Date() }
          if (name !== undefined) userUpdate.name = name
          if (status !== undefined) {
            const roleApps = users[0].roleApplications || []
            const appIndex = roleApps.findIndex(app => app.role === 'dispatcher')
            if (appIndex >= 0) {
              roleApps[appIndex].status = status
              userUpdate.roleApplications = roleApps
            }
          }
          await db.collection('users').doc(users[0]._id).update({ data: userUpdate })
        }
      }
      
      return success(null, '更新成功')
    }
    
    case 'updateOrder': {
      const { id, name, quantity, price, status, remark, receiveDate } = data
      
      if (!id) return error('缺少ID参数')
      
      const updateData = { updateTime: new Date() }
      
      if (name !== undefined) updateData.name = name
      if (quantity !== undefined) {
        updateData.quantity = parseInt(quantity)
        // 重新计算总价
        const { data: orders } = await db.collection('orders').doc(id).get()
        if (orders.length > 0) {
          const price = orders[0].price
          updateData.totalAmount = parseInt(quantity) * price
        }
      }
      if (price !== undefined) {
        updateData.price = parseFloat(price)
        // 重新计算总价
        const { data: orders } = await db.collection('orders').doc(id).get()
        if (orders.length > 0) {
          const quantity = orders[0].quantity
          updateData.totalAmount = quantity * parseFloat(price)
        }
      }
      if (status !== undefined) updateData.status = status
      if (remark !== undefined) updateData.remark = remark
      if (receiveDate !== undefined) updateData.receiveDate = receiveDate
      
      await db.collection('orders').doc(id).update({ data: updateData })
      
      return success(null, '更新成功')
    }
    
    case 'deleteOrder': {
      const { id } = data
      
      if (!id) return error('缺少ID参数')
      
      await db.collection('orders').doc(id).remove()
      
      return success(null, '删除成功')
    }
    
    default:
      return error('未知操作')
  }
}

// 订单模块
async function handleOrder(action, data, openid) {
  const { role, user } = await getUserRole(openid)
  
  switch (action) {
    case 'create': {
      // 只有派单人和管理员可以创建订单
      if (!['dispatcher', 'admin'].includes(role)) {
        return error('无权限创建订单', -403)
      }
      
      const { name, quantity, price, remark, receiveDate } = data
      
      if (!name || !quantity || !price) {
        return error('缺少必要信息')
      }
      
      const orderNo = generateOrderNo()
      
      const orderData = {
        orderNo,
        name,
        quantity: parseInt(quantity),
        price: parseFloat(price),
        totalAmount: parseInt(quantity) * parseFloat(price),
        remark: remark || '',
        receiveDate: receiveDate || null,
        status: 'pending',
        dispatcherId: openid,
        dispatcherName: user?.name,
        dispatcherPhone: user?.phone,
        craftsmanId: null,
        craftsmanName: null,
        craftsmanPhone: null,
        // 完成信息
        trackingNo: null,           // 快递单号
        completionPhotos: [],       // 完成照片
        completionNote: '',         // 完成备注
        // 时间戳
        createTime: new Date(),
        updateTime: new Date(),
        acceptTime: null,
        completeTime: null,
        cancelTime: null,
        cancelBy: null,
        cancelReason: ''
      }
      
      const result = await db.collection('orders').add({ data: orderData })
      
      return success({ orderId: result._id, orderNo }, '订单创建成功')
    }
    
    case 'list': {
      const { status, role: queryRole } = data
      let where = {}
      
      if (status) where.status = status
      
      if (queryRole === 'craftsman') {
        // 手艺人查看已接订单
        where.craftsmanId = openid
      } else if (queryRole === 'dispatcher') {
        // 派单人查看自己发布的订单
        where.dispatcherId = openid
      }
      // 管理员查看全部
      
      const { data: orders } = await db.collection('orders')
        .where(where)
        .orderBy('createTime', 'desc')
        .get()
      
      return success({ list: orders })
    }
    
    case 'accept': {
      // 只有手艺人可以接单
      if (role !== 'craftsman') {
        return error('无权限接单', -403)
      }
      
      const { orderId } = data
      
      const { data: orders } = await db.collection('orders').where({ _id: orderId }).get()
      if (orders.length === 0) return error('订单不存在')
      
      const order = orders[0]
      if (order.status !== 'pending') return error('订单状态不正确')
      
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'accepted',
          craftsmanId: openid,
          craftsmanName: user?.name,
          acceptTime: new Date(),
          updateTime: new Date()
        }
      })
      
      return success(null, '接单成功')
    }
    
    case 'cancel': {
      const { orderId } = data
      
      const { data: orders } = await db.collection('orders').where({ _id: orderId }).get()
      if (orders.length === 0) return error('订单不存在')
      
      const order = orders[0]
      
      // 验证权限：派单人或接单的手艺人可以取消
      if (order.dispatcherId !== openid && order.craftsmanId !== openid && role !== 'admin') {
        return error('无权限取消订单', -403)
      }
      
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'cancelled',
          cancelTime: new Date(),
          updateTime: new Date(),
          cancelBy: openid
        }
      })
      
      return success(null, '订单已取消')
    }
    
    case 'complete': {
      const { orderId, trackingNo, photos, completionNote } = data
      
      const { data: orders } = await db.collection('orders').where({ _id: orderId }).get()
      if (orders.length === 0) return error('订单不存在')
      
      const order = orders[0]
      
      // 验证权限
      if (order.craftsmanId !== openid && order.dispatcherId !== openid && role !== 'admin') {
        return error('无权限完成订单', -403)
      }
      
      const updateData = {
        status: 'completed',
        completeTime: new Date(),
        updateTime: new Date()
      }
      
      // 添加快递单号
      if (trackingNo) {
        updateData.trackingNo = trackingNo
      }
      
      // 添加完成照片
      if (photos && photos.length > 0) {
        updateData.completionPhotos = photos
      }
      
      // 添加完成备注
      if (completionNote) {
        updateData.completionNote = completionNote
      }
      
      await db.collection('orders').doc(orderId).update({ data: updateData })
      
      return success({ 
        orderId,
        trackingNo,
        completeTime: new Date()
      }, '订单已完成')
    }
    
    default:
      return error('未知操作')
  }
}

// 用户模块
async function handleUser(action, data, openid) {
  const { role, user } = await getUserRole(openid)
  
  if (!user) return error('用户不存在', -404)
  
  switch (action) {
    case 'getProfile': {
      return success({
        phone: user.phone,
        name: user.name,
        roles: user.roles || [],
        currentRole: role,
        roleApplications: user.roleApplications || []
      })
    }
    
    case 'updateProfile': {
      const { name } = data
      const updateData = { updateTime: new Date() }
      if (name) updateData.name = name
      
      await db.collection('users').doc(user._id).update({ data: updateData })
      
      // 同步更新角色集合
      if (role === 'craftsman') {
        const { data: c } = await db.collection('craftsmen').where({ phone: user.phone }).get()
        if (c.length > 0) {
          await db.collection('craftsmen').doc(c[0]._id).update({ data: { name } })
        }
      } else if (role === 'dispatcher') {
        const { data: d } = await db.collection('dispatchers').where({ phone: user.phone }).get()
        if (d.length > 0) {
          await db.collection('dispatchers').doc(d[0]._id).update({ data: { name } })
        }
      }
      
      return success(null, '更新成功')
    }
    
    case 'switchRole': {
      const { targetRole } = data
      
      if (!user.roles?.includes(targetRole)) {
        return error('无该角色权限')
      }
      
      await db.collection('users').doc(user._id).update({
        data: { currentRole: targetRole }
      })
      
      return success({ currentRole: targetRole }, '切换成功')
    }
    
    default:
      return error('未知操作')
  }
}
