const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 主入口函数
exports.main = async (event, context) => {
  const { action, data } = event
  
  try {
    switch (action) {
      case 'create':
        return await createWork(data)
      case 'getList':
        return await getWorkList(data)
      case 'getDetail':
        return await getWorkDetail(data)
      case 'update':
        return await updateWork(data)
      case 'delete':
        return await deleteWork(data)
      case 'getStats':
        return await getWorkStats(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 创建工作记录
async function createWork(data) {
  const { 
    craftsmanId, 
    craftsmanName,
    craftsmanCode,
    orderId,
    orderName,
    productImage,      // 产品图
    costPrice,         // 制作成本
    settlementAmount,  // 结算金额
    deliveryDate,      // 交货时间
    completionStatus,  // 完成状态：completed(已完成), rework(返工), inventory(库存)
    remarks            // 备注
  } = data
  
  if (!craftsmanId) {
    return { code: -1, message: '请选择手艺人' }
  }
  
  const result = await db.collection('craftsmanWorks').add({
    data: {
      craftsmanId,
      craftsmanName: craftsmanName || '',
      craftsmanCode: craftsmanCode || '',
      orderId: orderId || '',
      orderName: orderName || '',
      productImage: productImage || '',
      costPrice: parseFloat(costPrice) || 0,
      settlementAmount: parseFloat(settlementAmount) || 0,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      completionStatus: completionStatus || 'completed', // completed, rework, inventory
      remarks: remarks || '',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: '创建成功',
    data: { _id: result._id }
  }
}

// 获取工作记录列表
async function getWorkList(data) {
  const { craftsmanId, status, page = 1, pageSize = 20 } = data
  
  let where = {}
  if (craftsmanId) {
    where.craftsmanId = craftsmanId
  }
  if (status) {
    where.completionStatus = status
  }
  
  const total = await db.collection('craftsmanWorks').where(where).count()
  
  const list = await db.collection('craftsmanWorks')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total,
      page,
      pageSize
    }
  }
}

// 获取工作记录详情
async function getWorkDetail(data) {
  const { workId } = data
  
  const work = await db.collection('craftsmanWorks').doc(workId).get()
  
  return {
    code: 0,
    data: work.data
  }
}

// 更新工作记录
async function updateWork(data) {
  const { id, ...updateData } = data
  
  // 转换数字类型
  if (updateData.costPrice !== undefined) {
    updateData.costPrice = parseFloat(updateData.costPrice) || 0
  }
  if (updateData.settlementAmount !== undefined) {
    updateData.settlementAmount = parseFloat(updateData.settlementAmount) || 0
  }
  if (updateData.deliveryDate) {
    updateData.deliveryDate = new Date(updateData.deliveryDate)
  }
  
  await db.collection('craftsmanWorks').doc(id).update({
    data: {
      ...updateData,
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '更新成功' }
}

// 删除工作记录
async function deleteWork(data) {
  const { workId } = data
  
  await db.collection('craftsmanWorks').doc(workId).remove()
  
  return { code: 0, message: '删除成功' }
}

// 获取统计信息
async function getWorkStats(data) {
  const { craftsmanId } = data
  
  let where = {}
  if (craftsmanId) {
    where.craftsmanId = craftsmanId
  }
  
  // 总记录数
  const totalCount = await db.collection('craftsmanWorks').where(where).count()
  
  // 各状态数量
  const completedCount = await db.collection('craftsmanWorks').where({
    ...where,
    completionStatus: 'completed'
  }).count()
  
  const reworkCount = await db.collection('craftsmanWorks').where({
    ...where,
    completionStatus: 'rework'
  }).count()
  
  const inventoryCount = await db.collection('craftsmanWorks').where({
    ...where,
    completionStatus: 'inventory'
  }).count()
  
  // 总成本
  const works = await db.collection('craftsmanWorks').where(where).get()
  const totalCost = works.data.reduce((sum, item) => sum + (item.costPrice || 0), 0)
  const totalSettlement = works.data.reduce((sum, item) => sum + (item.settlementAmount || 0), 0)
  
  return {
    code: 0,
    data: {
      totalCount: totalCount.total,
      completedCount: completedCount.total,
      reworkCount: reworkCount.total,
      inventoryCount: inventoryCount.total,
      totalCost: totalCost.toFixed(2),
      totalSettlement: totalSettlement.toFixed(2),
      profit: (totalSettlement - totalCost).toFixed(2)
    }
  }
}
