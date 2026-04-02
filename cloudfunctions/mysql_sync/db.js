/**
 * CloudBase MySQL 数据库连接工具
 * 用于云函数连接 CloudBase MySQL
 */

const mysql = require('mysql2/promise')

// 数据库配置 - 请根据你的 CloudBase MySQL 配置修改
const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cloudbase-9gg5wxnh64aaabbc',
  charset: 'utf8mb4',
  // 连接池配置
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 超时配置
  connectTimeout: 10000,
  acquireTimeout: 10000
}

// 连接池
let pool = null

/**
 * 初始化连接池
 */
function initPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG)
    console.log('MySQL 连接池已创建')
  }
  return pool
}

/**
 * 获取连接
 */
async function getConnection() {
  initPool()
  return await pool.getConnection()
}

/**
 * 执行 SQL 查询
 * @param {string} sql - SQL 语句
 * @param {array} params - 参数
 */
async function query(sql, params = []) {
  const conn = await getConnection()
  try {
    const [rows] = await conn.execute(sql, params)
    return rows
  } finally {
    conn.release()
  }
}

/**
 * 执行插入操作，返回插入的 ID
 * @param {string} sql - SQL 语句
 * @param {array} params - 参数
 */
async function insert(sql, params = []) {
  const conn = await getConnection()
  try {
    const [result] = await conn.execute(sql, params)
    return result.insertId
  } finally {
    conn.release()
  }
}

/**
 * 执行更新操作，返回影响的行数
 * @param {string} sql - SQL 语句
 * @param {array} params - 参数
 */
async function update(sql, params = []) {
  const conn = await getConnection()
  try {
    const [result] = await conn.execute(sql, params)
    return result.affectedRows
  } finally {
    conn.release()
  }
}

/**
 * 事务开始
 */
async function beginTransaction() {
  const conn = await getConnection()
  await conn.beginTransaction()
  return conn
}

/**
 * 事务提交
 */
async function commit(conn) {
  await conn.commit()
  conn.release()
}

/**
 * 事务回滚
 */
async function rollback(conn) {
  await conn.rollback()
  conn.release()
}

/**
 * 将云开发数据转换为 MySQL 格式
 */
function convertToMySQL(doc, fieldMapping = {}) {
  const result = {}
  for (const [key, value] of Object.entries(doc)) {
    // 字段名映射
    const mysqlKey = fieldMapping[key] || key
    
    // 类型转换
    if (value instanceof Date) {
      result[mysqlKey] = value
    } else if (typeof value === 'object' && value !== null) {
      // 对象转 JSON 字符串
      result[mysqlKey] = JSON.stringify(value)
    } else {
      result[mysqlKey] = value
    }
  }
  return result
}

/**
 * 构建 INSERT SQL
 * @param {string} table - 表名
 * @param {object} data - 数据对象
 */
function buildInsertSQL(table, data) {
  const keys = Object.keys(data)
  const values = Object.values(data)
  const placeholders = values.map(() => '?').join(', ')
  
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
  return { sql, params: values }
}

/**
 * 构建 UPDATE SQL
 * @param {string} table - 表名
 * @param {object} data - 数据对象
 * @param {string} where - WHERE 条件
 */
function buildUpdateSQL(table, data, where) {
  const keys = Object.keys(data)
  const values = Object.values(data)
  const setClause = keys.map(key => `${key} = ?`).join(', ')
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`
  return { sql, params: values }
}

module.exports = {
  query,
  insert,
  update,
  beginTransaction,
  commit,
  rollback,
  convertToMySQL,
  buildInsertSQL,
  buildUpdateSQL,
  DB_CONFIG
}
