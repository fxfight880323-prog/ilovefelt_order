/**
 * CloudBase SQL 数据库操作工具
 * 直接操作你的 SQL 数据库: cloudbase-9gg5wxnh64aaabbc
 */

const cloud = require('wx-server-sdk')
const mysql = require('mysql2/promise')

cloud.init({
  env: 'cloudbase-9gg5wxnh64aaabbc'
})

// 数据库配置 - 从环境变量读取
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'cloudbase-9gg5wxnh64aaabbc',
  charset: 'utf8mb4'
}

// 连接池
let pool = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10
    })
  }
  return pool
}

// 执行 SQL
async function query(sql, params = []) {
  const conn = await getPool().getConnection()
  try {
    const [rows] = await conn.execute(sql, params)
    return rows
  } finally {
    conn.release()
  }
}

// 插入数据，返回 ID
async function insert(sql, params = []) {
  const conn = await getPool().getConnection()
  try {
    const [result] = await conn.execute(sql, params)
    return result.insertId
  } finally {
    conn.release()
  }
}

// 更新数据
async function update(sql, params = []) {
  const conn = await getPool().getConnection()
  try {
    const [result] = await conn.execute(sql, params)
    return result.affectedRows
  } finally {
    conn.release()
  }
}

// ==================== 用户表操作 ====================

const UserDB = {
  // 根据 openid 获取用户
  async getByOpenid(openid) {
    const rows = await query('SELECT * FROM users WHERE openid = ?', [openid])
    return rows[0] || null
  },

  // 创建用户
  async create(data) {
    const sql = `INSERT INTO users (openid, role, roles, current_role, phone, status, name) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
    const params = [
      data.openid,
      data.role || 'guest',
      JSON.stringify(data.roles || [data.role || 'guest']),
      data.current_role || data.currentRole || data.role || 'guest',
      data.phone,
      data.status || 'active',
      data.name
    ]
    return await insert(sql, params)
  },

  // 更新用户
  async update(openid, data) {
    const fields = []
    const params = []
    
    if (data.role) { fields.push('role = ?'); params.push(data.role) }
    if (data.roles) { fields.push('roles = ?'); params.push(JSON.stringify(data.roles)) }
    if (data.current_role || data.currentRole) { fields.push('current_role = ?'); params.push(data.current_role || data.currentRole) }
    if (data.phone) { fields.push('phone = ?'); params.push(data.phone) }
    if (data.status) { fields.push('status = ?'); params.push(data.status) }
    if (data.name) { fields.push('name = ?'); params.push(data.name) }
    
    if (fields.length === 0) return 0
    
    params.push(openid)
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE openid = ?`
    return await update(sql, params)
  }
}

// ==================== 手艺人表操作 ====================

// 履约分配置
const RELIABILITY_CONFIG = {
  INITIAL_SCORE: 5.0,
  MAX_SCORE: 6.0,
  MIN_SCORE: 0.0,
  WEIGHT_TIME: 0.5,
  WEIGHT_RATING: 0.5,
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

// 计算时间履约分（基于是否在约定时间内完成寄出）
function calculateTimeScore(order) {
  const receiveDate = order.receive_date ? new Date(order.receive_date) : null
  const shipDate = order.ship_date ? new Date(order.ship_date) : null
  const completeDate = order.complete_date ? new Date(order.complete_date) : null
  
  if (!receiveDate) return 5.0
  
  const actualShipDate = shipDate || completeDate
  if (!actualShipDate) return 3.0
  
  const diffMs = receiveDate.getTime() - actualShipDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  
  if (diffDays >= 0) return 5.0
  
  const delayDays = Math.abs(diffDays)
  if (delayDays <= 1) return 4.5
  if (delayDays <= 2) return 4.0
  if (delayDays <= 3) return 3.5
  if (delayDays <= 5) return 3.0
  if (delayDays <= 7) return 2.5
  if (delayDays <= 10) return 2.0
  if (delayDays <= 15) return 1.5
  return 1.0
}

const CraftsmanDB = {
  // 根据 openid 获取
  async getByOpenid(openid) {
    const rows = await query('SELECT * FROM craftsmen WHERE openid = ?', [openid])
    return rows[0] || null
  },

  // 根据手机号获取
  async getByPhone(phone) {
    const rows = await query('SELECT * FROM craftsmen WHERE phone = ?', [phone])
    return rows[0] || null
  },

  // 创建手艺人
  async create(data) {
    const initialScore = data.reliability_score !== undefined ? data.reliability_score : RELIABILITY_CONFIG.INITIAL_SCORE
    const level = calculateReliabilityLevel(initialScore)
    
    const sql = `INSERT INTO craftsmen 
      (openid, name, phone, wechat_id, specialty, experience, address, 
       star_level, performance, status, total_orders, completed_orders, rating,
       reliability_score, reliability_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const params = [
      data.openid,
      data.name,
      data.phone,
      data.wechat_id || data.wechatId || '',
      data.specialty || '',
      data.experience || '',
      data.address || '',
      data.star_level || data.starLevel || 3,
      data.performance || '中',
      data.status || 'pending',
      data.total_orders || data.totalOrders || 0,
      data.completed_orders || data.completedOrders || 0,
      data.rating || 5.0,
      initialScore,
      level.label
    ]
    return await insert(sql, params)
  },

  // 更新手艺人
  async update(openid, data) {
    const fields = []
    const params = []
    
    const map = {
      'name': 'name',
      'phone': 'phone',
      'wechat_id': 'wechat_id', 'wechatId': 'wechat_id',
      'specialty': 'specialty',
      'experience': 'experience',
      'address': 'address',
      'star_level': 'star_level', 'starLevel': 'star_level',
      'performance': 'performance',
      'total_orders': 'total_orders', 'totalOrders': 'total_orders',
      'completed_orders': 'completed_orders', 'completedOrders': 'completed_orders',
      'rating': 'rating',
      'status': 'status',
      'reliability_score': 'reliability_score',
      'reliability_level': 'reliability_level'
    }
    
    for (const [key, dbField] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${dbField} = ?`)
        params.push(data[key])
      }
    }
    
    if (fields.length === 0) return 0
    
    params.push(openid)
    const sql = `UPDATE craftsmen SET ${fields.join(', ')} WHERE openid = ?`
    return await update(sql, params)
  },
  
  // 直接设置履约分（用于新的综合计分方式）
  async setReliabilityScore(openid, score) {
    const level = calculateReliabilityLevel(score)
    
    await this.update(openid, {
      reliability_score: score,
      reliability_level: level.label
    })
    
    return {
      score: score,
      level: level.label
    }
  },
  
  // 更新履约分（基于订单评价计算平均值 - 简化版本）
  async updateReliabilityScore(openid, timeScore, ratingScore) {
    const craftsman = await this.getByOpenid(openid)
    if (!craftsman) return null
    
    // 计算综合履约分 = 时间分 * 50% + 派单评分 * 50%
    const reliabilityScore = (timeScore * RELIABILITY_CONFIG.WEIGHT_TIME) + 
                            (ratingScore * RELIABILITY_CONFIG.WEIGHT_RATING)
    
    const finalScore = Math.max(RELIABILITY_CONFIG.MIN_SCORE, 
                               Math.min(RELIABILITY_CONFIG.MAX_SCORE, reliabilityScore))
    
    const level = calculateReliabilityLevel(finalScore)
    
    await this.update(openid, {
      reliability_score: finalScore,
      reliability_level: level.label
    })
    
    return {
      score: finalScore,
      level: level.label
    }
  },

  // 获取所有手艺人
  async getAll(status = null) {
    let sql = 'SELECT * FROM craftsmen'
    const params = []
    if (status) {
      sql += ' WHERE status = ?'
      params.push(status)
    }
    sql += ' ORDER BY create_time DESC'
    return await query(sql, params)
  }
}

// ==================== 派单人表操作 ====================

const DispatcherDB = {
  // 根据 openid 获取
  async getByOpenid(openid) {
    const rows = await query('SELECT * FROM dispatchers WHERE openid = ?', [openid])
    return rows[0] || null
  },

  // 根据手机号获取
  async getByPhone(phone) {
    const rows = await query('SELECT * FROM dispatchers WHERE phone = ?', [phone])
    return rows[0] || null
  },

  // 创建派单人
  async create(data) {
    const sql = `INSERT INTO dispatchers (openid, name, phone, company, status) 
                 VALUES (?, ?, ?, ?, ?)`
    const params = [
      data.openid,
      data.name,
      data.phone,
      data.company || '',
      data.status || 'pending'
    ]
    return await insert(sql, params)
  },

  // 更新派单人
  async update(openid, data) {
    const fields = []
    const params = []
    
    if (data.name) { fields.push('name = ?'); params.push(data.name) }
    if (data.phone) { fields.push('phone = ?'); params.push(data.phone) }
    if (data.company) { fields.push('company = ?'); params.push(data.company) }
    if (data.status) { fields.push('status = ?'); params.push(data.status) }
    
    if (fields.length === 0) return 0
    
    params.push(openid)
    const sql = `UPDATE dispatchers SET ${fields.join(', ')} WHERE openid = ?`
    return await update(sql, params)
  }
}

// ==================== 订单表操作 ====================

const OrderDB = {
  // 根据 ID 获取
  async getById(id) {
    const rows = await query('SELECT * FROM orders WHERE id = ?', [id])
    return rows[0] || null
  },

  // 创建订单
  async create(data) {
    const sql = `INSERT INTO orders 
      (name, style_id, style_name, quantity, price, total_price, 
       receive_date, dispatch_date, remark, image_url,
       dispatcher_id, dispatcher_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const params = [
      data.name,
      data.style_id || data.styleId,
      data.style_name || data.styleName,
      data.quantity || 1,
      data.price,
      data.total_price || data.totalPrice,
      data.receive_date || data.receiveDate,
      data.dispatch_date || data.dispatchDate,
      data.remark || '',
      data.image_url || data.imageUrl,
      data.dispatcher_id || data.dispatcherId,
      data.dispatcher_name || data.dispatcherName,
      data.status || 'pending'
    ]
    return await insert(sql, params)
  },

  // 更新订单
  async update(id, data) {
    const fields = []
    const params = []
    
    const map = {
      'name': 'name',
      'status': 'status',
      'craftsman_id': 'craftsman_id', 'craftsmanId': 'craftsman_id',
      'craftsman_name': 'craftsman_name', 'craftsmanName': 'craftsman_name',
      'tracking_number': 'tracking_number', 'trackingNumber': 'tracking_number',
      'tracking_company': 'tracking_company', 'trackingCompany': 'tracking_company',
      'complete_photos': 'complete_photos', 'completePhotos': 'complete_photos'
    }
    
    for (const [key, dbField] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${dbField} = ?`)
        if (key === 'complete_photos' || key === 'completePhotos') {
          params.push(JSON.stringify(data[key]))
        } else {
          params.push(data[key])
        }
      }
    }
    
    if (fields.length === 0) return 0
    
    params.push(id)
    const sql = `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`
    return await update(sql, params)
  },

  // 获取订单列表
  async getList(where = {}) {
    let sql = 'SELECT * FROM orders WHERE 1=1'
    const params = []
    
    if (where.status) {
      sql += ' AND status = ?'
      params.push(where.status)
    }
    if (where.craftsman_id || where.craftsmanId) {
      sql += ' AND craftsman_id = ?'
      params.push(where.craftsman_id || where.craftsmanId)
    }
    if (where.dispatcher_id || where.dispatcherId) {
      sql += ' AND dispatcher_id = ?'
      params.push(where.dispatcher_id || where.dispatcherId)
    }
    
    sql += ' ORDER BY create_time DESC'
    
    if (where.limit) {
      sql += ' LIMIT ?'
      params.push(parseInt(where.limit))
    }
    
    return await query(sql, params)
  }
}

// ==================== 验证码表操作 ====================

const VerifyCodeDB = {
  // 创建验证码
  async create(data) {
    const sql = `INSERT INTO verify_codes (phone, code, type, used, expire_time) 
                 VALUES (?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`
    const params = [data.phone, data.code, data.type]
    return await insert(sql, params)
  },

  // 验证验证码
  async verify(phone, code, type) {
    const sql = `SELECT * FROM verify_codes 
                 WHERE phone = ? AND code = ? AND type = ? 
                 AND used = 0 AND expire_time > NOW()`
    const rows = await query(sql, [phone, code, type])
    return rows[0] || null
  },

  // 标记已使用
  async markUsed(id) {
    return await update(
      'UPDATE verify_codes SET used = 1, used_time = NOW() WHERE id = ?',
      [id]
    )
  }
}

// 导出
module.exports = {
  query,
  insert,
  update,
  UserDB,
  CraftsmanDB,
  DispatcherDB,
  OrderDB,
  VerifyCodeDB
}
