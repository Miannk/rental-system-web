import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bell, 
  MonitorSmartphone, 
  BadgeDollarSign, 
  CalendarDays, 
  Search, 
  ChevronLeft,
  ArrowRight
} from 'lucide-react';

// === 模拟/初始数据，如果没有本地数据则使用这些 ===
const initialRecords = [
  { id: '1', customer: '张某风/今天乖不乖', phone: '14726101719', deviceId: 'A03', rent: 150, startDate: '2026-04-20', days: 4 },
  { id: '2', customer: 'A12姚越/Join111111', phone: '18051307972', deviceId: 'A22', rent: 300, startDate: '2026-04-21', days: 4 },
  { id: '3', customer: '李四', phone: '13800000000', deviceId: 'A21', rent: 200, startDate: '2026-04-22', days: 3 },
  { id: '4', customer: '王五', phone: '13900000000', deviceId: 'B01', rent: 6965, startDate: '2025-11-01', days: 30 },
  { id: '5', customer: '赵六', phone: '13700000000', deviceId: 'C02', rent: 12903, startDate: '2026-04-01', days: 30 },
];

export default function App() {
  // === 全局状态管理 ===
  const [activeTab, setActiveTab] = useState('todo'); // todo, devices, rentals, heatmap
  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem('rental_records');
    return saved ? JSON.parse(saved) : initialRecords;
  });
  
  // 用于跨页面高亮定位订单
  const [highlightedRecordId, setHighlightedRecordId] = useState(null);

  // 每次记录更新时保存到 LocalStorage
  useEffect(() => {
    localStorage.setItem('rental_records', JSON.stringify(records));
  }, [records]);

  // === 辅助计算函数 ===
  // 计算订单状态及剩余天数
  const calculateStatus = (record) => {
    const start = new Date(record.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + record.days);
    
    // 假设当前时间为截图中的 2026-04-25
    const today = new Date('2026-04-25'); // 实际使用中换成 new Date()
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { diffDays, isOverdue: diffDays < 0, isWarning: diffDays >= 0 && diffDays <= 3 };
  };

  // 触发定位跳转
  const handleJumpToRecord = (recordId) => {
    setHighlightedRecordId(recordId);
    setActiveTab('rentals');
  };

  // === 各页面组件 ===

  // 1. 近期待办 (近期到期 & 已超期)
  const TodoView = () => {
    const overdueRecords = [];
    const warningRecords = [];

    records.forEach(record => {
      const { diffDays, isOverdue, isWarning } = calculateStatus(record);
      if (isOverdue) overdueRecords.push({ ...record, diffDays });
      else if (isWarning) warningRecords.push({ ...record, diffDays });
    });

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold text-white mb-6">近期待办事项</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 超期预警 */}
          <div className="border border-red-500/50 bg-red-950/20 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-red-500/30 pb-3">
              <h3 className="text-red-500 font-bold flex items-center gap-2">
                🚨 已超期
              </h3>
              <span className="text-gray-400 text-sm">共 {overdueRecords.length} 台</span>
            </div>
            <div className="space-y-4">
              {overdueRecords.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无超期设备</p>
              ) : (
                overdueRecords.map(record => (
                  <div key={record.id} className="bg-gray-800/50 p-4 rounded-lg flex justify-between items-center hover:bg-gray-800 transition">
                    <div className="space-y-1">
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">客户：</span>{record.customer}</p>
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">电话：</span>{record.phone}</p>
                      <p className="text-red-400 text-sm font-medium"><span className="text-gray-500">编号：</span>{record.deviceId} <span className="text-red-500 text-xs ml-1">(超{Math.abs(record.diffDays)}天)</span></p>
                    </div>
                    <button 
                      onClick={() => handleJumpToRecord(record.id)}
                      className="flex items-center gap-1 bg-gray-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
                    >
                      <Search size={14} /> 查看
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 即将到期预警 */}
          <div className="border border-yellow-500/50 bg-yellow-950/20 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-yellow-500/30 pb-3">
              <h3 className="text-yellow-500 font-bold flex items-center gap-2">
                ⚠️ 即将到期 (3天内)
              </h3>
              <span className="text-gray-400 text-sm">共 {warningRecords.length} 台</span>
            </div>
            <div className="space-y-4">
              {warningRecords.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无即将到期设备</p>
              ) : (
                warningRecords.map(record => (
                  <div key={record.id} className="bg-gray-800/50 p-4 rounded-lg flex justify-between items-center hover:bg-gray-800 transition">
                    <div className="space-y-1">
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">客户：</span>{record.customer}</p>
                      <p className="text-gray-200 text-sm"><span className="text-gray-500">电话：</span>{record.phone}</p>
                      <p className="text-blue-400 text-sm font-medium"><span className="text-gray-500">编号：</span>{record.deviceId} <span className="text-blue-400 text-xs ml-1">(剩{record.diffDays}天)</span></p>
                    </div>
                    <button 
                      onClick={() => handleJumpToRecord(record.id)}
                      className="flex items-center gap-1 bg-gray-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
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

  // 2. 实时租赁与收益 (订单列表)
  const RentalsView = () => {
    // 处理高亮滚动逻辑
    useEffect(() => {
      if (highlightedRecordId) {
        const el = document.getElementById(`record-${highlightedRecordId}`);
        if (el) {
          // 延迟一点滚动，确保DOM已渲染
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
          
          // 3秒后取消高亮状态
          const timer = setTimeout(() => {
            setHighlightedRecordId(null);
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    }, [highlightedRecordId]);

    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-white mb-6">实时租赁与收益</h2>
        <div className="bg-gray-800/80 rounded-xl overflow-hidden shadow-xl border border-gray-700/50">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">设备编号</th>
                <th className="px-6 py-4 font-medium">客户信息</th>
                <th className="px-6 py-4 font-medium">起租日期</th>
                <th className="px-6 py-4 font-medium">租期(天)</th>
                <th className="px-6 py-4 font-medium">租金(元)</th>
                <th className="px-6 py-4 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {records.map(record => {
                const { diffDays, isOverdue } = calculateStatus(record);
                const isHighlighted = record.id === highlightedRecordId;
                
                return (
                  <tr 
                    key={record.id} 
                    id={`record-${record.id}`}
                    // 高亮选中时的动态样式
                    className={`transition-all duration-500 ${
                      isHighlighted 
                        ? 'bg-blue-900/40 border-l-4 border-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.3)]' 
                        : 'hover:bg-gray-700/30 border-l-4 border-transparent'
                    }`}
                  >
                    <td className="px-6 py-4 font-bold text-white">{record.deviceId}</td>
                    <td className="px-6 py-4">
                      <div>{record.customer}</div>
                      <div className="text-xs text-gray-500 mt-1">{record.phone}</div>
                    </td>
                    <td className="px-6 py-4">{record.startDate}</td>
                    <td className="px-6 py-4">{record.days}</td>
                    <td className="px-6 py-4 text-emerald-400 font-medium font-mono">¥{record.rent}</td>
                    <td className="px-6 py-4">
                      {isOverdue ? (
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

  // 3. 收益热力图 (支持点击月份查看每日详情)
  const HeatmapView = () => {
    const [selectedMonth, setSelectedMonth] = useState(null); // e.g. '2026-04'

    // 计算每个月的总收益
    const monthlyData = useMemo(() => {
      const data = {};
      let total = 0;
      records.forEach(record => {
        const date = new Date(record.startDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const displayLabel = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月`;
        
        if (!data[monthKey]) {
          data[monthKey] = { label: displayLabel, revenue: 0 };
        }
        data[monthKey].revenue += Number(record.rent);
        total += Number(record.rent);
      });
      // 排序：按时间倒序或正序
      const sortedKeys = Object.keys(data).sort();
      return { data, sortedKeys, total };
    }, [records]);

    // 如果选中了月份，计算该月每日的收益
    const dailyData = useMemo(() => {
      if (!selectedMonth) return null;
      
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const dailyMap = {};
      for (let i = 1; i <= daysInMonth; i++) {
        dailyMap[i] = 0;
      }

      // 将订单租金平摊到每一天 (简单的按日均摊逻辑)
      records.forEach(record => {
        const dailyRent = record.rent / record.days;
        const start = new Date(record.startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + record.days - 1);

        // 遍历这笔订单的每一天
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month)) {
             dailyMap[d.getDate()] += dailyRent;
          }
        }
      });

      return dailyMap;
    }, [selectedMonth, records]);

    // 渲染月份概览图
    if (!selectedMonth) {
      return (
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2">历史月度收益总览</h2>
          <p className="text-emerald-400 font-medium mb-8">累计已产生收益：¥ {monthlyData.total.toFixed(2)}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {monthlyData.sortedKeys.map(key => {
              const item = monthlyData.data[key];
              // 颜色深浅由收益决定 (简单的透明度逻辑)
              const intensity = Math.min(100, Math.max(40, (item.revenue / 5000) * 100)); 
              
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

    // 渲染选中月份的每日网格图 (日历形式)
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    // 获取当月第一天是星期几，用于日历排版对齐 (0是周日)
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); 

    return (
      <div className="p-6 animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setSelectedMonth(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
          >
            <ChevronLeft size={18} /> 返回月度
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{year}年 {month}月 每日收益热力图</h2>
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

          {/* 每日数据 */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const revenue = dailyData[day] || 0;
            
            // 计算热力颜色深浅：0收益是灰色，有收益是绿色渐变
            let bgColor = 'bg-gray-800/40';
            let textColor = 'text-gray-500';
            
            if (revenue > 0) {
              const maxDaily = Math.max(...Object.values(dailyData));
              const intensity = Math.max(0.3, revenue / maxDaily); // 最小不透明度 0.3
              bgColor = `rgba(16, 185, 129, ${intensity})`; // emerald-500
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

  // === 侧边栏及主结构 ===
  return (
    <div className="flex h-screen bg-[#111113] font-sans">
      {/* 侧边栏 */}
      <div className="w-56 bg-[#18181b] border-r border-gray-800 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <MonitorSmartphone className="text-blue-500 mr-2" size={20} />
          <h1 className="text-white font-bold tracking-wide">租赁云管理 <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded ml-1">在线</span></h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2">
          <button 
            onClick={() => setActiveTab('todo')}
            className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'todo' ? 'bg-[#27272a] text-blue-400' : 'text-gray-400 hover:bg-[#27272a] hover:text-white'}`}
          >
            <Bell size={18} className="mr-3" />
            近期待办
          </button>
          
          <button 
            onClick={() => setActiveTab('rentals')}
            className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'rentals' ? 'bg-[#27272a] text-blue-400' : 'text-gray-400 hover:bg-[#27272a] hover:text-white'}`}
          >
            <BadgeDollarSign size={18} className="mr-3" />
            实时租赁与收益
          </button>

          <button 
            onClick={() => setActiveTab('heatmap')}
            className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'heatmap' ? 'bg-[#27272a] text-blue-400' : 'text-gray-400 hover:bg-[#27272a] hover:text-white'}`}
          >
            <CalendarDays size={18} className="mr-3" />
            收益热力图
          </button>
        </nav>
        
        <div className="p-4 border-t border-gray-800">
           <div className="text-xs text-gray-500 text-center">v2.1 Pro Edition</div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'todo' && <TodoView />}
        {activeTab === 'rentals' && <RentalsView />}
        {activeTab === 'heatmap' && <HeatmapView />}
      </div>
    </div>
  );
}
