// 诊断 applyRole 云函数问题
(function() {

console.log('🔧 诊断 applyRole 云函数...\n');

const db = wx.cloud.database();

const testPhone = '138' + Date.now().toString().slice(-8);

console.log('测试手机号:', testPhone);

async function diagnose() {
  // 1. 调用云函数
  console.log('\n1. 调用 applyRole 云函数...');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'applyRole',
      data: {
        role: 'dispatcher',
        applyData: {
          phone: testPhone,
          name: '测试用户',
          password: '123456',
          company: '测试公司'
        }
      }
    }
  });
  
  console.log('   返回结果:', JSON.stringify(res.result));
  
  // 2. 等待并查询
  console.log('\n2. 等待1秒后查询数据库...');
  await new Promise(r => setTimeout(r, 1000));
  
  const users = await db.collection('users').where({ phone: testPhone }).get();
  console.log('   查找结果:', users.data.length, '条记录');
  
  if (users.data.length === 0) {
    console.log('   ❌ 数据库中没有记录！');
    
    // 检查所有用户
    const all = await db.collection('users').get();
    console.log('\n3. 检查所有用户:', all.data.length, '人');
    
    if (all.data.length > 0) {
      console.log('   最近3个用户:');
      all.data.slice(-3).forEach(u => {
        console.log('     -', u.phone, u.name);
      });
    }
  } else {
    console.log('   ✅ 找到记录:');
    console.log('     _id:', users.data[0]._id);
    console.log('     phone:', users.data[0].phone);
    console.log('     name:', users.data[0].name);
    console.log('     roles:', users.data[0].roles);
    console.log('     openid:', users.data[0].openid);
  }
}

diagnose().catch(e => console.error('错误:', e));

})();
