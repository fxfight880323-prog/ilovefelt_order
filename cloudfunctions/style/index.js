const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, data } = event
  
  try {
    switch (action) {
      case 'getList':
        return await getStyleList()
      case 'add':
        return await addStyle(data)
      case 'update':
        return await updateStyle(data)
      case 'delete':
        return await deleteStyle(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 获取样式列表
async function getStyleList() {
  const list = await db.collection('styles')
    .orderBy('createTime', 'desc')
    .get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 添加样式
async function addStyle(data) {
  const { name } = data
  
  // 检查是否已存在
  const exist = await db.collection('styles').where({ name }).get()
  if (exist.data.length > 0) {
    return { code: -1, message: '该样式已存在' }
  }
  
  const result = await db.collection('styles').add({
    data: {
      name,
      createTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: '添加成功',
    data: {
      _id: result._id,
      name
    }
  }
}

// 更新样式
async function updateStyle(data) {
  const { id, name } = data
  
  // 检查是否已存在（排除自己）
  const exist = await db.collection('styles').where({
    name,
    _id: _.neq(id)
  }).get()
  
  if (exist.data.length > 0) {
    return { code: -1, message: '该样式名称已存在' }
  }
  
  await db.collection('styles').doc(id).update({
    data: {
      name,
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '更新成功' }
}

// 删除样式
async function deleteStyle(data) {
  const { id } = data
  
  await db.collection('styles').doc(id).remove()
  
  return { code: 0, message: '删除成功' }
}
