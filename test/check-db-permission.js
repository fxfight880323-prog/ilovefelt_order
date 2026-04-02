// 检查数据库权限
(async function() {
  console.log('🔧 检查数据库权限...\n');
  
  const db = wx.cloud.database();
  
  // 测试直接写入
  console.log('1. 测试直接写入 users 表...');
  try {
    const res = await db.collection('users').add({
      data: {
        test: true,
        time: new Date().toISOString()
      }
    });
    console.log('   ✅ 写入成功:', res._id);
    
    // 清理
    await db.collection('users').doc(res._id).remove();
    console.log('   ✅ 清理成功');
  } catch (e) {
    console.log('   ❌ 写入失败:', e.message);
  }
  
  // 测试云函数写入
  console.log('\n2. 测试通过云函数写入...');
  const cloudRes = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'applyRole',
      data: {
        role: 'craftsman',
        applyData: {
          phone: 'test_' + Date.now(),
          name: '权限测试',
          password: '123'
        }
      }
    }
  });
  
  console.log('   云函数返回:', cloudRes.result.code === 0 ? '成功' : '失败');
  console.log('   消息:', cloudRes.result.message);
  
  // 检查云函数日志
  console.log('\n3. 请检查云开发控制台的云函数日志');
  console.log('   路径: 云开发 -> 云函数 -> user -> 日志');
  
})();
