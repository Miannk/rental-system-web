import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bell, 
  MonitorSmartphone, 
  BadgeDollarSign, 
  CalendarDays, 
  Search, 
  ChevronLeft,
  ArrowRight,
  UploadCloud,
  HardDrive
} from 'lucide-react';

export default function App() {
  // === 全局状态管理 ===
  const [activeTab, setActiveTab] = useState('todo'); // todo, equipment, rentals, heatmap
  
  // 核心数据源 (从 web_sync_data.json 导入)
  const [data, setData] = useState({ orders: [], computers: [] });
  const [isLoaded, setIsLoaded] = useState(false);

  // 用于跨页面高亮定位订单
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);

  // === 导入本地库功能 ===
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (jsonData.orders && jsonData.computers) {
          setData(jsonData);
          setIsLoaded(true);
          alert(`✅ 成功导入: ${jsonData.orders.length}条订单, ${jsonData.computers.length}台设备!`);
        } else {
          alert("❌ 数据格式不正确，请确保上传的是 export_data.py 生成的 JSON 文件！");
        }
      } catch (error) {
        alert("❌ 解析文件失败，请检查文件是否损坏！");
      }
    };
    reader.readAsText(file);
    // 重置 input 以便重复上传同一文件
    event.target.value = null;
  };

  // === 辅助计算函数 ===
  const calculateStatus = (order) => {
    const days = parseInt(order.days || 30);
    const renew = parseInt(order.renew_months || 0);
    const totalDays = days + renew * 30;
    
    const start = new Date(order.start_date);
    const end = new Date(start);
    end.setDate(start.getDate() + totalDays);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { 
      diffDays, 
      isOverdue: diffDays < 0, 
      isWarning: diffDays >= 0 && diffDays <= 3,
      totalDays
    };
  };

  // 触发定位跳转
  const handleJumpToOrder = (orderId) => {
    setHighlightedOrderId(orderId);
    setActiveTab('rentals');
  };

  // ==========================================
  // 1. 近期待办组件
  // ==========================================
  const TodoView = () => {
    const overdueOrders = [];
    const warningOrders = [];

    // 只过滤出 status === 'active' 的订单
    data.orders.filter(o => o.status === 'active').forEach(order => {
      const { diffDays, isOverdue, isWarning } = calculateStatus(order);
      if (isOverdue) overdueOrders.push({ ...order, diffDays });
      else if (isWarning) warningOrders.push({ ...order, diffDays });
    });

    // 排序：超期最多的排前面，快到期的天数最少的排前面
    overdueOrders.sort((a, b) => a.diffDays - b.diffDays);
    warningOrders.sort((a, b) => a.diffDays - b.diffDays);

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold text-white mb-6">近期待办事项</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 🚨 超期预警 */}
          <div className="border border-red-500/50 bg-red-950/20 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-red-500/30 pb-3">
              <h3 className="text-red-500 font-bold flex items-center gap-2">
                🚨 已超期
              </h3>
              <span className="text-gray-400 text-sm">共 {overdueOrders.length} 台</span>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {overdueOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无超期设备</p>
              ) : (
                overdueOrders.map(order => (
                  <div key={order.id} className="bg-gray-800/50 p-4 rounded-lg flex justify-between items-center hover:bg-gray-800 transition">
                    <div className="space-y-1">
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">客户：</span>{order.customer_name}</p>
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">电话：</span>{order.phone}</p>
                      <p className="text-red-400 text-sm font-medium"><span className="text-gray-500">编号：</span>{order.computer_sn} <span className="text-red-500 text-xs ml-1">(超{Math.abs(order.diffDays)}天)</span></p>
                    </div>
                    {/* 优化点 1: 跳转查看按钮 */}
                    <button 
                      onClick={() => handleJumpToOrder(order.id)}
                      className="flex items-center gap-1 bg-gray-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm transition-colors shadow"
                    >
                      <Search size={14} /> 查看
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ⚠️ 即将到期预警 */}
          <div className="border border-yellow-500/50 bg-yellow-950/20 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-yellow-500/30 pb-3">
              <h3 className="text-yellow-500 font-bold flex items-center gap-2">
                ⚠️ 即将到期 (3天内)
              </h3>
              <span className="text-gray-400 text-sm">共 {warningOrders.length} 台</span>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {warningOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无即将到期设备</p>
              ) : (
                warningOrders.map(order => (
                  <div key={order.id} className="bg-gray-800/50 p-4 rounded-lg flex justify-between items-center hover:bg-gray-800 transition">
                    <div className="space-y-1">
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">客户：</span>{order.customer_name}</p>
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">电话：</span>{order.phone}</p>
                      <p className="text-blue-400 text-sm font-medium"><span className="text-gray-500">编号：</span>{order.computer_sn} <span className="text-blue-400 text-xs ml-1">(剩{order.diffDays}天)</span></p>
                    </div>
                    {/* 优化点 1: 跳转查看按钮 */}
                    <button 
                      onClick={() => handleJumpToOrder(order.id)}
                      className="flex items-center gap-1 bg-gray-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm transition-colors shadow"
                    >
                      <Search size={14} /> 查看
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 2. 设备资料组件 (被恢复的页面)
  // ==========================================
  const EquipmentView = () => {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-white mb-6">设备资产卡片库</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.computers.map((comp, idx) => (
            <div key={idx} className="bg-[#1e2024] border border-[#3c3f41] rounded-xl p-4 shadow-sm hover:border-blue-500/50 transition-colors">
              <div className="flex justify-between items-center mb-3 border-b border-gray-700/50 pb-2">
                <span className="text-lg font-bold text-white">{comp.sn}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${comp.status === 'rented' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {comp.status === 'rented' ? '在租中' : '空闲'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                <div className="bg-gray-800/50 p-2 rounded"><span className="text-gray-500 block text-xs">CPU</span>{comp.cpu || '-'}</div>
                <div className="bg-gray-800/50 p-2 rounded"><span className="text-gray-500 block text-xs">显卡</span>{comp.gpu || '-'}</div>
                <div className="bg-gray-800/50 p-2 rounded"><span className="text-gray-500 block text-xs">内存</span>{comp.ram || '-'}</div>
                <div className="bg-gray-800/50 p-2 rounded"><span className="text-gray-500 block text-xs">硬盘</span>{comp.ssd || '-'}</div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-700/50 flex justify-between items-center">
                <span className="text-gray-400 text-sm">采购成本</span>
                <span className="text-blue-400 font-mono font-bold">¥ {Number(comp.cost || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ==========================================
  // 3. 实时租赁与收益组件
  // ==========================================
  const RentalsView = () => {
    // 优化点 1: 处理高亮滚动定位逻辑
    useEffect(() => {
      if (highlightedOrderId) {
        const el = document.getElementById(`order-${highlightedOrderId}`);
        if (el) {
          // 延迟一点滚动，确保 DOM 已经完全渲染
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
          
          // 4秒后自动取消高亮状态，恢复原状
          const timer = setTimeout(() => {
            setHighlightedOrderId(null);
          }, 4000);
          return () => clearTimeout(timer);
        }
      }
    }, [highlightedOrderId]);

    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-white mb-6">实时租赁与收益</h2>
        <div className="bg-gray-800/80 rounded-xl overflow-hidden shadow-xl border border-gray-700/50">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-4 py-4 font-medium">状态</th>
                <th className="px-4 py-4 font-medium">设备编号</th>
                <th className="px-4 py-4 font-medium">客户信息</th>
                <th className="px-4 py-4 font-medium">起租日期</th>
                <th className="px-4 py-4 font-medium">约定天数</th>
                <th className="px-4 py-4 font-medium">月租金</th>
                <th className="px-4 py-4 font-medium">累计已收</th>
                <th className="px-4 py-4 font-medium">进度预警</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.orders.map(order => {
                const { diffDays, isOverdue, totalDays } = calculateStatus(order);
                const isActive = order.status === 'active';
                const isHighlighted = order.id === highlightedOrderId;
                
                return (
                  <tr 
                    key={order.id} 
                    id={`order-${order.id}`}
                    // 闪烁高亮的核心 CSS 样式
                    className={`transition-all duration-700 ease-in-out ${
                      isHighlighted 
                        ? 'bg-blue-900/50 border-l-4 border-blue-400 scale-[1.01] shadow-[0_0_20px_rgba(59,130,246,0.3)] z-10 relative' 
                        : 'hover:bg-gray-700/30 border-l-4 border-transparent'
                    }`}
                  >
                    <td className="px-4 py-4">
                      {isActive 
                        ? <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span> 
                        : <span className="inline-flex h-2 w-2 rounded-full bg-gray-500"></span>}
                    </td>
                    <td className="px-4 py-4 font-bold text-white">{order.computer_sn || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="font-bold">{order.customer_name || '-'}</div>
                      <div className="text-xs text-gray-500 mt-1">{order.phone || '-'}</div>
                    </td>
                    <td className="px-4 py-4">{order.start_date}</td>
                    <td className="px-4 py-4">
                      {order.days}天 
                      {order.renew_months > 0 && <span className="text-blue-400 ml-1">(+{order.renew_months}月)</span>}
                    </td>
                    <td className="px-4 py-4 text-emerald-400 font-medium font-mono">¥{Number(order.monthly_rent || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-white font-mono">¥{Number(order.paid_rent || 0).toFixed(2)}</td>
                    <td className="px-4 py-4">
                      {!isActive ? (
                        <span className="px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400">已结单</span>
                      ) : isOverdue ? (
                        <span className="px-2.5 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">
                          超期 {Math.abs(diffDays)} 天
                        </span>
                      ) : diffDays <= 3 ? (
                        <span className="px-2.5 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                          剩 {diffDays} 天
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                          正常 (剩{diffDays}天)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ==========================================
  // 4. 收益热力图组件 (优化点2：支持点击看每日详情)
  // ==========================================
  const HeatmapView = () => {
    const [selectedMonth, setSelectedMonth] = useState(null); // e.g. '2026-04'

    // 计算每个月的总收益
    const monthlyData = useMemo(() => {
      const result = {};
      let total = 0;

      data.orders.forEach(order => {
        const mRent = parseFloat(order.monthly_rent || 0);
        const days = parseInt(order.days || 30);
        const renew = parseInt(order.renew_months || 0);
        const totalDays = days + renew * 30;
        
        if (totalDays <= 0 || mRent <= 0 || !order.computer_sn) return;
        
        const dailyRate = mRent / days; // 日租金算法与 Python 保持一致
        const start = new Date(order.start_date);
        
        // 计算每一天的收益归属
        for (let i = 0; i < totalDays; i++) {
          const currentDay = new Date(start);
          currentDay.setDate(start.getDate() + i);
          
          // 如果这天大于今天，不计算在已产生收益内
          const today = new Date();
          if (currentDay > today) continue;

          const monthKey = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}`;
          const displayLabel = `${currentDay.getFullYear()}年 ${String(currentDay.getMonth() + 1).padStart(2, '0')}月`;
          
          if (!result[monthKey]) {
            result[monthKey] = { label: displayLabel, revenue: 0 };
          }
          result[monthKey].revenue += dailyRate;
          total += dailyRate;
        }
      });

      const sortedKeys = Object.keys(result).sort();
      return { data: result, sortedKeys, total };
    }, [data.orders]);

    // 计算选中月份的【每日收益明细】
    const dailyData = useMemo(() => {
      if (!selectedMonth) return null;
      
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const dailyMap = {};
      for (let i = 1; i <= daysInMonth; i++) dailyMap[i] = 0;

      data.orders.forEach(order => {
        const mRent = parseFloat(order.monthly_rent || 0);
        const days = parseInt(order.days || 30);
        const renew = parseInt(order.renew_months || 0);
        const totalDays = days + renew * 30;
        
        if (totalDays <= 0 || mRent <= 0 || !order.computer_sn) return;
        
        const dailyRate = mRent / days;
        const start = new Date(order.start_date);
        const today = new Date();

        for (let i = 0; i < totalDays; i++) {
          const currentDay = new Date(start);
          currentDay.setDate(start.getDate() + i);
          
          if (currentDay > today) continue;

          if (currentDay.getFullYear() === Number(year) && (currentDay.getMonth() + 1) === Number(month)) {
             dailyMap[currentDay.getDate()] += dailyRate;
          }
        }
      });

      return dailyMap;
    }, [selectedMonth, data.orders]);

    // 视图 1：渲染月份概览图
    if (!selectedMonth) {
      return (
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2">历史月度收益总览</h2>
          <p className="text-emerald-400 font-medium mb-8">累计已产生收益：¥ {monthlyData.total.toFixed(2)}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {monthlyData.sortedKeys.map(key => {
              const item = monthlyData.data[key];
              // 颜色深浅算法 (30% -> 100%)
              const intensity = Math.min(100, Math.max(30, (item.revenue / 10000) * 100)); 
              
              return (
                <div 
                  key={key}
                  onClick={() => setSelectedMonth(key)}
                  className="relative p-4 rounded-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-lg group overflow-hidden border border-emerald-500/20"
                  style={{ backgroundColor: `rgba(16, 185, 129, ${intensity / 100})` }}
                >
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <h3 className="text-white text-sm font-bold mb-6 relative z-10">{item.label}</h3>
                  <div className="flex justify-end items-center relative z-10">
                    <span className="text-white font-mono text-xl font-bold tracking-tight">
                      ¥ {item.revenue.toFixed(0)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white/50 ml-2 group-hover:text-white transition-colors" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      );
    }

    // 视图 2：渲染选中月份的【每日日历网格图】
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    // 获取当月第一天是周几 (0是周日)
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); 

    return (
      <div className="p-6 animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setSelectedMonth(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
          >
            <ChevronLeft size={18} /> 返回概览
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{year}年 {month}月 - 每日收益明细</h2>
            <p className="text-emerald-400 text-sm mt-1">
              本月总计：¥ {monthlyData.data[selectedMonth]?.revenue.toFixed(2) || 0}
            </p>
          </div>
        </div>

        {/* 星期表头 */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-medium text-gray-500">
          <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-2">
          {/* 填充月初空白格 */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 rounded-xl bg-gray-900/30 border border-gray-800/50"></div>
          ))}

          {/* 每日格子渲染 */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const revenue = dailyData[day] || 0;
            
            // 热力颜色算法
            let bgColor = 'bg-gray-800/40';
            let textColor = 'text-gray-500';
            
            if (revenue > 0) {
              const maxDaily = Math.max(...Object.values(dailyData));
              // 最低透明度 0.25，最高 1
              const intensity = Math.max(0.25, revenue / maxDaily); 
              bgColor = `rgba(16, 185, 129, ${intensity})`; // emerald-500 体系
              textColor = 'text-white';
            }

            return (
              <div 
                key={day} 
                className="h-24 rounded-xl p-2 border border-gray-700/30 flex flex-col justify-between hover:border-emerald-500/50 transition-colors"
                style={{ backgroundColor: revenue > 0 ? bgColor : undefined }}
              >
                <div className={`text-sm font-bold ${textColor}`}>{day}</div>
                {revenue > 0 && (
                  <div className="text-right font-mono text-white text-sm font-bold shadow-sm">
                    +¥{revenue.toFixed(1)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // === 缺省页 (未导入数据时显示) ===
  const renderContent = () => {
    if (!isLoaded) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
          <HardDrive size={80} className="text-gray-700" />
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">系统初始化中...</h2>
            <p className="text-gray-400 max-w-md mx-auto">请点击右上角的<strong className="text-blue-400">【📤 导入本地库】</strong>按钮，上传由 Python 端生成的 <code className="bg-gray-800 px-2 py-1 rounded text-pink-400">web_sync_data.json</code> 文件以加载您的数据。</p>
          </div>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2">
            <UploadCloud size={20} />
            立即选择文件
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      );
    }

    if (activeTab === 'todo') return <TodoView />;
    if (activeTab === 'equipment') return <EquipmentView />;
    if (activeTab === 'rentals') return <RentalsView />;
    if (activeTab === 'heatmap') return <HeatmapView />;
  };

  // === 主页面结构 ===
  return (
    <div className="flex h-screen bg-[#111113] font-sans">
      {/* 左侧边栏 */}
      <div className="w-56 bg-[#18181b] border-r border-gray-800 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <MonitorSmartphone className="text-blue-500 mr-2" size={20} />
          <h1 className="text-white font-bold tracking-wide">租赁云管理 <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded ml-1">在线</span></h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2">
          <button onClick={() => setActiveTab('todo')} className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'todo' ? 'bg-[#27272a] text-blue-400' : 'text-gray-400 hover:bg-[#27272a] hover:text-white'}`}>
            <Bell size={18} className="mr-3" /> 近期待办
          </button>
          
          <button onClick={() => setActiveTab('equipment')} className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'equipment' ? 'bg-[#27272a] text-blue-400' : 'text-gray-400 hover:bg-[#27272a] hover:text-white'}`}>
            <HardDrive size={18} className="mr-3" /> 设备资料
          </button>

          <button onClick={() => setActiveTab('rentals')} className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'rentals' ? 'bg-[#27272a] text-blue-400' : 'text-gray-400 hover:bg-[#27272a] hover:text-white'}`}>
            <BadgeDollarSign size={18} className="mr-3" /> 实时租赁与收益
          </button>

          <button onClick={() => setActiveTab('heatmap')} className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'heatmap' ? 'bg-[#27272a] text-blue-400' : 'text-gray-400 hover:bg-[#27272a] hover:text-white'}`}>
            <CalendarDays size={18} className="mr-3" /> 收益热力图
          </button>
        </nav>
      </div>

      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* 顶部工具栏 (恢复了上传按钮) */}
        <header className="h-16 border-b border-gray-800 bg-[#18181b]/50 flex items-center justify-end px-6 shrink-0">
          <label className="cursor-pointer bg-[#27272a] hover:bg-gray-700 border border-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <UploadCloud size={16} className="text-blue-400" />
            📤 导入本地库 (JSON)
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </header>
        
        {/* 页面内容 */}
        <div className="flex-1 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
