/**
 * 数据迁移云函数
 * 将云开发数据库数据迁移到 CloudBase MySQL
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 批处理大小
const BATCH_SIZE = 100

exports.main = async (event, context) => {
  const { action, table, batchSize = BATCH_SIZE } = event
  
  try {
    switch (action) {
      case 'migrateAll':
        return await migrateAll(batchSize)
      case 'migrateUsers':
        return await migrateTable('users', batchSize)
      case 'migrateCraftsmen':
        return await migrateTable('craftsmen', batchSize)
      case 'migrateDispatchers':
        return await migrateTable('dispatchers', batchSize)
      case 'migrateOrders':
        return await migrateTable('orders', batchSize)
      case 'migrateStyles':
        return await migrateTable('styles', batchSize)
      case 'migrateVerifyCodes':
        return await migrateTable('verifyCodes', batchSize)
      case 'migrateSmsLogs':
        return await migrateTable('smsLogs', batchSize)
      case 'checkStatus':
        return await checkStatus()
      default:
        return { code: -1, message: 'Unknown action' }
    }
  } catch (err) {
    console.error('Migration error:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 迁移所有表
 */
async function migrateAll(batchSize) {
  const results = {}
  
  console.log('=== 开始全量数据迁移 ===')
  
  // 按依赖顺序迁移
  const tables = ['users', 'craftsmen', 'dispatchers', 'styles', 'orders', 'verifyCodes', 'smsLogs', 'notices', 'ratings']
  
  for (const table of tables) {
    console.log(`\n开始迁移 ${table}...`)
    results[table] = await migrateTable(table, batchSize)
  }
  
  console.log('\n=== 迁移完成 ===')
  
  return {
    code: 0,
    message: 'Migration completed',
    data: results
  }
}

/**
 * 迁移单个表
 */
async function migrateTable(tableName, batchSize) {
  let migrated = 0
  let failed = 0
  let skipped = 0
  
  try {
    // 获取总数
    const { total } = await db.collection(tableName).count()
    console.log(`${tableName} 总计 ${total} 条记录`)
    
    if (total === 0) {
      return { code: 0, message: 'No data', data: { total: 0, migrated: 0 } }
    }
    
    // 分批获取数据
    const batches = Math.ceil(total / batchSize)
    
    for (let i = 0; i < batches; i++) {
      const { data } = await db.collection(tableName)
        .skip(i * batchSize)
        .limit(batchSize)
        .get()
      
      // 逐条迁移
      for (const doc of data) {
        try {
          const result = await syncDocument(tableName, doc)
          if (result.code === 0) {
            migrated++
          } else if (result.code === 1) {
            skipped++
          } else {
            failed++
          }
        } catch (err) {
          console.error(`Failed to migrate ${tableName}/${doc._id}:`, err)
          failed++
        }
      }
      
      console.log(`  批次 ${i + 1}/${batches}: 已迁移 ${migrated}, 失败 ${failed}, 跳过 ${skipped}`)
    }
    
    return {
      code: 0,
      message: 'Migration completed',
      data: { total, migrated, failed, skipped }
    }
  } catch (err) {
    console.error(`Failed to migrate ${tableName}:`, err)
    return { code: -1, message: err.message, data: { migrated, failed, skipped } }
  }
}

/**
 * 同步单条文档到 MySQL
 */
async function syncDocument(tableName, doc) {
  // 转换数据格式
  const mysqlData = convertDocument(tableName, doc)
  
  // 调用 mysql_proxy 云函数
  const result = await cloud.callFunction({
    name: 'mysql_proxy',
    data: {
      action: 'syncFromCloudDB',
      table: tableName,
      data: mysqlData
    }
  })
  
  return result.result
}

/**
 * 转换文档格式
 */
function convertDocument(tableName, doc) {
  const baseFields = {
    _id: doc._id,
    createTime: doc.createTime ? new Date(doc.createTime) : new Date(),
    updateTime: doc.updateTime ? new Date(doc.updateTime) : new Date()
  }
  
  switch (tableName) {
    case 'users':
      return {
        openid: doc.openid,
        role: doc.role || 'guest',
        roles: doc.roles || [doc.role || 'guest'],
        current_role: doc.currentRole || doc.role || 'guest',
        phone: doc.phone,
        status: doc.status || 'active',
        name: doc.name,
        avatar_url: doc.avatarUrl || doc.avatar_url,
        ...baseFields
      }
      
    case 'craftsmen':
      return {
        openid: doc.openid,
        name: doc.name,
        phone: doc.phone,
        wechat_id: doc.wechatId || doc.wechat_id,
        code: doc.code,
        specialty: doc.specialty,
        experience: doc.experience,
        address: doc.address,
        id_card: doc.idCard || doc.id_card,
        star_level: doc.starLevel || doc.star_level || 3,
        performance: doc.performance || '中',
        total_orders: doc.totalOrders || doc.total_orders || 0,
        completed_orders: doc.completedOrders || doc.completed_orders || 0,
        rating: doc.rating || 5.0,
        avatar_url: doc.avatarUrl || doc.avatar_url,
        status: doc.status || 'pending',
        ...baseFields
      }
      
    case 'dispatchers':
      return {
        openid: doc.openid,
        name: doc.name,
        phone: doc.phone,
        company: doc.company,
        status: doc.status || 'pending',
        ...baseFields
      }
      
    case 'orders':
      return {
        name: doc.name,
        style_id: doc.styleId || doc.style_id,
        style_name: doc.styleName || doc.style_name,
        quantity: doc.quantity || 1,
        price: doc.price,
        total_price: doc.totalPrice || doc.total_price,
        receive_date: doc.receiveDate || doc.receive_date,
        dispatch_date: doc.dispatchDate || doc.dispatch_date,
        remark: doc.remark,
        image_url: doc.imageUrl || doc.image_url,
        dispatcher_id: doc.dispatcherId || doc.dispatcher_id,
        dispatcher_name: doc.dispatcherName || doc.dispatcher_name,
        craftsman_id: doc.craftsmanId || doc.craftsman_id,
        craftsman_name: doc.craftsmanName || doc.craftsman_name,
        craftsman_phone: doc.craftsmanPhone || doc.craftsman_phone,
        status: doc.status || 'pending',
        tracking_number: doc.trackingNumber || doc.tracking_number,
        tracking_company: doc.trackingCompany || doc.tracking_company,
        ship_date: doc.shipDate || doc.ship_date,
        complete_photos: doc.completePhotos || doc.complete_photos || [],
        complete_date: doc.completeDate || doc.complete_date,
        rating: doc.rating,
        rating_comment: doc.ratingComment || doc.rating_comment,
        accept_date: doc.acceptDate || doc.accept_date,
        ...baseFields
      }
      
    case 'styles':
      return {
        name: doc.name,
        description: doc.description,
        image_url: doc.imageUrl || doc.image_url,
        status: doc.status !== undefined ? doc.status : 1,
        ...baseFields
      }
      
    case 'verifyCodes':
      return {
        phone: doc.phone,
        code: doc.code,
        type: doc.type,
        used: doc.used ? 1 : 0,
        expire_time: doc.expireTime || doc.expire_time,
        used_time: doc.usedTime || doc.used_time,
        ...baseFields
      }
      
    case 'smsLogs':
      return {
        phone_to: doc.to || doc.phone_to,
        content: doc.content,
        type: doc.type,
        status: doc.status || 'sent',
        ...baseFields
      }
      
    case 'notices':
      return {
        title: doc.title,
        content: doc.content,
        type: doc.type || 'normal',
        status: doc.status !== undefined ? doc.status : 1,
        ...baseFields
      }
      
    case 'ratings':
      return {
        order_id: doc.orderId || doc.order_id,
        craftsman_id: doc.craftsmanId || doc.craftsman_id,
        score: doc.score,
        comment: doc.comment,
        ...baseFields
      }
      
    default:
      return { ...doc, ...baseFields }
  }
}

/**
 * 检查迁移状态
 */
async function checkStatus() {
  const tables = ['users', 'craftsmen', 'dispatchers', 'orders', 'styles', 'verifyCodes', 'smsLogs', 'notices', 'ratings']
  const status = {}
  
  for (const table of tables) {
    try {
      const { total } = await db.collection(table).count()
      status[table] = { cloudDB: total, mysql: 'unknown' }
    } catch (err) {
      status[table] = { cloudDB: 'error', error: err.message }
    }
  }
  
  return {
    code: 0,
    data: status
  }
}
