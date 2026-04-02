// 创建测试数据 - 简化版
(function() {

console.log('🚀 创建测试数据...\n');

const db = wx.cloud.database();

// 简单哈希
function hash(pwd) {
  return 'sha256_' + pwd.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
}

// 测试账号
const accounts = {
  admin: { phone: '13810062394', pwd: '880323', name: '管理员' },
  dispatcher: { phone: '139' + Date.now().toString().slice(-8), pwd: '123456', name: '测试派单员' },
  craftsman: { phone: '137' + (Date.now()+1).toString().slice(-8), pwd: '123456', name: '测试手艺人' }
};

console.log('测试账号:');
console.log('  管理员:', accounts.admin.phone, '/ 密码:', accounts.admin.pwd);
console.log('  派单员:', accounts.dispatcher.phone, '/ 密码:', accounts.dispatcher.pwd);
console.log('  手艺人:', accounts.craftsman.phone, '/ 密码:', accounts.craftsman.pwd);

// 创建管理员
async function createAdmin() {
  const user = await db.collection('users').add({
    data: {
      openid: 'admin_' + Date.now(),
      phone: accounts.admin.phone,
      password: hash(accounts.admin.pwd),
      name: accounts.admin.name,
      roles: ['admin', 'dispatcher'],
      isAdmin: true,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  
  await db.collection('dispatchers').add({
    data: {
      userId: user._id,
      openid: 'admin_' + Date.now(),
      name: accounts.admin.name,
      phone: accounts.admin.phone,
      company: '管理员',
      status: 'active',
      createTime: db.serverDate()
    }
  });
  
  console.log('✅ 管理员创建成功');
  return user._id;
}

// 创建派单员
async function createDispatcher() {
  const user = await db.collection('users').add({
    data: {
      openid: 'dispatcher_' + Date.now(),
      phone: accounts.dispatcher.phone,
      password: hash(accounts.dispatcher.pwd),
      name: accounts.dispatcher.name,
      roles: ['dispatcher'],
      isAdmin: false,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  
  const disp = await db.collection('dispatchers').add({
    data: {
      userId: user._id,
      openid: 'dispatcher_' + Date.now(),
      name: accounts.dispatcher.name,
      phone: accounts.dispatcher.phone,
      company: '测试公司',
      status: 'active',
      createTime: db.serverDate()
    }
  });
  
  console.log('✅ 派单员创建成功:', accounts.dispatcher.phone);
  return disp._id;
}

// 创建手艺人
async function createCraftsman() {
  const user = await db.collection('users').add({
    data: {
      openid: 'craftsman_' + Date.now(),
      phone: accounts.craftsman.phone,
      password: hash(accounts.craftsman.pwd),
      name: accounts.craftsman.name,
      roles: ['craftsman'],
      isAdmin: false,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  
  const craft = await db.collection('craftsmen').add({
    data: {
      userId: user._id,
      openid: 'craftsman_' + Date.now(),
      name: accounts.craftsman.name,
      phone: accounts.craftsman.phone,
      specialty: '针淫',
      starLevel: 3,
      rating: 5,
      reliabilityScore: 5,
      reliabilityLevel: '优秀',
      status: 'active',
      createTime: db.serverDate()
    }
  });
  
  console.log('✅ 手艺人创建成功:', accounts.craftsman.phone);
  return craft._id;
}

// 执行
(async () => {
  try {
    await createAdmin();
    const dispatcherId = await createDispatcher();
    const craftsmanId = await createCraftsman();
    
    console.log('\n✅ 测试数据创建完成！');
    console.log('\n可以使用以下账号测试小程序:');
    console.log('  管理员:', accounts.admin.phone, '/', accounts.admin.pwd);
    console.log('  派单员:', accounts.dispatcher.phone, '/ 123456');
    console.log('  手艺人:', accounts.craftsman.phone, '/ 123456');
    
  } catch (e) {
    console.error('❌ 错误:', e);
  }
})();

})();
