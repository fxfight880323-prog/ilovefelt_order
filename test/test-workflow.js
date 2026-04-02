// 微信小程序测试脚本 - 完整工作流测试
// 使用方法: 在微信开发者工具控制台运行
// 使用: require('./test/test-workflow.js')

(function() {
console.log('🚀 开始测试完整角色审批流程...\n');

const results = [];

function log(name, pass, detail) {
  results.push({name, pass, detail});
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ': ' + detail : ''}`);
}

// 清理环境
console.log('🧹 清理测试环境...');
wx.removeStorageSync('users');
wx.removeStorageSync('currentUser');
wx.removeStorageSync('testPhone');
wx.removeStorageSync('testAppId');

let testPhone = null;

// 步骤1: 初始化管理员
async function step1() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 1. 初始化管理员               ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'initAdmin',
      data: { phone: '13810062394', password: '880323' }
    }
  });
  
  log('管理员初始化', res.result.code === 0, res.result.message);
}

// 步骤2: 注册新用户
async function step2() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 2. 注册新用户（手艺人）          ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  testPhone = '138' + Date.now().toString().slice(-8);
  wx.setStorageSync('testPhone', testPhone);
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'applyRole',
      data: {
        role: 'craftsman',
        applyData: {
          phone: testPhone,
          name: '测试手艺人',
          password: '123456',
          specialty: '针淫'
        }
      }
    }
  });
  
  log('用户注册', res.result.code === 0, 
    res.result.code === 0 ? `${testPhone}, 状态: ${res.result.data.status}` : res.result.message
  );
}

// 步骤3: 验证pending状态（登录被拦截）
async function step3() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 3. 验证pending状态               ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: testPhone, password: '123456' }
    }
  });
  
  const isBlocked = res.result.code === -1002 || res.result.code === -1003;
  log('登录被拦截', isBlocked, 
    isBlocked ? `错误码: ${res.result.code}` : '未被拦截'
  );
  log('正确显示审核状态', res.result.message?.includes('审核') || false);
}

// 步骤4: 管理员登录
async function step4() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 4. 管理员登录                   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: '13810062394', password: '880323' }
    }
  });
  
  log('管理员登录', res.result.code === 0, res.result.message);
  log('管理员权限', res.result.data?.isAdmin === true);
  log('角色列表', res.result.data?.roles?.includes('admin') || false, 
    res.result.data?.roles?.join(', ')
  );
}

// 步骤5: 获取待审批列表
async function step5() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 5. 获取待审批列表               ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getRoleApplications', data: { status: 'pending' } }
  });
  
  const list = res.result.data || [];
  log('获取待审批列表', res.result.code === 0, `${list.length} 条待审批`);
  
  if (list.length > 0 && testPhone) {
    console.log('   查找手机号:', testPhone);
    console.log('   列表中的手机号:', list.map(app => app.phone).join(', '));
  }
  
  if (list.length > 0) {
    // 找到我们刚刚创建的用户
    const targetApp = list.find(app => app.phone === testPhone);
    if (targetApp) {
      // 使用 _id 字段（格式: userId_role）
      wx.setStorageSync('testAppId', targetApp._id);
      log('找到测试用户审批', true, targetApp._id);
    } else {
      log('找到测试用户审批', false, `手机号 ${testPhone} 不在列表中`);
    }
  } else {
    log('待审批列表为空', false);
  }
}

// 步骤6: 执行审批
async function step6() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 6. 执行审批（管理员操作）       ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const appId = wx.getStorageSync('testAppId');
  
  if (!appId) {
    log('找到待审批项', false, '未找到应用ID');
    log('审批操作', false, '跳过');
    return;
  }
  
  const res = await wx.cloud.callFunction({
    name: 'admin',
    data: {
      action: 'reviewRoleApplication',
      data: {
        applicationId: appId,
        approved: true,
        reason: '测试通过'
      }
    }
  });
  
  log('审批操作', res.result.code === 0, res.result.message);
  
  if (res.result.code === 0) {
    console.log('   审批结果:', res.result.data);
  } else {
    console.log('   审批失败详情:', res.result);
  }
}

// 步骤7: 验证审批后登录
let step7UserData = null;
async function step7() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 7. 验证审批后登录               ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: testPhone, password: '123456' }
    }
  });
  
  log('审批后登录', res.result.code === 0, res.result.message);
  
  if (res.result.code !== 0) {
    console.log('   登录失败详情:', res.result);
  }
  
  if (res.result.code === 0) {
    step7UserData = res.result.data;
    log('拥有craftsman角色', 
      res.result.data?.roles?.includes('craftsman') || false,
      res.result.data?.roles?.join(', ')
    );
    log('有效的openid', !!res.result.data?.openid);
    log('有角色信息', !!res.result.data?.rolesInfo);
  }
}

// 步骤8: 数据隔离验证（模拟）
async function step8() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 8. 数据隔离验证              ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  // 使用步骤7返回的用户数据验证roleApplications状态
  if (!step7UserData) {
    log('获取用户数据', false, '步骤7未返回数据');
    return;
  }
  
  const roleApps = step7UserData.roleApplications || [];
  const craftsmanApp = roleApps.find(app => app.role === 'craftsman');
  
  log('获取用户数据', true);
  log('roleApplications状态', craftsmanApp?.status === 'active', craftsmanApp?.status);
  log('数据隔离正确', 
    !roleApps.some(app => app.role === 'dispatcher') || false,
    '只有craftsman角色'
  );
}

// 生成测试报告
function report() {
  console.log('\n' + '═'.repeat(60));
  console.log('📋 测试报告');
  console.log('═'.repeat(60));
  
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  
  console.log(`总计: ${results.length} 页`);
  console.log(`✅ 通过: ${passed} 页`);
  console.log(`❌ 失败: ${failed} 页`);
  console.log(`📊 通过率: ${Math.round(passed/results.length*100)}%`);
  
  if (failed > 0) {
    console.log('\n❌ 失败项目:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`   - ${r.name}: ${r.detail || ''}`);
    });
  } else if (passed > 0) {
    console.log('\n🎉 所有测试通过！角色审批流程正常工作。');
  }
  
  console.log('═'.repeat(60));
}

// 执行测试
(async function() {
  try {
    await step1();
    await step2();
    await step3();
    await step4();
    await step5();
    await step6();
    await step7();
    await step8();
    report();
  } catch (e) {
    console.error('💥 测试错误:', e);
    console.error(e.stack);
  }
})();

})();  // 关闭 IIFE
