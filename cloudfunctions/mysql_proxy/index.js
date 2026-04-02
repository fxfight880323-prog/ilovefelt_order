/**
 * CloudBase MySQL Proxy
 * 提供 MySQL 数据库操作接口
 */

const cloud = require('wx-server-sdk')
const mysql = require('mysql2/promise')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 从环境变量获取 MySQL 配置
// 请在云函数配置中设置这些环境变量
const DB_CONFIG = {
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'cloudbase-9gg5wxnh64aaabbc',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  acquireTimeout: 10000
}

// 连接池
let pool = null

function initPool() {
  if (!pool && DB_CONFIG.host) {
    pool = mysql.createPool(DB_CONFIG)
    console.log('MySQL pool created')
  }
  return pool
}

// 执行查询
async function execute(sql, params = []) {
  const p = initPool()
  if (!p) {
    console.warn('MySQL not configured')
    return null
  }
  
  const conn = await p.getConnection()
  try {
    const [rows] = await conn.execute(sql, params)
    return rows
  } finally {
    conn.release()
  }
}

// 执行插入
async function insert(sql, params = []) {
  const p = initPool()
  if (!p) return null
  
  const conn = await p.getConnection()
  try {
    const [result] = await conn.execute(sql, params)
    return { insertId: result.insertId, affectedRows: result.affectedRows }
  } finally {
    conn.release()
  }
}

// 执行更新
async function update(sql, params = []) {
  const p = initPool()
  if (!p) return null
  
  const conn = await p.getConnection()
  try {
    const [result] = await conn.execute(sql, params)
    return { affectedRows: result.affectedRows }
  } finally {
    conn.release()
  }
}

// 主入口
exports.main = async (event, context) => {
  const { action, table, data, where, sql, params } = event
  
  // 检查配置
  if (!DB_CONFIG.host) {
    return { code: -1, message: 'MySQL not configured. Please set environment variables.' }
  }
  
  try {
    switch (action) {
      case 'query':
        const rows = await execute(sql, params)
        return { code: 0, data: rows }
        
      case 'insert':
        const insertResult = await insert(sql, params)
        return { code: 0, data: insertResult }
        
      case 'update':
        const updateResult = await update(sql, params)
        return { code: 0, data: updateResult }
        
      case 'delete':
        const deleteResult = await execute(sql, params)
        return { code: 0, data: deleteResult }
        
      // 表操作快捷接口
      case 'insertUser':
        return await insertUser(data)
      case 'updateUser':
        return await updateUser(data, where)
      case 'getUserByOpenid':
        return await getUserByOpenid(where.openid)
        
      case 'insertCraftsman':
        return await insertCraftsman(data)
      case 'updateCraftsman':
        return await updateCraftsman(data, where)
      case 'getCraftsmanByOpenid':
        return await getCraftsmanByOpenid(where.openid)
        
      case 'insertDispatcher':
        return await insertDispatcher(data)
      case 'updateDispatcher':
        return await updateDispatcher(data, where)
      case 'getDispatcherByOpenid':
        return await getDispatcherByOpenid(where.openid)
        
      case 'insertOrder':
        return await insertOrder(data)
      case 'updateOrder':
        return await updateOrder(data, where)
      case 'getOrders':
        return await getOrders(where)
        
      case 'insertVerifyCode':
        return await insertVerifyCode(data)
      case 'getVerifyCode':
        return await getVerifyCode(where.phone, where.code, where.type)
      case 'markVerifyCodeUsed':
        return await markVerifyCodeUsed(where.id)
        
      case 'insertSmsLog':
        return await insertSmsLog(data)
        
      case 'syncFromCloudDB':
        return await syncFromCloudDB(table, data)
        
      default:
        return { code: -1, message: 'Unknown action' }
    }
  } catch (err) {
    console.error('MySQL error:', err)
    return { code: -1, message: err.message, sql: sql }
  }
}

// ==================== User 操作 ====================

async function insertUser(data) {
  const sql = `INSERT INTO users (openid, role, roles, current_role, phone, status, name, avatar_url) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  const params = [
    data.openid,
    data.role || 'guest',
    JSON.stringify(data.roles || [data.role || 'guest']),
    data.current_role || data.currentRole || data.role || 'guest',
    data.phone,
    data.status || 'active',
    data.name,
    data.avatar_url || data.avatarUrl
  ]
  const result = await insert(sql, params)
  return { code: 0, data: result }
}

async function updateUser(data, where) {
  const fields = []
  const params = []
  
  if (data.role) { fields.push('role = ?'); params.push(data.role) }
  if (data.roles) { fields.push('roles = ?'); params.push(JSON.stringify(data.roles)) }
  if (data.current_role || data.currentRole) { fields.push('current_role = ?'); params.push(data.current_role || data.currentRole) }
  if (data.phone) { fields.push('phone = ?'); params.push(data.phone) }
  if (data.status) { fields.push('status = ?'); params.push(data.status) }
  if (data.name) { fields.push('name = ?'); params.push(data.name) }
  if (data.avatar_url || data.avatarUrl) { fields.push('avatar_url = ?'); params.push(data.avatar_url || data.avatarUrl) }
  
  if (fields.length === 0) return { code: 0, message: 'No fields to update' }
  
  params.push(where.openid)
  const sql = `UPDATE users SET ${fields.join(', ')} WHERE openid = ?`
  
  const result = await update(sql, params)
  return { code: 0, data: result }
}

async function getUserByOpenid(openid) {
  const sql = `SELECT * FROM users WHERE openid = ?`
  const rows = await execute(sql, [openid])
  return { code: 0, data: rows[0] || null }
}

// ==================== Craftsman 操作 ====================

async function insertCraftsman(data) {
  const sql = `INSERT INTO craftsmen 
    (openid, name, phone, wechat_id, code, specialty, experience, address, id_card, 
     star_level, performance, total_orders, completed_orders, rating, avatar_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const params = [
    data.openid,
    data.name,
    data.phone,
    data.wechat_id || data.wechatId,
    data.code,
    data.specialty,
    data.experience,
    data.address,
    data.id_card || data.idCard,
    data.star_level || data.starLevel || 3,
    data.performance || '中',
    data.total_orders || data.totalOrders || 0,
    data.completed_orders || data.completedOrders || 0,
    data.rating || 5.0,
    data.avatar_url || data.avatarUrl,
    data.status || 'pending'
  ]
  const result = await insert(sql, params)
  return { code: 0, data: result }
}

async function updateCraftsman(data, where) {
  const fields = []
  const params = []
  
  const fieldMap = {
    'name': 'name',
    'phone': 'phone',
    'wechat_id': 'wechat_id', 'wechatId': 'wechat_id',
    'code': 'code',
    'specialty': 'specialty',
    'experience': 'experience',
    'address': 'address',
    'id_card': 'id_card', 'idCard': 'id_card',
    'star_level': 'star_level', 'starLevel': 'star_level',
    'performance': 'performance',
    'total_orders': 'total_orders', 'totalOrders': 'total_orders',
    'completed_orders': 'completed_orders', 'completedOrders': 'completed_orders',
    'rating': 'rating',
    'avatar_url': 'avatar_url', 'avatarUrl': 'avatar_url',
    'status': 'status'
  }
  
  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = ?`)
      params.push(data[key])
    }
  }
  
  if (fields.length === 0) return { code: 0, message: 'No fields to update' }
  
  params.push(where.openid)
  const sql = `UPDATE craftsmen SET ${fields.join(', ')} WHERE openid = ?`
  
  const result = await update(sql, params)
  return { code: 0, data: result }
}

async function getCraftsmanByOpenid(openid) {
  const sql = `SELECT * FROM craftsmen WHERE openid = ?`
  const rows = await execute(sql, [openid])
  return { code: 0, data: rows[0] || null }
}

// ==================== Dispatcher 操作 ====================

async function insertDispatcher(data) {
  const sql = `INSERT INTO dispatchers (openid, name, phone, company, status) 
               VALUES (?, ?, ?, ?, ?)`
  const params = [
    data.openid,
    data.name,
    data.phone,
    data.company || '',
    data.status || 'pending'
  ]
  const result = await insert(sql, params)
  return { code: 0, data: result }
}

async function updateDispatcher(data, where) {
  const fields = []
  const params = []
  
  if (data.name) { fields.push('name = ?'); params.push(data.name) }
  if (data.phone) { fields.push('phone = ?'); params.push(data.phone) }
  if (data.company) { fields.push('company = ?'); params.push(data.company) }
  if (data.status) { fields.push('status = ?'); params.push(data.status) }
  
  if (fields.length === 0) return { code: 0, message: 'No fields to update' }
  
  params.push(where.openid)
  const sql = `UPDATE dispatchers SET ${fields.join(', ')} WHERE openid = ?`
  
  const result = await update(sql, params)
  return { code: 0, data: result }
}

async function getDispatcherByOpenid(openid) {
  const sql = `SELECT * FROM dispatchers WHERE openid = ?`
  const rows = await execute(sql, [openid])
  return { code: 0, data: rows[0] || null }
}

// ==================== Order 操作 ====================

async function insertOrder(data) {
  const sql = `INSERT INTO orders 
    (name, style_id, style_name, quantity, price, total_price, receive_date, dispatch_date, remark, image_url,
     dispatcher_id, dispatcher_name, craftsman_id, craftsman_name, craftsman_phone, status,
     tracking_number, tracking_company, ship_date, complete_photos, complete_date, rating, rating_comment, accept_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const params = [
    data.name,
    data.style_id || data.styleId,
    data.style_name || data.styleName,
    data.quantity || 1,
    data.price,
    data.total_price || data.totalPrice,
    data.receive_date || data.receiveDate,
    data.dispatch_date || data.dispatchDate,
    data.remark,
    data.image_url || data.imageUrl,
    data.dispatcher_id || data.dispatcherId,
    data.dispatcher_name || data.dispatcherName,
    data.craftsman_id || data.craftsmanId,
    data.craftsman_name || data.craftsmanName,
    data.craftsman_phone || data.craftsmanPhone,
    data.status || 'pending',
    data.tracking_number || data.trackingNumber,
    data.tracking_company || data.trackingCompany,
    data.ship_date || data.shipDate,
    JSON.stringify(data.complete_photos || data.completePhotos || []),
    data.complete_date || data.completeDate,
    data.rating,
    data.rating_comment || data.ratingComment,
    data.accept_date || data.acceptDate
  ]
  const result = await insert(sql, params)
  return { code: 0, data: result }
}

async function updateOrder(data, where) {
  const fields = []
  const params = []
  
  const fieldMap = {
    'name': 'name',
    'status': 'status',
    'craftsman_id': 'craftsman_id', 'craftsmanId': 'craftsman_id',
    'craftsman_name': 'craftsman_name', 'craftsmanName': 'craftsman_name',
    'craftsman_phone': 'craftsman_phone', 'craftsmanPhone': 'craftsman_phone',
    'tracking_number': 'tracking_number', 'trackingNumber': 'tracking_number',
    'tracking_company': 'tracking_company', 'trackingCompany': 'tracking_company',
    'ship_date': 'ship_date', 'shipDate': 'ship_date',
    'complete_photos': 'complete_photos', 'completePhotos': 'complete_photos',
    'complete_date': 'complete_date', 'completeDate': 'complete_date',
    'rating': 'rating',
    'rating_comment': 'rating_comment', 'ratingComment': 'rating_comment',
    'accept_date': 'accept_date', 'acceptDate': 'accept_date'
  }
  
  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = ?`)
      if (key === 'complete_photos' || key === 'completePhotos') {
        params.push(JSON.stringify(data[key]))
      } else {
        params.push(data[key])
      }
    }
  }
  
  if (fields.length === 0) return { code: 0, message: 'No fields to update' }
  
  params.push(where.id)
  const sql = `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`
  
  const result = await update(sql, params)
  return { code: 0, data: result }
}

async function getOrders(where) {
  let sql = `SELECT * FROM orders WHERE 1=1`
  const params = []
  
  if (where.status) {
    sql += ` AND status = ?`
    params.push(where.status)
  }
  if (where.craftsman_id || where.craftsmanId) {
    sql += ` AND craftsman_id = ?`
    params.push(where.craftsman_id || where.craftsmanId)
  }
  if (where.dispatcher_id || where.dispatcherId) {
    sql += ` AND dispatcher_id = ?`
    params.push(where.dispatcher_id || where.dispatcherId)
  }
  
  sql += ` ORDER BY create_time DESC`
  
  const rows = await execute(sql, params)
  return { code: 0, data: rows }
}

// ==================== VerifyCode 操作 ====================

async function insertVerifyCode(data) {
  const sql = `INSERT INTO verify_codes (phone, code, type, used, expire_time) 
               VALUES (?, ?, ?, 0, ?)`
  const expireTime = new Date(Date.now() + 10 * 60 * 1000) // 10分钟后过期
  const params = [data.phone, data.code, data.type, expireTime]
  const result = await insert(sql, params)
  return { code: 0, data: result }
}

async function getVerifyCode(phone, code, type) {
  const sql = `SELECT * FROM verify_codes 
               WHERE phone = ? AND code = ? AND type = ? AND used = 0 AND expire_time > NOW()`
  const rows = await execute(sql, [phone, code, type])
  return { code: 0, data: rows[0] || null }
}

async function markVerifyCodeUsed(id) {
  const sql = `UPDATE verify_codes SET used = 1, used_time = NOW() WHERE id = ?`
  const result = await update(sql, [id])
  return { code: 0, data: result }
}

// ==================== SMS Log 操作 ====================

async function insertSmsLog(data) {
  const sql = `INSERT INTO sms_logs (phone_to, content, type, status) 
               VALUES (?, ?, ?, ?)`
  const params = [
    data.phone_to || data.phoneTo,
    data.content,
    data.type,
    data.status || 'sent'
  ]
  const result = await insert(sql, params)
  return { code: 0, data: result }
}

// ==================== 从云数据库同步 ====================

async function syncFromCloudDB(table, doc) {
  // 根据表名选择对应的插入/更新操作
  switch (table) {
    case 'users':
      const existingUser = await getUserByOpenid(doc.openid)
      if (existingUser.data) {
        return await updateUser(doc, { openid: doc.openid })
      } else {
        return await insertUser(doc)
      }
    case 'craftsmen':
      const existingCraftsman = await getCraftsmanByOpenid(doc.openid)
      if (existingCraftsman.data) {
        return await updateCraftsman(doc, { openid: doc.openid })
      } else {
        return await insertCraftsman(doc)
      }
    case 'dispatchers':
      const existingDispatcher = await getDispatcherByOpenid(doc.openid)
      if (existingDispatcher.data) {
        return await updateDispatcher(doc, { openid: doc.openid })
      } else {
        return await insertDispatcher(doc)
      }
    default:
      return { code: -1, message: 'Unknown table' }
  }
}
