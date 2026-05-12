import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, Monitor, Trash2, CalendarDays, Phone, MapPin, User, Upload, CheckCircle, Search, ChevronLeft, RotateCcw, List, Maximize } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';

// ==========================================
// ☁️ 云端数据库配置区 
// ==========================================
const myFirebaseConfig = {
  apiKey: "AIzaSyB4a8fY9-7fAMJSwprDUdymEAPOTptsA9k", 
  authDomain: "rentalapp-a5286.firebaseapp.com",
  projectId: "rentalapp-a5286",
  storageBucket: "rentalapp-a5286.firebasestorage.app",
  messagingSenderId: "513172930409",
  appId: "1:513172930409:web:53816eb7f87f6e8db947f8",
  measurementId: "G-KWLTL60ET1"
};

let envConfig = {};
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    envConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  console.error("环境变量解析失败", e);
}

const firebaseConfig = envConfig.apiKey ? envConfig : myFirebaseConfig;
const isCloud = !!firebaseConfig.apiKey;

let app, auth, db;
if (isCloud) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase 初始化失败", e);
  }
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rental-app';

export default function App() {
  const [isCloudMode, setIsCloudMode] = useState(isCloud);
  const [user, setUser] = useState(isCloudMode ? null : { uid: 'local-demo-user' });
  const [orders, setOrders] = useState([]);
  const [computers, setComputers] = useState([]); 
  const [filter, setFilter] = useState('进行中'); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState('rental'); 
  const [customerSort, setCustomerSort] = useState('最新');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!isCloudMode) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setErrorMsg(`身份验证被拒绝: ${error.message}`);
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, [isCloudMode]);

  useEffect(() => {
    if (!isCloudMode) {
      const demoOrders = [
        { id: '1', customerId: 'cust-1', customerName: '演示客户', phone: '13800000000', address: '本地模式', remark: '', computerSn: 'DEMO-01', startDate: '2026-03-11', days: 30, monthlyRent: 300, paidRent: 300, renewMonths: 0, status: 'active', createdAt: Date.now(), logs: [{time: Date.now(), msg: '✨ 订单初始创建'}] }
      ];
      setOrders(demoOrders);
      setLoading(false);
      return;
    }

    if (!user) return;
    
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const compsRef = collection(db, 'artifacts', appId, 'public', 'data', 'computers'); 
    
    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetchedOrders);
      setLoading(false);
      setErrorMsg(""); 
    }, (error) => {
      console.error("Firestore error:", error);
      setErrorMsg(`数据库读取失败: ${error.message}`);
      setLoading(false);
    });

    const unsubscribeComps = onSnapshot(compsRef, (snapshot) => {
      setComputers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeComps();
    };
  }, [user, isCloudMode]);

  // 🌟 核心引擎层
  const processedOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    return orders.map(o => {
      const days = Number(o.days) || 30;
      const renew = Number(o.renewMonths) || 0;
      const totalDays = days + renew * 30;
      
      let el = 0;
      let remD = totalDays;
      let expireStr = "-";
      
      if (o.startDate) {
         const sd = new Date(o.startDate);
         sd.setHours(0, 0, 0, 0);
         el = Math.floor((today.getTime() - sd.getTime()) / 86400000);
         remD = totalDays - el;
         
         const expDate = new Date(sd);
         expDate.setDate(expDate.getDate() + totalDays);
         expireStr = expDate.toISOString().split('T')[0];
      }

      let effectiveStatus = o.status;
      if (effectiveStatus === 'active' && remD < -3) {
         effectiveStatus = 'completed';
      }

      return {
        ...o,
        _totalDays: totalDays,
        _el: el,
        _remD: remD,
        _expireStr: expireStr,
        _effectiveStatus: effectiveStatus,
        _dailyRate: days > 0 ? (Number(o.monthlyRent) || 0) / days : 0
      };
    });
  }, [orders]);


  const globalKpis = useMemo(() => {
    let totalCusts = new Set();
    let rentedComps = 0, totalDaily = 0, totalRev = 0, totalFlow = 0;

    processedOrders.forEach(o => {
      const isActive = o._effectiveStatus === 'active';
      if(o.customerId) totalCusts.add(o.customerId);
      totalFlow += Number(o.paidRent) || 0;

      if (o.computerSn) {
        if (isActive) {
          rentedComps++;
          if (o._remD >= 0) totalDaily += o._dailyRate;
        }
        totalRev += (o._dailyRate * Math.max(0, Math.min(o._el, o._totalDays)));
      }
    });

    return {
      custs: totalCusts.size,
      rented: rentedComps,
      daily: totalDaily.toFixed(2),
      rev: totalRev.toFixed(2),
      flow: totalFlow.toFixed(2)
    };
  }, [processedOrders]);

  const sortedCustomerEntries = useMemo(() => {
    const map = {};
    const lowerQuery = searchQuery.toLowerCase().trim(); 

    processedOrders.forEach(o => {
      const isActive = o._effectiveStatus === 'active';
      const isOverdue = isActive && o._remD < 0;
      const isInProgress = isActive && o._remD >= 0;
      const isCompleted = !isActive;

      if (filter === '进行中' && !isInProgress) return;
      if (filter === '已超期' && !isOverdue) return;
      if (filter === '已结单' && !isCompleted) return;

      if (lowerQuery) {
        const matchName = (o.customerName || '').toLowerCase().includes(lowerQuery);
        const matchPhone = (o.phone || '').toLowerCase().includes(lowerQuery);
        const matchSn = (o.computerSn || '').toLowerCase().includes(lowerQuery);
        if (!matchName && !matchPhone && !matchSn) return; 
      }

      const cid = o.customerId;
      if (!map[cid]) {
          map[cid] = { 
              name: o.customerName, 
              phone: o.phone, 
              address: o.address, 
              remark: o.remark, 
              img1: o.img1, img2: o.img2, img3: o.img3, img4: o.img4, img5: o.img5, 
              img6: o.img6, img7: o.img7, img8: o.img8, img9: o.img9, img10: o.img10,
              orders: [],
              totalRev: 0,
              totalPaid: 0,
              minRemD: Infinity,
              activeCount: 0
          };
      } else {
          if (o.img1) map[cid].img1 = o.img1;
          if (o.img2) map[cid].img2 = o.img2;
          if (o.img3) map[cid].img3 = o.img3;
          if (o.img4) map[cid].img4 = o.img4;
          if (o.img5) map[cid].img5 = o.img5;
          if (o.img6) map[cid].img6 = o.img6;
          if (o.img7) map[cid].img7 = o.img7;
          if (o.img8) map[cid].img8 = o.img8;
          if (o.img9) map[cid].img9 = o.img9;
          if (o.img10) map[cid].img10 = o.img10;
      }
      
      map[cid].orders.push(o);
      
      if (isActive) {
         map[cid].activeCount++;
         if (o._remD < map[cid].minRemD) map[cid].minRemD = o._remD;
      }
      map[cid].totalRev += (o._dailyRate * Math.max(0, Math.min(o._el, o._totalDays)));
      map[cid].totalPaid += Number(o.paidRent) || 0;
    });

    return Object.entries(map).sort((a, b) => {
      const dataA = a[1];
      const dataB = b[1];

      if (customerSort === '收益最高') return dataB.totalRev - dataA.totalRev;
      if (customerSort === '最快到期') {
         const remA = dataA.minRemD === Infinity ? 99999 : dataA.minRemD;
         const remB = dataB.minRemD === Infinity ? 99999 : dataB.minRemD;
         return remA - remB;
      }
      if (customerSort === '设备最多') return dataB.activeCount - dataA.activeCount;

      const getSortTime = (cid, customerData) => {
        const createdAts = customerData.orders.map(o => o.createdAt).filter(v => v);
        if (createdAts.length > 0) return Math.min(...createdAts); 
        const match = cid.match(/\d{13}/);
        if (match) return parseInt(match[0]);
        return Math.min(...customerData.orders.map(o => new Date(o.startDate || 0).getTime()));
      };
      return getSortTime(b[0], b[1]) - getSortTime(a[0], a[1]);
    });
  }, [processedOrders, filter, searchQuery, customerSort]);

  useEffect(() => {
    if (activeTab === 'rental' && highlightedOrderId) {
      const foundEntry = sortedCustomerEntries.find(([cid, data]) => data.orders.some(o => o.id === highlightedOrderId));
      if (foundEntry) setSelectedCustomerId(foundEntry[0]);
      
      const timer1 = setTimeout(() => {
        const el = document.getElementById(`order-${highlightedOrderId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      const timer2 = setTimeout(() => { setHighlightedOrderId(null); }, 4000);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [activeTab, highlightedOrderId, sortedCustomerEntries]);

  const selectedCustomerEntry = useMemo(() => {
    if (!selectedCustomerId) return null;
    return sortedCustomerEntries.find(([cid]) => cid === selectedCustomerId);
  }, [selectedCustomerId, sortedCustomerEntries]);

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!isCloudMode || !user) return alert("系统未连接云端，无法导入！");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!jsonData.orders && !jsonData.computers) throw new Error("无效的数据包格式");

        const confirmClear = window.confirm(`📦 识别成功。\n\n⚠️ 是否在导入前【清空云端现有数据】？\n- 点击「确定」：清空云端后覆盖导入 (推荐)\n- 点击「取消」：保留旧数据追加导入`);

        setLoading(true);
        setErrorMsg("📡 正在向全球云节点写入数据，请勿关闭页面...");

        if (confirmClear) {
          for (const o of orders) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id));
          for (const c of computers) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', c.id));
        }

        if (jsonData.orders && Array.isArray(jsonData.orders)) {
          let timeOffset = 0;
          for (const item of jsonData.orders) {
            const webOrder = {
              customerId: item.customer_id || `import-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              customerName: item.customer_name || '', phone: item.phone || '', address: item.address || '', remark: item.remark || '',
              computerSn: item.computer_sn || '', startDate: item.start_date || new Date().toISOString().split('T')[0],
              days: Number(item.days) || 30, monthlyRent: Number(item.monthly_rent) || 0,
              paidRent: Number(item.paid_rent) || 0, renewMonths: Number(item.renew_months) || 0,
              status: item.status || 'active', isFullSet: item.is_full_set || '否',
              img1: item.img1 || '', img2: item.img2 || '', img3: item.img3 || '', img4: item.img4 || '', img5: item.img5 || '', 
              img6: item.img6 || '', img7: item.img7 || '', img8: item.img8 || '', img9: item.img9 || '', img10: item.img10 || '',
              createdAt: Date.now() + timeOffset,
              logs: [{ time: Date.now(), msg: '✨ 历史订单包导入创建' }]
            };
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), webOrder);
            timeOffset += 10; 
          }
        }

        if (jsonData.computers && Array.isArray(jsonData.computers)) {
          for (const item of jsonData.computers) {
            const webComputer = {
              sn: item.sn || `A${Math.floor(Math.random()*1000)}`, cpu: item.cpu || '', gpu: item.gpu || '',
              ram: item.ram || '', ssd: item.ssd || '', cost: Number(item.cost) || 0, status: item.status || 'available',
              img1: item.img1 || '', img2: item.img2 || '', img3: item.img3 || '', img4: item.img4 || '', 
              img5: item.img5 || '', img6: item.img6 || '', img7: item.img7 || '', img8: item.img8 || ''
            };
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'computers'), webComputer);
          }
        }

        alert("✅ 导入成功！订单记录和设备资料均已完美上云！");
        setLoading(false); setErrorMsg("");
      } catch (err) {
        alert("导入失败: " + err.message); setLoading(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleQuickRenew = async (order) => {
    const oldRenew = Number(order.renewMonths) || 0;
    const newRenew = oldRenew + 1;
    const days = Number(order.days) || 30;
    const rent = Number(order.monthlyRent) || 0;
    
    const newPaid = days === 30 ? rent * (newRenew + 1) : rent;

    const confirmMsg = days === 30
      ? `确定要为该单执行【一键续租】吗？\n\n将自动增加 1 个月租期。\n收款并自动变更为：¥${newPaid} (含原有收款)`
      : `确定一键续租吗？\n\n注意：当前为非标准30天周期，将仅增加 1 次续租记录，已收金额需按实际情况核实。`;

    if (!window.confirm(confirmMsg)) return;

    const logEntry = {
      time: Date.now(),
      msg: `🟢 一键续租成功！增加 1 个周期，系统自动计算并记录当前总已收账款更新为: ¥${newPaid}`
    };

    const updates = {
      renewMonths: newRenew,
      paidRent: newPaid,
      logs: [...(order.logs || []), logEntry]
    };

    if (isCloudMode) {
       await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), updates, { merge: true });
    } else {
       setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updates } : o));
    }
  };

  const handleUpdateOrder = async (id, field, value) => {
    const oldOrder = orders.find(o => o.id === id);
    let updates = { [field]: value };
    
    if (['days', 'monthlyRent', 'renewMonths'].includes(field)) {
      const newDays = field === 'days' ? (parseInt(value) || 0) : (parseInt(oldOrder.days) || 30);
      const newRent = field === 'monthlyRent' ? (parseFloat(value) || 0) : (parseFloat(oldOrder.monthlyRent) || 0);
      const newRenew = field === 'renewMonths' ? (parseInt(value) || 0) : (parseInt(oldOrder.renewMonths) || 0);
      updates.paidRent = newDays === 30 ? newRent * (newRenew + 1) : newRent;
      updates.logs = [...(oldOrder.logs || []), { time: Date.now(), msg: `⚙️ 变更 [${field}] 属性，系统自动重新核算已收账款为: ¥${updates.paidRent}` }];
    } else if (field === 'paidRent') {
      updates.logs = [...(oldOrder.logs || []), { time: Date.now(), msg: `💰 手动修正已收金额款项为: ¥${value}` }];
    } else if (field === 'status') {
      const statusTxt = value === 'completed' ? '📦 执行订单结单归档，释放设备' : '🔄 恢复订单为进行中，重新占用设备';
      updates.logs = [...(oldOrder.logs || []), { time: Date.now(), msg: statusTxt }];
    }

    if (isCloudMode) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id), updates, { merge: true });
      
      if (field === 'computerSn') {
        if (oldOrder && oldOrder.computerSn) {
          const oldC = computers.find(c => c.sn === oldOrder.computerSn);
          if (oldC) {
             const otherActive = processedOrders.some(o => o.computerSn === oldOrder.computerSn && o._effectiveStatus === 'active' && o.id !== id);
             await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', oldC.id), { status: otherActive ? 'rented' : 'available' }, { merge: true });
          }
        }
        if (value) {
          const newC = computers.find(c => c.sn === value);
          if (newC && oldOrder.status === 'active') {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', newC.id), { status: 'rented' }, { merge: true });
          }
        }
      } else if (field === 'status' && oldOrder && oldOrder.computerSn) {
         const comp = computers.find(c => c.sn === oldOrder.computerSn);
         if (comp) {
            let newStatus = value === 'active' ? 'rented' : 'available';
            if (newStatus === 'available') {
               const otherActive = processedOrders.some(o => o.computerSn === oldOrder.computerSn && o._effectiveStatus === 'active' && o.id !== id);
               if (otherActive) newStatus = 'rented';
            }
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', comp.id), { status: newStatus }, { merge: true });
         }
      }
    } else {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
      if (field === 'computerSn') {
        setComputers(prev => prev.map(c => {
          if (oldOrder && c.sn === oldOrder.computerSn) {
             const otherActive = processedOrders.some(o => o.computerSn === oldOrder.computerSn && o._effectiveStatus === 'active' && o.id !== id);
             return {...c, status: otherActive ? 'rented' : 'available'};
          }
          if (c.sn === value && oldOrder.status === 'active') {
             return {...c, status: 'rented'};
          }
          return c;
        }));
      } else if (field === 'status' && oldOrder && oldOrder.computerSn) {
         setComputers(prev => prev.map(c => {
            if (c.sn === oldOrder.computerSn) {
               let newStatus = value === 'active' ? 'rented' : 'available';
               if (newStatus === 'available') {
                  const otherActive = processedOrders.some(o => o.computerSn === oldOrder.computerSn && o._effectiveStatus === 'active' && o.id !== id);
                  if (otherActive) newStatus = 'rented';
               }
               return {...c, status: newStatus};
            }
            return c;
         }));
      }
    }
  };

  const handleUpdateCustomer = async (customerId, field, value) => {
    const customerOrders = orders.filter(o => o.customerId === customerId);
    if (isCloudMode) {
      for (const order of customerOrders) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), { [field]: value }, { merge: true });
      }
    } else {
      setOrders(prev => prev.map(o => o.customerId === customerId ? { ...o, [field]: value } : o));
    }
  };

  const handleAddCustomer = async () => {
    const cid = `cust-${Date.now()}`;
    const newOrder = {
      customerId: cid, customerName: '新客户', phone: '', address: '', remark: '',
      computerSn: '', startDate: new Date().toISOString().split('T')[0], days: 30, monthlyRent: 0, paidRent: 0, renewMonths: 0, status: 'active',
      img1: '', img2: '', img3: '', img4: '', img5: '', img6: '', img7: '', img8: '', img9: '', img10: '',
      createdAt: Date.now(),
      logs: [{ time: Date.now(), msg: '✨ 新建客户与初始订单档案' }]
    };
    if (isCloudMode) {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
    } else {
      setOrders(prev => [...prev, { id: Date.now().toString(), ...newOrder }]);
    }
    setSelectedCustomerId(cid);
  };

  const handleAddDevice = async (customerId, customerName, phone, address, remark) => {
    const existingOrders = orders.filter(o => o.customerId === customerId);
    const sourceOrder = existingOrders.find(o => o.img1 || o.img2 || o.img3 || o.img4 || o.img5 || o.img6 || o.img7 || o.img8 || o.img9 || o.img10) || {};

    const newOrder = {
      customerId, customerName, phone, address, remark: remark || '',
      computerSn: '', startDate: new Date().toISOString().split('T')[0], days: 30, monthlyRent: 0, paidRent: 0, renewMonths: 0, status: 'active',
      img1: sourceOrder.img1 || '', img2: sourceOrder.img2 || '', img3: sourceOrder.img3 || '', 
      img4: sourceOrder.img4 || '', img5: sourceOrder.img5 || '', img6: sourceOrder.img6 || '',
      img7: sourceOrder.img7 || '', img8: sourceOrder.img8 || '', img9: sourceOrder.img9 || '', img10: sourceOrder.img10 || '',
      createdAt: Date.now(),
      logs: [{ time: Date.now(), msg: '✨ 新增挂载设备订单' }]
    };
    if (isCloudMode) {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
    } else {
      setOrders(prev => [...prev, { id: Date.now().toString(), ...newOrder }]);
    }
  };

  const handleDeleteOrder = async (id) => {
    const orderToDelete = orders.find(o => o.id === id);
    if (!window.confirm("确定删除该设备订单记录吗？这不会影响历史财务核算，但该单将永久消失。")) return;
    
    if (isCloudMode) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id));
      if (orderToDelete && orderToDelete.computerSn && orderToDelete.status === 'active') {
         const otherActive = processedOrders.some(o => o.computerSn === orderToDelete.computerSn && o._effectiveStatus === 'active' && o.id !== id);
         if (!otherActive) {
            const comp = computers.find(c => c.sn === orderToDelete.computerSn);
            if (comp) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', comp.id), { status: 'available' }, { merge: true });
         }
      }
    } else {
      setOrders(prev => prev.filter(o => o.id !== id));
      if (orderToDelete && orderToDelete.computerSn && orderToDelete.status === 'active') {
         const otherActive = processedOrders.some(o => o.computerSn === orderToDelete.computerSn && o._effectiveStatus === 'active' && o.id !== id);
         if (!otherActive) {
            setComputers(prev => prev.map(c => c.sn === orderToDelete.computerSn ? {...c, status:'available'} : c));
         }
      }
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    if (!window.confirm("确定彻底删除整个客户及其所有订单记录？（相关设备会自动恢复为空闲）")) return;
    const customerOrders = orders.filter(o => o.customerId === customerId);
    if (isCloudMode) {
      for (const order of customerOrders) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id));
        if (order.computerSn && order.status === 'active') {
           const otherActive = processedOrders.some(o => o.computerSn === order.computerSn && o._effectiveStatus === 'active' && o.customerId !== customerId);
           if (!otherActive) {
              const comp = computers.find(c => c.sn === order.computerSn);
              if (comp) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', comp.id), { status: 'available' }, { merge: true });
           }
        }
      }
    } else {
      setOrders(prev => prev.filter(o => o.customerId !== customerId));
      setComputers(prev => prev.map(c => {
         const hasOtherActive = processedOrders.some(o => o.computerSn === c.sn && o._effectiveStatus === 'active' && o.customerId !== customerId);
         const hadActiveInDeleted = customerOrders.some(o => o.computerSn === c.sn && o.status === 'active');
         if (hadActiveInDeleted && !hasOtherActive) {
            return {...c, status: 'available'};
         }
         return c;
      }));
    }
    if (selectedCustomerId === customerId) setSelectedCustomerId(null);
  };

  if (loading || errorMsg) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex flex-col items-center justify-center text-white p-6 font-sans">
        <div className="flex items-center space-x-3 animate-pulse text-xl"><Monitor className="text-blue-500" size={28} /><span>{errorMsg || "系统与云端数据连接中..."}</span></div>
        {errorMsg && !errorMsg.includes("写入") && (<button onClick={() => window.location.reload()} className="mt-6 px-8 py-2 bg-blue-600 rounded-lg font-bold">重新连接</button>)}
      </div>
    );
  }

  const navTabs = [
    { id: 'home', icon: '🔔', label: '近期待办', shortLabel: '待办' },
    { id: 'equipment', icon: '📝', label: '设备资料', shortLabel: '设备' },
    { id: 'rental', icon: '📊', label: '实时租赁与收益', shortLabel: '租赁' },
    { id: 'calendar', icon: '📅', label: '收益热力图', shortLabel: '收益' }
  ];

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-gray-200 font-sans flex flex-col md:flex-row pb-16 md:pb-0 relative">
      <style>{`
        #csb-open-sandbox, .csb-open-sandbox, div[id^="csb-"], a[href*="codesandbox.io/p/devbox"] { 
          display: none !important; opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; z-index: -9999 !important;
        }
      `}</style>

      <div className="hidden md:flex md:w-56 bg-[#1a1c20] flex-shrink-0 border-r border-gray-800 p-4 flex-col shadow-xl">
        <div className="flex items-center space-x-2 text-white font-bold text-xl mb-8">
          <Monitor className="text-blue-500" /><span>租赁云管理 <span className="text-blue-400 text-xs align-top">V4</span></span>
          <span className={`text-[10px] px-2 py-1 rounded ml-2 ${isCloudMode ? 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.8)]' : 'bg-orange-600'}`}>{isCloudMode ? '在线' : '本地'}</span>
        </div>
        <nav className="space-y-2 flex-1">
          {navTabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedCustomerId(null); }}
              className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${activeTab === tab.id ? 'bg-blue-600 bg-opacity-20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:bg-gray-800'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
        {activeTab === 'rental' ? (
          selectedCustomerEntry ? (
            <CustomerDetailView 
               cid={selectedCustomerEntry[0]} 
               data={selectedCustomerEntry[1]} 
               onBack={() => setSelectedCustomerId(null)} 
               onUpdateCustomer={handleUpdateCustomer} 
               onAddDevice={handleAddDevice} 
               onDeleteCustomer={handleDeleteCustomer} 
               onUpdateOrder={handleUpdateOrder} 
               onDeleteOrder={handleDeleteOrder}
               onQuickRenew={handleQuickRenew}
               highlightedOrderId={highlightedOrderId} 
               computers={computers} 
               orders={processedOrders} 
               onPreviewImage={setPreviewImage}
            />
          ) : (
            <>
              <div className="flex flex-col mb-4 gap-4 animate-in fade-in duration-300">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">合同与流转 <span className="text-blue-500 text-sm align-top">V4</span></h1>
                    <div className="bg-gray-800 p-1 rounded-lg flex space-x-1 text-sm">
                      {['全部', '进行中', '已超期', '已结单'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md transition ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
                    <label className="flex-shrink-0 flex items-center justify-center space-x-2 bg-[#2b2d33] hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium transition cursor-pointer border border-gray-700">
                      <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
                      <Upload size={16} />
                      <span className="text-sm">导入旧数据</span>
                    </label>
                    <button onClick={handleAddCustomer} className="flex-shrink-0 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-medium transition shadow-lg shadow-blue-500/20">
                      <Plus size={18} />
                      <span className="text-sm">新建客户</span>
                    </button>
                  </div>
                </div>

                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="🔍 搜索：客户姓名、手机号、机箱编号..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
          <HomeTab orders={processedOrders} onJump={(id) => { setHighlightedOrderId(id); setActiveTab('rental'); }} />
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
         <div className="text-gray-400 text-xs flex items-center gap-1 mb-3"><Phone size={12}/>{data.phone || '无电话'}</div>
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
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
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
                 <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
                   <span className="text-gray-500 text-sm font-bold w-10 shrink-0">地址</span>
                   <input type="text" value={data.address || ''} onChange={(e) => onUpdateCustomer(cid, 'address', e.target.value)} 
                     className="flex-1 min-w-0 bg-[#1a1c20] text-white px-3 py-2 rounded border border-gray-700 outline-none" placeholder="详细地址" />
                 </div>
               </div>
               
               <div className="flex items-center gap-3">
                 <span className="text-gray-500 text-sm font-bold w-10 shrink-0">备注</span>
                 <input type="text" value={data.remark || ''} onChange={(e) => onUpdateCustomer(cid, 'remark', e.target.value)} 
                   className="flex-1 min-w-0 bg-[#1a1c20] text-white px-3 py-2 rounded border border-gray-700 outline-none" placeholder="可记录特殊情况、押金或身份证明信息等..." />
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
                   <ImageUploadSlot label="附件4" image={data.img4} onUpload={(b) => onUpdateCustomer(cid, 'img4', b)} onRemove={() => onUpdateCustomer(cid, 'img4', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件5" image={data.img5} onUpload={(b) => onUpdateCustomer(cid, 'img5', b)} onRemove={() => onUpdateCustomer(cid, 'img5', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件6" image={data.img6} onUpload={(b) => onUpdateCustomer(cid, 'img6', b)} onRemove={() => onUpdateCustomer(cid, 'img6', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件7" image={data.img7} onUpload={(b) => onUpdateCustomer(cid, 'img7', b)} onRemove={() => onUpdateCustomer(cid, 'img7', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件8" image={data.img8} onUpload={(b) => onUpdateCustomer(cid, 'img8', b)} onRemove={() => onUpdateCustomer(cid, 'img8', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件9" image={data.img9} onUpload={(b) => onUpdateCustomer(cid, 'img9', b)} onRemove={() => onUpdateCustomer(cid, 'img9', '')} onPreview={onPreviewImage} />
                   <ImageUploadSlot label="附件10" image={data.img10} onUpload={(b) => onUpdateCustomer(cid, 'img10', b)} onRemove={() => onUpdateCustomer(cid, 'img10', '')} onPreview={onPreviewImage} />
                </div>
             </div>

             <div className="flex flex-col sm:flex-row w-full md:w-auto items-center gap-3 shrink-0">
                <button onClick={() => onAddDevice(cid, data.name, data.phone, data.address, data.remark)} className="w-full sm:w-auto flex justify-center items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold transition shadow-lg">
                  <Plus size={18} /> 新增设备订单
                </button>
                <button onClick={() => { if(window.confirm("确定彻底删除该客户及其所有订单记录？（相关设备会自动恢复为空闲）")) onDeleteCustomer(cid); }} className="w-full sm:w-auto flex justify-center items-center gap-2 px-5 py-2.5 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-lg transition font-bold">
                  <Trash2 size={18} /> 删除该客户
                </button>
             </div>
          </div>
        </div>
        
        <div className="p-4 overflow-x-auto">
          <div className="min-w-[850px] space-y-1">
            <div className="grid grid-cols-12 gap-2 px-2 py-1 text-[10px] font-bold text-gray-500 bg-[#183652] rounded">
              <div className="col-span-2">设备编号</div><div className="col-span-2">起租日期</div><div className="col-span-1 text-center">周期</div><div className="col-span-1 text-center">续租</div><div className="col-span-2">进度概览</div><div className="col-span-1 text-center">月租金</div><div className="col-span-1 text-center">日收益</div><div className="col-span-1 text-center">已收</div><div className="col-span-1 text-center">操作</div>
            </div>
            {sortedOrders.map(order => (
              <OrderRow key={order.id} order={order} isHighlighted={order.id === highlightedOrderId} onUpdate={onUpdateOrder} onDelete={onDeleteOrder} onQuickRenew={onQuickRenew} computers={computers} orders={orders} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderRow({ order, onUpdate, onDelete, onQuickRenew, isHighlighted, computers, orders }) {
  const [showLogs, setShowLogs] = useState(false);
  const isActive = order._effectiveStatus === 'active';
  const progressRatio = order._totalDays > 0 ? Math.min(Math.max(0, order._el) / order._totalDays, 1) : 0;
  const barColor = !isActive ? "bg-gray-600" : (order._remD < 3 ? "bg-red-500" : "bg-emerald-500");
  const effectiveDailyRate = (isActive && order._remD >= 0) ? order._dailyRate : 0;

  return (
    <div className="flex flex-col mt-1">
      <div id={`order-${order.id}`} className={`grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded border text-xs transition-all duration-500 ease-in-out ${isHighlighted ? 'bg-blue-900/60 border-blue-400 scale-[1.01] shadow-[0_0_15px_rgba(59,130,246,0.4)] z-10 relative' : 'bg-[#1c1c1c] hover:bg-[#252525] border-[#333]'}`}>
        <div className="col-span-2 flex items-center space-x-2">
          <div className={`w-1 h-3 rounded-full ${!isActive ? 'bg-gray-600' : (order._remD < 0 ? 'bg-red-500' : 'bg-emerald-500')}`}></div>
          <select 
          value={order.computerSn || ''} 
          onChange={(e) => onUpdate(order.id, 'computerSn', e.target.value)} 
          className="w-full bg-[#0a0a0a] text-white px-1 py-1 rounded border border-gray-700 outline-none text-xs cursor-pointer hover:border-gray-500 transition-colors"
        >
          <option value="">- 请选择 -</option>
          {computers && [...computers].sort((a,b) => (a.sn||"").localeCompare(b.sn||"", undefined, {numeric:true})).map(c => {
            const isOccupied = orders && orders.some(o => o._effectiveStatus === 'active' && o.computerSn === c.sn && o.id !== order.id);
            return (
              <option key={c.id || c.sn} value={c.sn}>
                {c.sn} {isOccupied ? '(使用中)' : ''}
              </option>
            );
          })}
        </select>
      </div>
      <div className="col-span-2"><input type="date" value={order.startDate || ''} onChange={(e) => onUpdate(order.id, 'startDate', e.target.value)} className="w-full bg-black text-white px-2 py-1 rounded border border-gray-800 outline-none" /></div>
        <div className="col-span-1"><input type="number" value={order.days} onChange={(e) => onUpdate(order.id, 'days', e.target.value)} className="w-full text-center bg-black text-white py-1 rounded border border-gray-800 outline-none" /></div>
        
        <div className="col-span-1 flex flex-row items-center gap-1">
          <select value={order.renewMonths || 0} onChange={(e) => onUpdate(order.id, 'renewMonths', e.target.value)} className="w-full min-w-0 bg-black text-white py-1 rounded border border-gray-800 outline-none text-center px-0">
            {[0,1,2,3,4,5,6,7,8,9,10,12].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={() => onQuickRenew(order)} className="bg-emerald-600/90 hover:bg-emerald-500 text-white rounded shadow-sm px-1.5 h-full flex items-center justify-center font-bold font-mono transition-transform active:scale-95" title="极速一键增加续租">+</button>
        </div>

        <div className="col-span-2 px-1">
          <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden mb-1"><div className={`h-full ${barColor}`} style={{ width: `${progressRatio * 100}%` }}></div></div>
          <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase">
             <span>{order._remD < 0 ? `超期 ${Math.abs(Math.floor(order._remD))} 天` : `剩 ${Math.floor(order._remD)} 天`}</span>
             <span>到期:{order._expireStr}</span>
          </div>
        </div>
        <div className="col-span-1"><input type="number" value={order.monthlyRent} onChange={(e) => onUpdate(order.id, 'monthlyRent', e.target.value)} className="w-full text-center bg-black text-emerald-400 py-1 rounded border border-gray-800 font-bold" /></div>
        <div className="col-span-1 text-center font-bold text-orange-500">{effectiveDailyRate.toFixed(1)}</div>
        <div className="col-span-1">
           <input type="number" value={order.paidRent || 0} onChange={(e) => onUpdate(order.id, 'paidRent', e.target.value)} className="w-full text-center bg-[#0a0a0a] text-blue-400 py-1 rounded border border-gray-800 font-bold outline-none focus:border-blue-500 transition-colors" title="修改此处将自动记录流水" />
        </div>
        <div className="col-span-1 flex justify-center items-center gap-2">
          {isActive ? (
             <button onClick={() => { if(window.confirm("确定要对该单进行【结单归档】吗？设备将自动转为闲置状态。")) onUpdate(order.id, 'status', 'completed'); }} className="text-emerald-500 hover:text-emerald-400 transition" title="结单归档"><CheckCircle size={14} /></button>
          ) : (
             <button onClick={() => { 
               if(order._remD < -3) {
                  alert("🚨 该订单超期已超3天，受系统保护处于【自动结单】状态！\n请先增加【续租周期】或修改【起租日期】后再执行恢复！");
                  return;
               }
               if(window.confirm("确定要【恢复】此历史订单吗？设备将被重新占用。")) onUpdate(order.id, 'status', 'active'); 
             }} className="text-blue-500 hover:text-blue-400 transition" title="恢复订单"><RotateCcw size={14} /></button>
          )}
          <button onClick={() => setShowLogs(!showLogs)} className={`transition ${showLogs ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'}`} title="流水与操作日志"><List size={14} /></button>
          <button onClick={() => onDelete(order.id)} className="text-red-500 hover:text-red-400 transition" title="删除记录"><Trash2 size={14} /></button>
        </div>
      </div>
      
      {/* 操作与流水账志扩展面板 */}
      {showLogs && (
        <div className="grid grid-cols-12 mb-2 animate-in slide-in-from-top-2">
          <div className="col-span-12 bg-[#141517] p-3 rounded-b-lg border-x border-b border-[#333] shadow-inner text-xs text-gray-300 ml-2 mr-1">
             <div className="font-bold text-gray-500 mb-2 border-b border-gray-800 pb-1">操作与流水记录追踪</div>
             {order.logs && order.logs.length > 0 ? (
               <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-2 no-scrollbar">
                 {order.logs.slice().reverse().map((log, idx) => (
                   <li key={idx} className="flex gap-2">
                     <span className="text-gray-600 font-mono shrink-0">[{new Date(log.time).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}]</span>
                     <span className={`${log.msg.includes('收款') || log.msg.includes('更新已收') ? 'text-emerald-400 font-bold' : ''}`}>{log.msg}</span>
                   </li>
                 ))}
               </ul>
             ) : (
               <p className="text-gray-600">暂无流水日志记录</p>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeTab({ orders, onJump }) {
  const expiringGroups = {};
  orders.forEach(o => {
    if (o._effectiveStatus !== 'active' || !o.computerSn) return;
    
    if (o._remD >= 0 && o._remD <= 3) {
      if (!expiringGroups[o.customerId]) expiringGroups[o.customerId] = { cust: o.customerName, phone: o.phone, minRem: o._remD, devices: [] };
      if (o._remD < expiringGroups[o.customerId].minRem) expiringGroups[o.customerId].minRem = o._remD;
      expiringGroups[o.customerId].devices.push({ id: o.id, sn: o.computerSn, remD: o._remD, expireStr: o._expireStr });
    }
  });

  const sortedTodos = Object.values(expiringGroups).sort((a, b) => a.minRem - b.minRem);
  return (
    <div className="pb-20">
      <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold text-white">近期待办事项</h1></div>
      {sortedTodos.length === 0 ? (
        <div className="text-center text-gray-500 py-20 bg-[#22252b] rounded-xl border border-gray-800 text-lg">🎉 当前没有即将到期的订单，一切尽在掌握！</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedTodos.map((t, i) => (
            <div key={i} className={`bg-[#2b2b2b] rounded-xl border border-orange-500 p-5 shadow-lg relative group`}>
              <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
                <span className={`font-bold text-lg text-orange-500`}>
                  {t.minRem === 0 ? '⚠️ 今天到期' : `⚠️ 最快剩 ${t.minRem} 天到期`}
                </span>
                <span className="text-gray-400 text-sm">共 {t.devices.length} 台</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex"><span className="text-gray-400 w-12">客户:</span><span className="font-bold text-white">{t.cust || '-'}</span></div>
                <div className="flex"><span className="text-gray-400 w-12">电话:</span><span className="font-bold text-white">{t.phone || '-'}</span></div>
                <div className="flex mt-2 pt-2 border-t border-gray-800">
                  <span className="text-gray-400 w-12 pt-1">编号:</span>
                  <div className="flex-1 flex flex-col space-y-1.5">
                    {t.devices.map((d, di) => (
                      <div key={di} className="flex items-center bg-[#1f1f1f] px-2 py-1.5 rounded border border-gray-800">
                        <span className={`font-bold ${d.remD === 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                          {d.sn} (剩{d.remD}天)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => onJump(t.devices[0].id)} className="absolute bottom-4 right-4 text-white/30 group-hover:text-white transition-all bg-black/20 group-hover:bg-blue-600 p-2 rounded-full shadow-sm hover:scale-110">
                <Search size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ orders }) {
  const [selectedMonth, setSelectedMonth] = useState(null);

  const monthlyRev = {}; let totalAcc = 0; 
  const today = new Date(); today.setHours(0, 0, 0, 0); 
  let earliestDate = new Date(); earliestDate.setHours(0, 0, 0, 0);

  orders.forEach(o => {
    if (!o.computerSn || !o.startDate) return;
    const startD = new Date(o.startDate);
    startD.setHours(0, 0, 0, 0);
    if (startD < earliestDate) earliestDate = startD;
    
    const calcEndD = new Date(Math.min(startD.getTime() + o._totalDays * 86400000, today.getTime() + 86400000));
    let currD = new Date(startD.getTime());
    
    while (currD < calcEndD) {
      const key = `${currD.getFullYear()}-${String(currD.getMonth() + 1).padStart(2, '0')}`;
      monthlyRev[key] = (monthlyRev[key] || 0) + o._dailyRate; 
      totalAcc += o._dailyRate;
      currD.setDate(currD.getDate() + 1);
    }
  });

  if (selectedMonth) {
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); 
    
    const dailyRev = {};
    for(let i=1; i<=daysInMonth; i++) dailyRev[i] = 0;
    let monthTotal = 0;

    orders.forEach(o => {
        if (!o.computerSn || !o.startDate) return;
        const startD = new Date(o.startDate);
        startD.setHours(0, 0, 0, 0);
        const calcEndD = new Date(Math.min(startD.getTime() + o._totalDays * 86400000, today.getTime() + 86400000));
        
        let currD = new Date(startD.getTime());
        while (currD < calcEndD) {
          if (currD.getFullYear() == year && (currD.getMonth() + 1) == month) {
             dailyRev[currD.getDate()] += o._dailyRate;
             monthTotal += o._dailyRate;
          }
          currD.setDate(currD.getDate() + 1);
        }
    });

    const maxDaily = Math.max(...Object.values(dailyRev), 0.01);

    return (
       <div className="pb-20 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="mb-6 flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
             <button onClick={()=>setSelectedMonth(null)} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg flex items-center transition">
               <ChevronLeft size={16} className="mr-1"/> 返回月度概览
             </button>
             <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">{year}年 {month}月 - 每日收益明细</h1>
                <p className="text-emerald-500 font-bold mt-1">本月累计产生: ¥ {monthTotal.toFixed(2)}</p>
             </div>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-bold text-gray-500">
              <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
             {Array.from({length: firstDayOfWeek}).map((_, i) => <div key={`empty-${i}`} className="h-20 md:h-24 bg-[#1a1c20] rounded-xl border border-gray-800/50"></div>)}
             {Array.from({length: daysInMonth}).map((_, i) => {
                const day = i+1;
                const thisDate = new Date(year, month - 1, day);
                thisDate.setHours(0, 0, 0, 0);
                const isFuture = thisDate > today;
                
                if (isFuture) {
                    return (
                        <div key={day} className={`h-20 md:h-24 rounded-xl border border-[#333] border-dashed p-1.5 md:p-2 flex flex-col bg-[#16181b] opacity-40`}>
                            <span className="text-xs md:text-sm font-bold text-gray-600">{day}</span>
                        </div>
                    );
                }

                const rev = dailyRev[day];
                let bg = "#1e2024";
                let txt = "text-gray-500";
                if (rev > 0) {
                    const ratio = Math.max(0.25, rev / maxDaily);
                    bg = `rgba(47, 165, 114, ${ratio})`; 
                    txt = "text-white";
                }
                return (
                    <div key={day} style={{backgroundColor: rev > 0 ? bg : undefined}} className={`h-20 md:h-24 rounded-xl border border-[#333] p-1.5 md:p-2 flex flex-col justify-between hover:border-emerald-500/50 transition-colors ${rev <= 0 ? 'bg-[#1e2024]' : ''}`}>
                        <span className={`text-xs md:text-sm font-bold ${txt}`}>{day}</span>
                        {rev > 0 && <span className="self-end text-white font-mono font-bold text-[10px] md:text-xs shadow-sm">+¥{rev.toFixed(1)}</span>}
                    </div>
                )
             })}
          </div>
       </div>
    );
  }

  const monthsList = []; let currY = earliestDate.getFullYear(), currM = earliestDate.getMonth() + 1;
  while (currY < today.getFullYear() || (currY === today.getFullYear() && currM <= today.getMonth() + 1)) {
    monthsList.push(`${currY}-${String(currM).padStart(2, '0')}`); currM++; if (currM > 12) { currM = 1; currY++; }
  }
  if (monthsList.length === 0) monthsList.push(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

  const maxRev = Math.max(...Object.values(monthlyRev), 0.01);
  const getColor = (amount) => {
    if (amount <= 0) return "#2b2b2b";
    const ratio = amount / maxRev;
    return `rgb(${Math.floor(30 + 17 * ratio)}, ${Math.floor(70 + 95 * ratio)}, ${Math.floor(32 + 82 * ratio)})`;
  };

  const chartData = monthsList.map(mKey => ({ month: mKey, rev: monthlyRev[mKey] || 0 }));
  const maxChartRev = Math.max(...chartData.map(d => d.rev), 0.01);
  const minItemWidth = 28; 
  const svgWidth = Math.max(800, chartData.length * minItemWidth + 100);
  const svgHeight = 220;
  const padTop = 30, padBottom = 30, padLeft = 60, padRight = 30;
  const graphWidth = svgWidth - padLeft - padRight;
  const graphHeight = svgHeight - padTop - padBottom;
  const step = chartData.length > 0 ? graphWidth / chartData.length : graphWidth;
  const actualStep = Math.min(step, 28); 
  const offsetX = padLeft; 

  const bars = chartData.map((d, i) => {
    const center = offsetX + i * actualStep + actualStep / 2;
    const barWidth = 14; 
    const h = (d.rev / maxChartRev) * graphHeight;
    const x = center - barWidth / 2;
    const y = padTop + graphHeight - h;
    return { x, y, w: barWidth, h, rev: d.rev, month: d.month, center };
  });

  return (
    <div className="pb-20">
      <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold text-white">历史月度收益总览</h1><p className="text-emerald-500 font-bold text-lg mt-2">累计已产生收益: ¥ {totalAcc.toFixed(2)}</p></div>
      
      <div className="bg-[#22252b] rounded-xl p-4 md:p-6 mb-8 border border-gray-800 shadow-sm relative">
         <h3 className="text-gray-400 text-sm font-bold mb-4 flex items-center gap-2"><CalendarDays size={16}/> 收益走势柱状图</h3>
         <div className="w-full overflow-x-auto no-scrollbar">
           <div style={{ minWidth: `${svgWidth}px`, height: `${svgHeight}px` }} className="relative">
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                 <defs>
                   <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stopColor="#2FA572" stopOpacity="0.9" />
                     <stop offset="100%" stopColor="#2FA572" stopOpacity="0.2" />
                   </linearGradient>
                 </defs>
                 
                 {[0, 0.5, 1].map(ratio => {
                    const y = padTop + graphHeight - (ratio * graphHeight);
                    return (
                      <g key={ratio}>
                         <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="#333842" strokeDasharray="4 4" />
                         <text x={padLeft - 10} y={y + 4} fill="#6b7280" fontSize="11" textAnchor="end">¥{(maxChartRev * ratio).toFixed(0)}</text>
                      </g>
                    );
                 })}

                 {bars.map((b, i) => (
                   <g key={i}>
                     <rect x={b.x} y={b.y > padTop + graphHeight - 2 ? padTop + graphHeight - 2 : b.y} width={b.w} height={b.h < 2 ? 2 : b.h} fill="url(#barGrad)" rx="2" ry="2" className="hover:opacity-75 transition-opacity cursor-pointer" />
                     {b.rev > 0 && <text x={b.center} y={b.y - 8} fill="#d1d5db" fontSize="10" fontWeight="bold" textAnchor="middle">¥{b.rev.toFixed(0)}</text>}
                     <text x={b.center} y={svgHeight - 10} fill="#6b7280" fontSize="10" textAnchor="middle">{b.month.substring(2).replace('-', '/')}</text>
                   </g>
                 ))}
              </svg>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {monthsList.map(mKey => {
          if ((monthlyRev[mKey] || 0) <= 0) return null;
          return (
            <div key={mKey} onClick={() => setSelectedMonth(mKey)} style={{ backgroundColor: getColor(monthlyRev[mKey]) }} className="rounded-xl border-2 border-[#333] h-28 flex flex-col justify-between p-3 shadow-lg cursor-pointer hover:scale-105 transition-transform group relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-start relative z-10">
                <span className="font-bold text-white text-sm opacity-90">{mKey.replace('-', '年 ')}月</span>
                <div className="text-white/40 group-hover:text-white transition-colors bg-black/20 group-hover:bg-black/40 p-1 rounded-full">
                  <ChevronRight size={14}/>
                </div>
              </div>
              <div className="flex justify-end items-end relative z-10">
                  <span className="font-mono text-xl font-bold text-white">¥ {(monthlyRev[mKey]).toFixed(0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 🌟 核心防误触图片组件：加入 pointer-events-none 彻底阻止手机浏览器自作聪明放大图片！
function ImageUploadSlot({ label, image, onUpload, onRemove, onPreview }) {
  const handleFile = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        onUpload(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative aspect-square group">
      <label className="cursor-pointer w-full h-full bg-[#1a1c20] rounded border border-dashed border-gray-700 hover:border-blue-500 hover:bg-blue-900/10 flex flex-col items-center justify-center overflow-hidden transition-colors">
        {image ? (
          // 这里添加 pointer-events-none，完美拦截原生相册的图片放大事件
          <img src={image} className="object-cover w-full h-full pointer-events-none select-none" alt={label} />
        ) : (
          <span className="text-gray-500 text-[10px] text-center pointer-events-none">
            <Plus size={14} className="mx-auto mb-1 opacity-50"/>{label}
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </label>
      
      {image && (
         <>
           <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreview && onPreview(image); }} 
              className="absolute top-1 left-1 bg-black/60 hover:bg-blue-600 text-white rounded p-1.5 opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm">
              <Maximize size={12} />
           </button>
           <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(window.confirm('确定删除这张图片吗？')) onRemove(); }} 
              className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-500 text-white rounded p-1.5 opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm">
              <Trash2 size={12} />
           </button>
         </>
      )}
    </div>
  );
}

function EquipmentTab({ computers, orders, isCloudMode, user, db, appId, onPreviewImage }) {
  const [selectedId, setSelectedId] = useState(null);
  const [compFilter, setCompFilter] = useState('全部');

  const getIsRented = (sn) => orders.some(o => o.computerSn === sn && o._effectiveStatus === 'active');

  const handleAddComputer = async () => {
    if (!isCloudMode || !user) return alert("请先连接云端！");
    const existingSns = computers.map(c => c.sn).filter(sn => sn && sn.startsWith('A'));
    const maxNum = Math.max(0, ...existingSns.map(sn => parseInt(sn.substring(1)) || 0));
    // 创建时留足 8 个图片的空位
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'computers'), { sn: `A${String(maxNum + 1).padStart(2, '0')}`, cpu: '', gpu: '', ram: '', ssd: '', cost: 0, status: 'available', img1: '', img2: '', img3: '', img4: '', img5: '', img6: '', img7: '', img8: '' });
  };

  const handleUpdateComputer = async (id, field, value) => { 
      if (isCloudMode && user) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', id), { [field]: value }, { merge: true }); 
  };

  const handleDeleteComputer = async (id, sn) => { 
    if (window.confirm(`确定删除设备 ${sn} 吗？`) && isCloudMode && user) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'computers', id)); 
      if (selectedId === id) setSelectedId(null);
    }
  };

  const sortedComputers = [...computers].sort((a, b) => (a.sn || "").localeCompare(b.sn || "", undefined, { numeric: true }));
  const filteredComputers = sortedComputers.filter(c => {
      const isRented = getIsRented(c.sn);
      if (compFilter === '在租' && !isRented) return false;
      if (compFilter === '空闲' && isRented) return false;
      return true;
  });

  const selectedComp = useMemo(() => computers.find(c => c.id === selectedId), [computers, selectedId]);

  if (selectedComp) {
    const c = selectedComp;
    const isRented = getIsRented(c.sn);
    let machineEarned = 0; 
    orders.filter(o => o.computerSn === c.sn).forEach(o => {
      machineEarned += o._dailyRate * Math.max(0, Math.min(o._el, o._totalDays));
    });
    const mRoi = (Number(c.cost) || 0) > 0 ? Math.min(machineEarned / Number(c.cost), 1) : 0;

    return (
      <div className="pb-20 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <button onClick={() => setSelectedId(null)} className="self-start md:self-auto bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg flex items-center transition">
            <ChevronLeft size={16} className="mr-1"/> 返回设备库
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
            {c.sn || '未命名'}
            <span className={`px-2 py-1 rounded text-xs md:text-sm font-bold ${isRented ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {isRented ? '在租中' : '空闲'}
            </span>
          </h2>
        </div>

        <div className="bg-[#1e2024] rounded-xl border border-[#3c3f41] p-4 md:p-6 shadow-xl max-w-4xl space-y-6 md:space-y-8">
          <div className="flex items-center gap-3 md:gap-4">
             <span className="text-gray-400 font-bold w-10 md:w-12 shrink-0">收益</span>
             <div className="flex-1 bg-gray-800 h-5 md:h-6 rounded-md relative overflow-hidden flex items-center justify-center">
                <div className="absolute left-0 top-0 bottom-0 bg-emerald-600/80 transition-all duration-500" style={{width: `${mRoi * 100}%`}}></div>
                <span className="relative text-[10px] md:text-xs font-bold text-white z-10 tracking-wider">¥ {machineEarned.toFixed(1)}</span>
             </div>
          </div>

          <div className="bg-[#1a1c20] p-4 md:p-6 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-sm">
            <div className="flex items-center gap-3"><span className="text-gray-500 w-10 shrink-0">CPU</span><input type="text" value={c.cpu || ''} onChange={e=>handleUpdateComputer(c.id, 'cpu', e.target.value)} className="flex-1 min-w-0 bg-[#2b2d33] text-white px-3 py-2 rounded outline-none" /></div>
            <div className="flex items-center gap-3"><span className="text-gray-500 w-10 shrink-0">显卡</span><input type="text" value={c.gpu || ''} onChange={e=>handleUpdateComputer(c.id, 'gpu', e.target.value)} className="flex-1 min-w-0 bg-[#2b2d33] text-white px-3 py-2 rounded outline-none" /></div>
            <div className="flex items-center gap-3"><span className="text-gray-500 w-10 shrink-0">内存</span><input type="text" value={c.ram || ''} onChange={e=>handleUpdateComputer(c.id, 'ram', e.target.value)} className="flex-1 min-w-0 bg-[#2b2d33] text-white px-3 py-2 rounded outline-none" /></div>
            <div className="flex items-center gap-3"><span className="text-gray-500 w-10 shrink-0">固态</span><input type="text" value={c.ssd || ''} onChange={e=>handleUpdateComputer(c.id, 'ssd', e.target.value)} className="flex-1 min-w-0 bg-[#2b2d33] text-white px-3 py-2 rounded outline-none" /></div>
            <div className="col-span-1 md:col-span-2 mt-2 md:mt-4 pt-4 border-t border-[#333] flex items-center gap-3"><span className="text-gray-400 font-bold shrink-0">成本</span><input type="number" value={c.cost || ''} onChange={e=>handleUpdateComputer(c.id, 'cost', e.target.value)} className="flex-1 min-w-0 bg-[#2b2d33] text-blue-400 font-bold px-3 py-2 rounded outline-none" /></div>
          </div>

          <div>
             {/* 🌟 核心修改 2：扩充到 8 个附件，两排展示 */}
             <span className="text-gray-400 text-sm font-bold mb-3 md:mb-4 block">设备档案图 (点击上传) <span className="text-blue-500 text-xs font-normal ml-2">支持8图</span></span>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {['img1', 'img2', 'img3', 'img4', 'img5', 'img6', 'img7', 'img8'].map((imgKey, i) => (
                   <ImageUploadSlot 
                     key={imgKey} 
                     label={`外观${i+1}`} 
                     image={c[imgKey]} 
                     onUpload={(b64) => handleUpdateComputer(c.id, imgKey, b64)} 
                     onRemove={() => handleUpdateComputer(c.id, imgKey, '')} 
                     onPreview={onPreviewImage}
                   />
                ))}
             </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 md:mt-6 pt-4 border-t border-[#333] gap-4">
             <div className="flex items-center gap-3 w-full sm:w-auto">
               <span className="text-gray-500 text-sm font-bold shrink-0">修改编号</span>
               <input type="text" value={c.sn || ''} onChange={e=>handleUpdateComputer(c.id, 'sn', e.target.value)} className="flex-1 min-w-0 sm:w-32 bg-[#111] text-white px-3 py-2 rounded border border-gray-700 font-bold outline-none" placeholder="设备编号" />
             </div>
             <button onClick={() => handleDeleteComputer(c.id, c.sn)} className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition font-bold border border-red-500/30">
                <Trash2 size={16} /> 删除该机
             </button>
          </div>
        </div>
      </div>
    );
  }

  let totalCost = 0, totalEarned = 0;
  computers.forEach(c => totalCost += (Number(c.cost) || 0));
  orders.forEach(o => totalEarned += (Number(o.paidRent) || 0));
  const totalRoi = totalCost > 0 ? (totalEarned / totalCost) : 0;
  const roiColor = totalRoi >= 1.0 ? "#2FA572" : "#3B8ED0";
  
  const totalCount = computers.length;
  const rentedCount = computers.filter(c => getIsRented(c.sn)).length;
  const rentedRatio = totalCount > 0 ? (rentedCount / totalCount) : 0;

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl md:text-2xl font-bold text-white">设备资产库</h2>
          <div className="bg-gray-800 p-1 rounded-lg flex space-x-1 text-sm">
            {['全部', '在租', '空闲'].map(f => (
              <button key={f} onClick={() => setCompFilter(f)} className={`px-3 py-1 rounded-md transition ${compFilter === f ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>{f}</button>
            ))}
          </div>
        </div>
        <button onClick={handleAddComputer} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-transform active:scale-95"><Plus size={18} /> 新增空闲设备</button>
      </div>

      <div className="bg-[#22252b] rounded-xl p-6 mb-6 border border-gray-800 flex flex-col md:flex-row items-center gap-6 shadow-sm">
        <div className="relative w-24 h-24 flex items-center justify-center shrink-0 rounded-full border-[10px]" style={{ borderColor: '#1F1F1F', borderTopColor: totalRoi > 0 ? roiColor : '#1F1F1F', borderRightColor: totalRoi > 0.25 ? roiColor : '#1F1F1F', borderBottomColor: totalRoi > 0.5 ? roiColor : '#1F1F1F', borderLeftColor: totalRoi > 0.75 ? roiColor : '#1F1F1F', transform: 'rotate(45deg)'}}>
           <span className="absolute font-bold text-white text-lg" style={{transform: 'rotate(-45deg)'}}>{(totalRoi * 100).toFixed(0)}%</span>
        </div>
        
        <div className="flex-1 w-full text-center md:text-left flex flex-col justify-center gap-3">
          <div>
            <p className="text-xl font-bold text-white mb-1">总采购成本: ¥ {totalCost.toFixed(2)} <span className="mx-4 text-gray-600">|</span> 总收益: ¥ {totalEarned.toFixed(2)}</p>
            <p className={`font-bold text-sm ${totalRoi >= 1.0 ? 'text-emerald-500' : 'text-blue-400'}`}>资产整体回本: {totalRoi >= 1.0 ? '已盈利' : '奋斗中'}</p>
          </div>
          
          <div className="w-full max-w-md mx-auto md:mx-0 bg-[#1a1c20] p-2.5 rounded-lg border border-gray-700/50">
            <div className="flex justify-between items-end mb-1.5 px-1">
              <span className="text-xs text-gray-400 font-bold">设备在租率</span>
              <span className="text-xs font-mono font-bold text-white"><span className="text-blue-400 text-sm">{rentedCount}</span> / {totalCount}</span>
            </div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${rentedRatio * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6 items-start">
        {filteredComputers.map(c => {
           const isRented = getIsRented(c.sn);
           const costVal = Number(c.cost) || 0;
           
           let machineEarned = 0; 
           orders.filter(o => o.computerSn === c.sn).forEach(o => {
             machineEarned += o._dailyRate * Math.max(0, Math.min(o._el, o._totalDays));
           });

           return (
             <div 
               key={c.id} 
               onClick={() => setSelectedId(c.id)}
               className="bg-[#1e2024] rounded-xl border border-[#3c3f41] flex flex-col justify-between min-h-[7rem] h-auto cursor-pointer hover:border-gray-500 transition-all hover:scale-105 shadow-sm group p-3"
             >
               <div className="flex-1 flex items-center justify-center gap-2 md:gap-3 transition-transform duration-300">
                 <div className={`w-2 h-2 md:w-3 md:h-3 shrink-0 rounded-full ${isRented ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`}></div>
                 <span className="font-bold text-white group-hover:text-blue-400 transition-colors tracking-wider text-base md:text-xl truncate">{c.sn || '未命名'}</span>
               </div>
               
               <div className="w-full mt-auto pt-2 border-t border-[#333] opacity-80 group-hover:opacity-100 transition-opacity">
                 <div className="flex justify-end items-end text-[10px] mb-1 px-0.5">
                    <span className="text-gray-500 scale-90 origin-right"><span className={machineEarned >= costVal ? "text-emerald-500" : "text-red-500"}>{machineEarned.toFixed(0)}</span> / {costVal.toFixed(0)}</span>
                 </div>
                 <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                   <div className={`h-full ${machineEarned >= costVal ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min((machineEarned / (costVal || 1)) * 100, 100)}%` }}></div>
                 </div>
               </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}
