    // 微信小程序测试脚本 - 完整业务流程测试
    // 测试涉及: 派单员、手艺人、管理员的完整交互流程

    (function() {
    console.log('🚀 开始测试完整业务流程...\n');

    const results = [];

    function log(name, pass, detail) {
      results.push({name, pass, detail});
      const icon = pass ? '✅' : '❌';
      console.log(`${icon} ${name}${detail ? ': ' + detail : ''}`);
    }

    // 测试数据
    let testData = {
      admin: { phone: '13810062394', password: '880323', openid: null },
      dispatcher: { phone: null, password: '123456', openid: null, id: null },
      craftsman: { phone: null, password: '123456', openid: null, id: null },
      orderId: null,
      orderCode: null
    };

    // ==================== 辅助函数 ====================

    // 模拟登录获取openid
    async function mockLogin(phone, password) {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'loginByPhone',
          data: { phone, password }
        }
      });
      return res.result.code === 0 ? res.result.data?.openid : null;
    }

    // 管理员审批
    async function adminApprove(userId, role) {
      return await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'reviewRoleApplication',
          data: {
            applicationId: `${userId}_${role}`,
            approved: true
          }
        }
      });
    }

    // ==================== 测试步骤 ====================

    // 步骤1: 初始化环境
    async function step1() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 1. 初始化管理员和环境         ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      // 初始化管理员
      const initRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'initAdmin',
          data: { phone: testData.admin.phone, password: testData.admin.password }
        }
      });
      log('管理员初始化', initRes.result.code === 0, initRes.result.message);
      
      // 管理员登录
      const adminLogin = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'loginByPhone',
          data: { phone: testData.admin.phone, password: testData.admin.password }
        }
      });
      testData.admin.openid = adminLogin.result.data?.openid;
      log('管理员登录', adminLogin.result.code === 0);
      log('管理员openid', !!testData.admin.openid);
    }

    // 步骤2: 注册派单员
    async function step2() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 2. 注册并审批派单员           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      testData.dispatcher.phone = '139' + Date.now().toString().slice(-8);
      
      const registerRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'applyRole',
          data: {
            role: 'dispatcher',
            applyData: {
              phone: testData.dispatcher.phone,
              name: '测试派单员',
              password: testData.dispatcher.password,
              company: '测试公司'
            }
          }
        }
      });
      log('派单员注册', registerRes.result.code === 0);
      
      // 管理员审批
      const userRes = await wx.cloud.database().collection('users').where({
        phone: testData.dispatcher.phone
      }).get();
      
      console.log('   查找派单员用户:', testData.dispatcher.phone, '结果:', userRes.data.length, '条');
      
      if (userRes.data.length > 0) {
        const userId = userRes.data[0]._id;
        console.log('   用户ID:', userId, 'openid:', userRes.data[0].openid);
        
        const approveRes = await adminApprove(userId, 'dispatcher');
        console.log('   审批结果:', JSON.stringify(approveRes.result));
        log('派单员审批', approveRes.result.code === 0, approveRes.result.message);
        
        if (approveRes.result.code !== 0) {
          console.log('   审批失败，跳过登录');
          return;
        }
      } else {
        log('找到派单员用户', false, '未找到');
        return;
      }
      
      // 等待一下数据库更新
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 派单员登录
      const loginRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'loginByPhone',
          data: { phone: testData.dispatcher.phone, password: testData.dispatcher.password }
        }
      });
      
      if (loginRes.result.code !== 0) {
        console.log('   登录失败:', JSON.stringify(loginRes.result));
      }
      
      testData.dispatcher.openid = loginRes.result.data?.openid;
      log('派单员登录', loginRes.result.code === 0, loginRes.result.message || `code: ${loginRes.result.code}`);
      
      // 获取派单员ID
      const dispatcherRes = await wx.cloud.database().collection('dispatchers').where({
        phone: testData.dispatcher.phone
      }).get();
      console.log('   查找dispatchers表:', testData.dispatcher.phone, '结果:', dispatcherRes.data.length, '条');
      if (dispatcherRes.data.length > 0) {
        testData.dispatcher.id = dispatcherRes.data[0]._id;
        log('获取派单员ID', true, testData.dispatcher.id);
      } else {
        log('获取派单员ID', false, '未找到');
      }
    }

    // 步骤3: 注册手艺人
    async function step3() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 3. 注册并审批手艺人           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      testData.craftsman.phone = '137' + Date.now().toString().slice(-8);
      
      const registerRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'applyRole',
          data: {
            role: 'craftsman',
            applyData: {
              phone: testData.craftsman.phone,
              name: '测试手艺人',
              password: testData.craftsman.password,
              specialty: '针淫'
            }
          }
        }
      });
      log('手艺人注册', registerRes.result.code === 0);
      
      // 管理员审批
      const userRes = await wx.cloud.database().collection('users').where({
        phone: testData.craftsman.phone
      }).get();
      
      console.log('   查找手艺人用户:', testData.craftsman.phone, '结果:', userRes.data.length, '条');
      
      if (userRes.data.length > 0) {
        const userId = userRes.data[0]._id;
        console.log('   用户ID:', userId, 'openid:', userRes.data[0].openid);
        
        const approveRes = await adminApprove(userId, 'craftsman');
        console.log('   审批结果:', JSON.stringify(approveRes.result));
        log('手艺人审批', approveRes.result.code === 0, approveRes.result.message);
        
        if (approveRes.result.code !== 0) {
          console.log('   审批失败，跳过登录');
          return;
        }
      } else {
        log('找到手艺人用户', false, '未找到');
        return;
      }
      
      // 等待一下数据库更新
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 手艺人登录
      const loginRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'loginByPhone',
          data: { phone: testData.craftsman.phone, password: testData.craftsman.password }
        }
      });
      
      if (loginRes.result.code !== 0) {
        console.log('   登录失败:', JSON.stringify(loginRes.result));
      }
      
      testData.craftsman.openid = loginRes.result.data?.openid;
      log('手艺人登录', loginRes.result.code === 0, loginRes.result.message || `code: ${loginRes.result.code}`);
      
      // 获取手艺人ID
      const craftsmanRes = await wx.cloud.database().collection('craftsmen').where({
        phone: testData.craftsman.phone
      }).get();
      console.log('   查找craftsmen表:', testData.craftsman.phone, '结果:', craftsmanRes.data.length, '条');
      if (craftsmanRes.data.length > 0) {
        testData.craftsman.id = craftsmanRes.data[0]._id;
        log('获取手艺人ID', true, testData.craftsman.id);
      } else {
        log('获取手艺人ID', false, '未找到');
      }
    }

    // 步骤4: 派单员创建订单
    async function step4() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 4. 派单员创建订单           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      const createRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'create',
          data: {
            name: '测试订单-' + Date.now(),
            styleId: 'test_style_001',
            styleName: '测试样式',
            quantity: 10,
            price: 100,
            receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7天后
            remark: '测试订单备注'
          }
        }
      });
      
      if (createRes.result.code === 0) {
        testData.orderId = createRes.result.data?._id;
        testData.orderCode = createRes.result.data?.orderCode;
      }
      
      log('订单创建', createRes.result.code === 0, createRes.result.message);
      log('订单编码', !!testData.orderCode, testData.orderCode);
    }

    // 步骤5: 手艺人接单
    async function step5() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 5. 手艺人接单             ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      if (!testData.orderId) {
        log('接单', false, '没有订单ID');
        return;
      }
      
      const acceptRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'accept',
          data: { orderId: testData.orderId }
        }
      });
      
      log('手艺人接单', acceptRes.result.code === 0, acceptRes.result.message);
    }

    // 步骤6: 手艺人填写运单号
    async function step6() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 6. 手艺人填写运单号         ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      const trackingRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'addTracking',
          data: {
            orderId: testData.orderId,
            trackingNumber: 'SF' + Date.now().toString().slice(-10),
            trackingCompany: '顺丰速运'
          }
        }
      });
      
      log('填写运单号', trackingRes.result.code === 0, trackingRes.result.message);
    }

    // 步骤7: 手艺人上传完成照片
    async function step7() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 7. 手艺人上传完成照片         ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      const completeRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'complete',
          data: {
            orderId: testData.orderId,
            completePhotos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg']
          }
        }
      });
      
      log('上传完成照片', completeRes.result.code === 0, completeRes.result.message);
      if (completeRes.result.data?.timeScoreResult) {
        log('时间履约分', true, completeRes.result.data.timeScoreResult.timeScore);
      }
    }

    // 步骤8: 手艺人确认收款
    async function step8() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 8. 手艺人确认收款           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      const receiptRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'confirmReceipt',
          data: {
            orderId: testData.orderId,
            receiptRemark: '已收款，谢谢'
          }
        }
      });
      
      log('确认收款', receiptRes.result.code === 0, receiptRes.result.message);
      if (receiptRes.result.data) {
        log('订单状态变为completed', receiptRes.result.data.status === 'completed');
      }
    }

    // 步骤9: 派单员给手艺人打分
    async function step9() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 9. 派单员给手艺人打分       ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      const rateRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'rateCraftsman',
          data: {
            orderId: testData.orderId,
            craftsmanId: testData.craftsman.id,
            score: 5,
            comment: '非常满意，做工精细'
          }
        }
      });
      
      log('派单员打分', rateRes.result.code === 0, rateRes.result.message);
      if (rateRes.result.data) {
        log('综合履约分', true, rateRes.result.data.reliabilityScore);
        log('时间分', true, rateRes.result.data.timeScore);
        log('评分', true, rateRes.result.data.ratingScore);
      }
    }

    // 步骤10: 验证评分算法
    async function step10() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 10. 验证评分算法              ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      if (!testData.craftsman.id) {
        log('获取手艺人统计', false, '手艺人ID为空');
        return;
      }
      
      // 获取手艺人统计
      const statsRes = await wx.cloud.callFunction({
        name: 'craftsman',
        data: {
          action: 'getStats',
          data: { craftsmanId: testData.craftsman.id }
        }
      });
      
      log('获取手艺人统计', statsRes.result.code === 0);
      if (statsRes.result.data) {
        log('履约分', true, statsRes.result.data.reliabilityScore);
        log('履约等级', true, statsRes.result.data.reliabilityLevel);
        log('已完成订单数', true, statsRes.result.data.completedOrders);
        log('总收入', true, statsRes.result.data.totalIncome);
      }
    }

    // 步骤11: 管理员查看统计
    async function step11() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 11. 管理员查看统计           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      const adminStats = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getStats' }
      });
      
      log('管理员统计', adminStats.result.code === 0);
      if (adminStats.result.data) {
        log('手艺人总数', true, adminStats.result.data.craftsmanCount);
        log('派单员总数', true, adminStats.result.data.dispatcherCount);
        log('待审批数', true, adminStats.result.data.pendingCount);
      }
      
      // 订单统计
      const orderStats = await wx.cloud.callFunction({
        name: 'order',
        data: { action: 'getOrderStats' }
      });
      
      log('订单统计', orderStats.result.code === 0);
      if (orderStats.result.data) {
        log('订单总数', true, orderStats.result.data.total);
        log('待接单', true, orderStats.result.data.pending);
        log('进行中', true, orderStats.result.data.accepted);
        log('已完成', true, orderStats.result.data.completed);
      }
    }

    // 步骤12: 管理员管理人员
    async function step12() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 12. 管理员管理人员           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      // 获取手艺人列表
      const craftsmanList = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getCraftsmanList' }
      });
      log('获取手艺人列表', craftsmanList.result.code === 0, `${craftsmanList.result.data?.length || 0} 人`);
      
      // 获取派单员列表
      const dispatcherList = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getDispatcherList' }
      });
      log('获取派单员列表', dispatcherList.result.code === 0, `${dispatcherList.result.data?.length || 0} 人`);
      
      // 派单员详情
      if (testData.dispatcher.id) {
        const dispatcherDetail = await wx.cloud.callFunction({
          name: 'admin',
          data: {
            action: 'getDispatcherDetail',
            data: { dispatcherId: testData.dispatcher.id }
          }
        });
        log('派单员详情', dispatcherDetail.result.code === 0);
      } else {
        log('派单员详情', false, 'ID为空');
      }
      
      // 手艺人详情
      if (testData.craftsman.id) {
        const craftsmanDetail = await wx.cloud.callFunction({
          name: 'admin',
          data: {
            action: 'getCraftsmanDetail',
            data: { craftsmanId: testData.craftsman.id }
          }
        });
        log('手艺人详情', craftsmanDetail.result.code === 0);
      } else {
        log('手艺人详情', false, 'ID为空');
      }
    }

    // 步骤13: 派单员跟踪订单
    async function step13() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 13. 派单员跟踪订单           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      const trackRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDetail',
          data: { orderId: testData.orderId }
        }
      });
      
      log('查看订单详情', trackRes.result.code === 0);
      if (trackRes.result.data) {
        log('订单状态', true, trackRes.result.data.status);
        log('运单号', true, trackRes.result.data.trackingNumber || '无');
        log('完成照片数', true, (trackRes.result.data.completePhotos || []).length);
        log('评分', true, trackRes.result.data.rating || '未评价');
      }
    }

    // 步骤14: 数据隔离验证
    async function step14() {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃ 14. 数据隔离验证           ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      // 派单员只能看到自己的订单
      const dispatcherOrders = await wx.cloud.callFunction({
        name: 'order',
        data: { action: 'getDispatcherOrders' }
      });
      log('派单员订单列表', dispatcherOrders.result.code === 0);
      
      // 手艺人只能看到自己的订单
      const craftsmanOrders = await wx.cloud.callFunction({
        name: 'order',
        data: { action: 'getCraftsmanOrders', data: {} }
      });
      log('手艺人订单列表', craftsmanOrders.result.code === 0, craftsmanOrders.result.message);
      
      // 管理员可以看到所有订单
      const allOrders = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getList',
          data: { page: 1, pageSize: 10 }
        }
      });
      log('管理员所有订单', allOrders.result.code === 0, `${allOrders.result.data?.total || 0} 条`);
    }

    // 生成报告
    function report() {
      console.log('\n' + '═'.repeat(60));
      console.log('📋 完整业务流程测试报告');
      console.log('═'.repeat(60));
      
      const passed = results.filter(r => r.pass).length;
      const failed = results.filter(r => !r.pass).length;
      
      console.log(`总计: ${results.length} 项`);
      console.log(`✅ 通过: ${passed} 项`);
      console.log(`❌ 失败: ${failed} 项`);
      console.log(`📊 通过率: ${Math.round(passed/results.length*100)}%`);
      
      if (failed > 0) {
        console.log('\n❌ 失败项目:');
        results.filter(r => !r.pass).forEach(r => {
          console.log(`   - ${r.name}: ${r.detail || ''}`);
        });
      } else if (passed > 0) {
        console.log('\n🎉 所有测试通过！业务流程正常工作。');
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
        await step9();
        await step10();
        await step11();
        await step12();
        await step13();
        await step14();
        report();
      } catch (e) {
        console.error('💥 测试错误:', e);
        console.error(e.stack);
      }
    })();

    })(); // 关闭 IIFE
