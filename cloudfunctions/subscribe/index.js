const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, tmplIds } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'saveSubscribe':
        return await saveSubscribe(OPENID, tmplIds)
      case 'getSubscribers':
        return await getSubscribers(tmplIds)
      case 'removeSubscribe':
        return await removeSubscribe(OPENID, tmplIds)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 保存订阅记录
async function saveSubscribe(openid, tmplIds) {
  if (!Array.isArray(tmplIds) || tmplIds.length === 0) {
    return { code: -1, message: '模板ID不能为空' }
  }
  
  for (const tmplId of tmplIds) {
    // 检查是否已存在
    const exist = await db.collection('subscribers').where({
      openid,
      tmplId
    }).get()
    
    if (exist.data.length === 0) {
      // 添加新记录
      await db.collection('subscribers').add({
        data: {
          openid,
          tmplId,
          createTime: db.serverDate()
        }
      })
    }
  }
  
  return { code: 0, message: '订阅成功' }
}

// 获取订阅者列表
async function getSubscribers(tmplId) {
  const list = await db.collection('subscribers').where({
    tmplId
  }).get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 移除订阅
async function removeSubscribe(openid, tmplIds) {
  await db.collection('subscribers').where({
    openid,
    tmplId: _.in(tmplIds)
  }).remove()
  
  return { code: 0, message: '取消订阅成功' }
}
