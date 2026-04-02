// 数据库操作诊断
(function() {

console.log('🔧 数据库操作诊断...\n');

const db = wx.cloud.database();
const _ = db.command;

// 测试手机号
const testPhone = '13800138000';

async function test() {
  try {
    // 1. 清理测试数据
    console.log('1. 清理旧数据...');
    const oldUsers = await db.collection('users').where({ phone: testPhone }).get();
    for (const user of oldUsers.data) {
      await db.collection('users').doc(user._id).remove();
      console.log('   删除旧用户:', user._id);
    }
    
    // 2. 直接插入测试数据
    console.log('\n2. 直接插入测试数据...');
    const addRes = await db.collection('users').add({
      data: {
        openid: 'test_openid_' + Date.now(),
        phone: testPhone,
        name: '测试用户',
        password: 'hashed_password',
        roles: [],
        roleApplications: [{
          role: 'dispatcher',
          status: 'pending',
          applyTime: db.serverDate(),
          applyData: { company: '测试公司' }
        }],
        isAdmin: false,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    console.log('   插入结果:', addRes);
    
    // 3. 查询数据
    console.log('\n3. 查询插入的数据...');
    const queryRes = await db.collection('users').where({ phone: testPhone }).get();
    console.log('   查询结果:', queryRes.data.length, '条');
    if (queryRes.data.length > 0) {
      console.log('   用户数据:', {
        _id: queryRes.data[0]._id,
        phone: queryRes.data[0].phone,
        name: queryRes.data[0].name,
        roles: queryRes.data[0].roles
      });
    }
    
    // 4. 测试云函数调用
    console.log('\n4. 测试云函数调用...');
    const cloudRes = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'applyRole',
        data: {
          role: 'craftsman',
          applyData: {
            phone: '138' + Date.now().toString().slice(-8),
            name: '测试手艺人',
            password: '123456',
            specialty: '针淫'
          }
        }
      }
    });
    console.log('   云函数返回:', JSON.stringify(cloudRes.result));
    
    // 5. 检查是否写入
    console.log('\n5. 检查云函数是否写入数据...');
    const afterCall = await db.collection('users').get();
    console.log('   总用户数:', afterCall.data.length);
    console.log('   最近用户:', afterCall.data.slice(-3).map(u => ({
      phone: u.phone,
      name: u.name,
      time: u.createTime
    })));
    
  } catch (err) {
    console.error('❌ 错误:', err);
  }
}

test();

})();
