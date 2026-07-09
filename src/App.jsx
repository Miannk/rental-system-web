                    className="w-full pl-11 pr-10 py-3 bg-[#111214] text-white rounded-xl border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm md:text-base transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white bg-gray-700 rounded-full p-1 transition">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <KpiCard title="总客户数" value={globalKpis.custs} />
                <KpiCard title="在租设备" value={globalKpis.rented} />
                <KpiCard title="日租" value={`¥ ${globalKpis.daily}`} color="text-orange-500" />
                <KpiCard title="累计收益" value={`¥ ${globalKpis.rev}`} color="text-emerald-500" />
                <KpiCard title="流水总额" value={`¥ ${globalKpis.flow}`} color="text-blue-400" className="col-span-2 lg:col-span-1" />
              </div>

              <div className="flex justify-between items-center mb-6 bg-[#22252b] p-2 rounded-lg border border-gray-800">
                <span className="text-gray-400 text-xs md:text-sm font-bold ml-2 shrink-0">智能排序挖掘:</span>
                <div className="flex space-x-1.5 md:space-x-2 overflow-x-auto no-scrollbar">
                  {['最新', '收益最高', '最快到期', '设备最多'].map(s => (
                    <button key={s} onClick={() => setCustomerSort(s)} className={`whitespace-nowrap px-3 py-1 text-xs font-bold rounded transition ${customerSort === s ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-700'}`}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="pb-20">
                {sortedCustomerEntries.length === 0 ? (
                  <div className="text-center text-gray-500 py-20 bg-[#22252b] rounded-xl border border-gray-800">
                    {searchQuery ? "没有搜到相关订单哦~" : "当前没有数据，或者筛选分类下为空。"}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
                    {sortedCustomerEntries.map(([cid, data]) => (
                      <CustomerCard key={cid} cid={cid} data={data} onSelect={setSelectedCustomerId} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        ) : activeTab === 'home' ? (
          <HomeTab orders={processedOrders} onJump={(id) => { setHighlightedOrderId(id); setActiveTab('rental'); }} onQuickRenew={handleQuickRenew} />
        ) : activeTab === 'equipment' ? (
          <EquipmentTab computers={computers} orders={processedOrders} isCloudMode={isCloudMode} user={user} db={db} appId={appId} onPreviewImage={setPreviewImage} />
        ) : activeTab === 'calendar' ? (
          <CalendarTab orders={processedOrders} />
        ) : null}
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1c20] border-t border-gray-800 flex justify-around items-center z-[999999] h-16 pb-safe shadow-[0_-4px_15px_rgba(0,0,0,0.8)]">
        {navTabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedCustomerId(null); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === tab.id ? 'text-blue-400' : 'text-gray-500'}`}>
            <span className={`text-xl mb-1 ${activeTab === tab.id ? 'scale-110' : ''} transition-transform`}>{tab.icon}</span>
            <span className="text-[10px] font-bold">{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* 图片全屏预览组件 */}
      {previewImage && (
        <div className="fixed inset-0 z-[999999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[90vh] object-contain cursor-zoom-out shadow-2xl rounded" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 md:top-8 md:right-8 text-white bg-white/10 hover:bg-white/30 rounded-full p-2 transition" onClick={() => setPreviewImage(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, color = "text-white", className = "" }) {
  return (
    <div className={`bg-[#22252b] rounded-xl p-4 border border-gray-800 flex flex-col items-center justify-center shadow-sm ${className}`}>
      <span className="text-gray-400 text-xs font-medium mb-1 truncate w-full text-center">{title}</span>
      <span className={`text-xl lg:text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

function CustomerCard({ cid, data, onSelect }) {
  let activeCount = 0, overdueCount = 0, tDaily = 0, tAcc = 0, tPaid = 0;
  let fastestRemD = Infinity;
  let fastestRatio = 0;

  data.orders.forEach(o => {
    if (o.computerSn) {
      if (o._effectiveStatus === 'active') { 
        activeCount++; 
        if (o._remD < 0) {
          overdueCount++;
        }
        if (o._remD >= 0) {
           tDaily += o._dailyRate; 
        }
        
        if (o._remD < fastestRemD) {
            fastestRemD = o._remD;
            fastestRatio = o._totalDays > 0 ? Math.min(Math.max(0, o._el) / o._totalDays, 1) : 0;
        }
      }
      tAcc += o._dailyRate * Math.max(0, Math.min(o._el, o._totalDays));
      tPaid += Number(o.paidRent) || 0;
    }
  });

  const statusTag = overdueCount > 0 
    ? <div className="text-[10px] font-bold px-2 py-1 rounded shrink-0 bg-red-500/20 text-red-400 whitespace-nowrap">超期 {overdueCount}</div>
    : activeCount > 0 
      ? <div className="text-[10px] font-bold px-2 py-1 rounded shrink-0 bg-blue-500/20 text-blue-400 whitespace-nowrap">在租 {activeCount}</div>
      : <div className="text-[10px] font-bold px-2 py-1 rounded shrink-0 bg-gray-700 text-gray-400 whitespace-nowrap">空闲</div>;

  const barColor = fastestRemD < 3 ? "bg-red-500" : "bg-emerald-500";

  return (
    <div onClick={() => onSelect(cid)} className="bg-[#1e2024] rounded-xl border border-[#3c3f41] p-4 cursor-pointer hover:border-gray-500 transition-all hover:scale-105 shadow-sm group relative flex flex-col min-h-[10rem] h-auto">
      <div className="flex-1">
         <div className="flex justify-between items-start mb-2">
            <div className="font-bold text-white text-lg truncate pr-2 group-hover:text-blue-400 transition-colors">{data.name || '未命名客户'}</div>
            {statusTag}
         </div>
         <div className="flex items-center justify-between gap-2 mb-3">
           <div className="text-gray-400 text-xs flex items-center gap-1 min-w-0 truncate"><Phone size={12} className="shrink-0"/>{data.phone || '无电话'}</div>
           <div className="text-blue-400 text-xs font-bold whitespace-nowrap">押金 ¥{(Number(data.deposit) || 0).toFixed(2)}</div>
         </div>
      </div>
      
      <div className="flex justify-between items-end border-t border-[#333] pt-2 mb-2">
         <div className="flex-shrink-0">
            <div className="text-gray-500 text-[10px] mb-0.5 whitespace-nowrap">日租</div>
            <div className="text-orange-500 font-bold text-xs sm:text-sm whitespace-nowrap">¥{tDaily.toFixed(1)}</div>
         </div>
         <div className="text-right flex-shrink-0 ml-2">
            <div className="text-gray-500 text-[10px] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">累计收益 / 已收</div>
            <div className="text-emerald-500 font-bold text-xs sm:text-sm tracking-tight whitespace-nowrap">
               ¥{tAcc.toFixed(1)} <span className="text-gray-500 text-[10px] sm:text-[11px] font-normal tracking-normal ml-0.5">/{tPaid.toFixed(1)}</span>
            </div>
         </div>
      </div>

      {activeCount > 0 && (
         <div className="w-full mt-auto pt-1">
            <div className="flex justify-between text-[9px] text-gray-500 mb-1 font-bold">
               <span>最快到期进度</span>
               <span className={fastestRemD < 0 ? "text-red-400" : "text-emerald-500"}>
                  {fastestRemD < 0 ? `超期 ${Math.abs(Math.floor(fastestRemD))} 天` : `剩 ${Math.floor(fastestRemD)} 天`}
               </span>
            </div>
            <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
               <div className={`h-full ${barColor}`} style={{ width: `${fastestRatio * 100}%` }}></div>
            </div>
         </div>
      )}
    </div>
  );
}

function CustomerDetailView({ cid, data, onBack, onUpdateCustomer, onAddDevice, onDeleteCustomer, onUpdateOrder, onDeleteOrder, onQuickRenew, highlightedOrderId, computers, orders, onPreviewImage }) {
  let activeCount = 0, overdueCount = 0, tDaily = 0, tAcc = 0, tPaid = 0;

  const sortedOrders = [...data.orders].sort((a, b) => {
    const timeA = a.createdAt || new Date(a.startDate || 0).getTime();
    const timeB = b.createdAt || new Date(b.startDate || 0).getTime();
    return timeA - timeB;
  });

  sortedOrders.forEach(o => {
    if (o.computerSn) {
      if (o._effectiveStatus === 'active') { 
        activeCount++; 
        if (o._remD < 0) overdueCount++;
        if (o._remD >= 0) tDaily += o._dailyRate; 
      }
      tAcc += o._dailyRate * Math.max(0, Math.min(o._el, o._totalDays));
      tPaid += Number(o.paidRent) || 0;
    }
  });

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <button onClick={onBack} className="self-start md:self-auto bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg flex items-center transition">
          <ChevronLeft size={16} className="mr-1"/> 返回客户列表
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
          客户订单详情 <span className="text-blue-500 text-sm align-top">V4</span>
        </h2>
      </div>

      <div className="bg-[#1e2024] rounded-xl border border-[#3c3f41] overflow-hidden shadow-xl">
        <div className="p-4 md:p-6 bg-[#262930] flex flex-col gap-5 border-b border-[#333842]">
          
          <div className="flex flex-col lg:flex-row justify-between gap-5">
            <div className="flex flex-col gap-3 md:gap-4 flex-1">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                 <div className="flex items-center gap-3">
                   <span className="text-gray-500 text-sm font-bold w-10 shrink-0">姓名</span>
                   <input type="text" value={data.name || ''} onChange={(e) => onUpdateCustomer(cid, 'customerName', e.target.value)} 
                     className="flex-1 min-w-0 bg-[#1a1c20] text-white px-3 py-2 rounded border border-gray-700 outline-none font-bold" placeholder="客户姓名" />
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="text-gray-500 text-sm font-bold w-10 shrink-0">电话</span>
                   <input type="text" value={data.phone || ''} onChange={(e) => onUpdateCustomer(cid, 'phone', e.target.value)} 
                     className="flex-1 min-w-0 bg-[#1a1c20] text-white px-3 py-2 rounded border border-gray-700 outline-none" placeholder="联系电话" />
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="text-gray-500 text-sm font-bold w-10 shrink-0">地址</span>
                   <input type="text" value={data.address || ''} onChange={(e) => onUpdateCustomer(cid, 'address', e.target.value)} 
                     className="flex-1 min-w-0 bg-[#1a1c20] text-white px-3 py-2 rounded border border-gray-700 outline-none" placeholder="详细地址" />
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="text-gray-500 text-sm font-bold w-10 shrink-0">押金</span>
                   <div className="relative flex-1 min-w-0">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold">¥</span>
                     <input type="number" min="0" step="0.01" value={data.deposit ?? ''} onChange={(e) => onUpdateCustomer(cid, 'deposit', e.target.value)}
                       className="w-full min-w-0 bg-[#1a1c20] text-blue-400 font-bold pl-8 pr-3 py-2 rounded border border-gray-700 outline-none focus:border-blue-500" placeholder="0.00" />
                   </div>
                 </div>
               </div>
               
               <div className="flex items-center gap-3">
                 <span className="text-gray-500 text-sm font-bold w-10 shrink-0">备注</span>
                 <input type="text" value={data.remark || ''} onChange={(e) => onUpdateCustomer(cid, 'remark', e.target.value)} 
                   className="flex-1 min-w-0 bg-[#1a1c20] text-white px-3 py-2 rounded border border-gray-700 outline-none" placeholder="可记录特殊情况或身份证明信息等..." />
               </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 bg-[#1a1c20] p-3 rounded-lg shrink-0 overflow-x-auto no-scrollbar">
               <div className="text-center px-1 flex-shrink-0"><div className="text-gray-500 text-[10px] md:text-xs mb-1 whitespace-nowrap">在租/超期</div><div className="text-blue-400 font-bold text-xs sm:text-sm md:text-base whitespace-nowrap">{activeCount} <span className="text-[10px] sm:text-xs text-gray-500">/</span> {overdueCount > 0 ? <span className="text-red-500">{overdueCount}</span> : <span className="text-gray-500">0</span>}</div></div>
               <div className="w-px h-6 bg-gray-700 mx-1 flex-shrink-0"></div>
               <div className="text-center px-1 flex-shrink-0"><div className="text-gray-500 text-[10px] md:text-xs mb-1 whitespace-nowrap">日租</div><div className="text-orange-500 font-bold text-xs sm:text-sm md:text-base whitespace-nowrap">¥{tDaily.toFixed(1)}</div></div>
               <div className="w-px h-6 bg-gray-700 mx-1 flex-shrink-0"></div>
               <div className="text-center px-1 flex-shrink-0">
                 <div className="text-gray-500 text-[10px] md:text-xs mb-1 whitespace-nowrap overflow-hidden text-ellipsis">累计收益 / 已收</div>
                 <div className="text-emerald-500 font-bold text-xs sm:text-sm md:text-base tracking-tight whitespace-nowrap">
                    ¥{tAcc.toFixed(1)} <span className="text-gray-500 text-[10px] sm:text-[11px] font-normal tracking-normal ml-0.5">/{tPaid.toFixed(1)}</span>
                 </div>
               </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5 border-t border-[#333842] pt-4 mt-1">
             <div className="w-full md:w-auto flex-1 pr-0 md:pr-4">
                <span className="text-gray-400 text-xs md:text-sm font-bold mb-3 block">客户档案附件 (点击存入身份证/执照截图) <span className="text-blue-500 text-xs font-normal ml-2">支持10图</span></span>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-3 w-full max-w-4xl">
                   <ImageUploadSlot label="附件1" image={data.img1} onUpload={(b) => onUpdateCustomer(cid, 'img1', b)} onRemove={() => onUpdateCustomer(cid, 'img1', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件2" image={data.img2} onUpload={(b) => onUpdateCustomer(cid, 'img2', b)} onRemove={() => onUpdateCustomer(cid, 'img2', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件3" image={data.img3} onUpload={(b) => onUpdateCustomer(cid, 'img3', b)} onRemove={() => onUpdateCustomer(cid, 'img3', '')} onPreview={onPreviewImage} />
