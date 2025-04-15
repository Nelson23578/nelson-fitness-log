import { useState, useEffect } from 'react';
import './index.css';
import { format } from 'date-fns';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, getDocs, deleteDoc, updateDoc, doc 
} from 'firebase/firestore';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend
);

// ======== Firebase config (請根據需求更新) ========
const firebaseConfig = {
  apiKey: "AIzaSyDMon5QSBYLU364hC47PB_5gYTzgSWxJ7U",
  authDomain: "nelsonfitness-73c29.firebaseapp.com",
  projectId: "nelsonfitness-73c29",
  storageBucket: "nelsonfitness-73c29.firebasestorage.app",
  messagingSenderId: "102978622006",
  appId: "1:102978622006:web:2e234ee33bd3ffad097e97",
  measurementId: "G-0X697D6K2F"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function FitnessLog() {
  const today = format(new Date(), 'yyyy-MM-dd');

  // 主分頁： "today"、"history"、"analysis"、"edit"
  const [activeTab, setActiveTab] = useState("today");

  /* ===== 當日健身記錄狀態 ===== */
  const [date, setDate] = useState(today);
  const [part, setPart] = useState('');
  const [action, setAction] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [records, setRecords] = useState(() => {
    const storedRecords = localStorage.getItem('todayRecords');
    const storedDate = localStorage.getItem('todayDate');
    return (storedRecords && storedDate === today) ? JSON.parse(storedRecords) : [];
  });
  const [startTime, setStartTime] = useState(() => {
    const storedStartTime = localStorage.getItem('todayStartTime');
    const storedDate = localStorage.getItem('todayDate');
    return (storedStartTime && storedDate === today) ? new Date(storedStartTime) : null;
  });
  const [todayReport, setTodayReport] = useState(null);

  /* ===== 歷史紀錄查詢狀態 ===== */
  const [historyStartDate, setHistoryStartDate] = useState(today);
  const [historyEndDate, setHistoryEndDate] = useState(today);
  const [historyPart, setHistoryPart] = useState("");
  const [historyData, setHistoryData] = useState([]);

  /* ===== 健身紀錄分析狀態 ===== */
  const [analysisSubTab, setAnalysisSubTab] = useState("weight");
  // 動作重量分析
  const [analysisAction, setAnalysisAction] = useState('');
  const [analysisStartDate, setAnalysisStartDate] = useState(today);
  const [analysisEndDate, setAnalysisEndDate] = useState(today);
  const [analysisData, setAnalysisData] = useState([]);
  // 單月健身紀錄 (日曆)
  const [calendarMonth, setCalendarMonth] = useState(today.substring(0,7));
  const [calendarData, setCalendarData] = useState({});
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // 新增：用以標示當前選取日
  const [calendarDisplayMode, setCalendarDisplayMode] = useState("icon");
  // 部位總組數
  const [setsParts, setSetsParts] = useState([]);
  const [setsPeriod, setSetsPeriod] = useState("7");
  const [setsChartData, setSetsChartData] = useState(null);

  /* ===== 動作管理 & DB Actions ===== */
  const [dbActions, setDbActions] = useState({});
  const [actionsList, setActionsList] = useState([]);
  const [deletedActionIds, setDeletedActionIds] = useState([]);
  const [newActionPart, setNewActionPart] = useState('');
  const [newActionName, setNewActionName] = useState('');

  /* ===== 部位順序 & 顏色設定 (同編輯介面) ===== */
  const partOrder = [
    "胸部訓練",
    "背部訓練",
    "肩部訓練",
    "三頭肌訓練",
    "二頭肌訓練",
    "腿部訓練",
    "核心訓練"
  ];
  const partColors = {
    "胸部訓練": "#FFE1E1",
    "背部訓練": "#E1E4FF",
    "肩部訓練": "#E1FFEB",
    "三頭肌訓練": "#FFF9E1",
    "二頭肌訓練": "#FFF1E1",
    "腿部訓練": "#FFE1F9",
    "核心訓練": "#E1FFFF",
  };

  // 初始化讀取 actions
  const fetchAllActionsFromDB = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'actions'));
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActionsList(allDocs);

      const grouped = {};
      allDocs.forEach(item => {
        if (!grouped[item.part]) grouped[item.part] = [];
        grouped[item.part].push(item.action);
      });
      setDbActions(grouped);

      console.log("✅ 從 Firestore 讀取動作:", allDocs);
    } catch (err) {
      console.error("讀取動作資料失敗", err);
    }
  };

  useEffect(() => {
    fetchAllActionsFromDB();
  }, []);

  // ====================
  // 當日健身記錄功能
  // ====================
  const addRecord = () => {
    if (!part || !action || !weight || !reps || !sets) {
      alert("請確保所有欄位都已輸入！");
      return;
    }
    const existingIndex = records.findIndex(
      r => r.part === part && r.action === action && r.weight === weight && r.reps === reps
    );
    if (existingIndex !== -1) {
      const updated = [...records];
      updated[existingIndex].sets = parseInt(updated[existingIndex].sets) + parseInt(sets);
      setRecords(updated);
    } else {
      setRecords([...records, { part, action, weight, reps, sets }]);
    }
    setWeight('');
    setReps('');
    setSets('');
    if (!startTime) setStartTime(new Date());
  };

  useEffect(() => {
    localStorage.setItem('todayRecords', JSON.stringify(records));
    localStorage.setItem('todayDate', today);
  }, [records, today]);

  useEffect(() => {
    if (startTime) {
      localStorage.setItem('todayStartTime', startTime.toISOString());
    }
  }, [startTime]);

  const deleteRecord = (index) => {
    const updated = records.filter((_, i) => i !== index);
    setRecords(updated);
  };

  const finishWorkout = async () => {
    if (records.length === 0) {
      alert("尚未新增任何今日紀錄，無法送出！");
      return;
    }
    if (!window.confirm("確定要送出今天的記錄嗎？送出後將無法修改！")) return;
    const endTime = new Date();
    const duration = startTime ? Math.round((endTime - startTime) / 1000) : 0;
    const formattedStart = startTime ? startTime.toLocaleTimeString() : '無';
    const formattedEnd = endTime.toLocaleTimeString();
    const dataToStore = { date, startTime: formattedStart, endTime: formattedEnd, duration, records };

    try {
      await addDoc(collection(db, 'fitnessRecords'), dataToStore);
      alert("✅ 資料已儲存到 Firebase！");
    } catch (error) {
      console.error("❌ 寫入 Firebase 失敗：", error);
    }

    setTodayReport({ date, records: [...records], duration });
    setRecords([]);
    setStartTime(null);
    setPart('');
    setAction('');
    setWeight('');
    setReps('');
    setSets('');
    localStorage.removeItem('todayRecords');
    localStorage.removeItem('todayStartTime');
    localStorage.removeItem('todayDate');
  };

  const exportTextReport = () => {
    if (!todayReport) return;
    const { date, records, duration } = todayReport;

    const lines = [];
    lines.push(`健身報表`);
    lines.push(`日期：${date}`);
    lines.push(`總健身時長：${Math.floor(duration / 60)} 分 ${duration % 60} 秒`);
    lines.push('');

    const grouped = {};
    for (const r of records) {
      if (!grouped[r.part]) grouped[r.part] = {};
      if (!grouped[r.part][r.action]) grouped[r.part][r.action] = [];
      grouped[r.part][r.action].push(r);
    }
    for (const pt in grouped) {
      lines.push(`【${pt}】`);
      for (const act in grouped[pt]) {
        lines.push(`  └ 動作：${act}`);
        grouped[pt][act].forEach((item, idx) => {
          lines.push(`      - ${idx+1}. 重量: ${item.weight}kg, 次數: ${item.reps}, 組數: ${item.sets}`);
        });
      }
      lines.push('');
    }

    const reportText = lines.join('\n');
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `健身報表_${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!todayReport) return;
    const reportElement = document.getElementById("report");
    if (!reportElement) return;
    const canvas = await html2canvas(reportElement);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'a4');
    const margin = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
    pdf.save(`健身報表_${todayReport.date}.pdf`);
  };

  // ====================
  // 歷史紀錄查詢
  // ====================
  const queryHistory = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'fitnessRecords'));
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      let results = allDocs.filter(doc => doc.date >= historyStartDate && doc.date <= historyEndDate);

      if (historyPart) {
        results = results.map(doc => {
          const filteredRecords = doc.records.filter(r => r.part === historyPart);
          return { ...doc, records: filteredRecords };
        }).filter(doc => doc.records.length > 0);
      }
      setHistoryData(results);
    } catch (e) {
      console.error("歷史紀錄查詢失敗", e);
    }
  };

  // ====================
  // 健身紀錄分析
  // ====================
  // 動作重量分析
  const queryAnalysisData = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'fitnessRecords'));
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const results = allDocs.filter(doc => doc.date >= analysisStartDate && doc.date <= analysisEndDate);
      setAnalysisData(results);
    } catch (e) {
      console.error("分析失敗", e);
    }
  };

  // 單月健身紀錄 (日曆)
  const queryCalendar = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'fitnessRecords'));
      const allDocs = snapshot.docs.map(doc => doc.data());
      let calObj = {};
      for (const doc of allDocs) {
        if (doc.date.startsWith(calendarMonth)) {
          if (!calObj[doc.date]) {
            calObj[doc.date] = new Set();
          }
          for (const r of doc.records) {
            calObj[doc.date].add(r.part);
          }
        }
      }
      let result = {};
      for (let d in calObj) {
        result[d] = {
          marked: true,
          parts: Array.from(calObj[d])
        };
      }
      setCalendarData(result);
    } catch (err) {
      console.error("讀取月曆資料失敗", err);
    }
  };

  // 部位總組數查詢
  const querySets = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'fitnessRecords'));
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const periodDays = parseInt(setsPeriod);
      const end = new Date(today);
      const start = new Date(end);
      start.setDate(end.getDate() - periodDays + 1);
      const startStr = format(start, 'yyyy-MM-dd');
      let results = allDocs.filter(doc => doc.date >= startStr && doc.date <= today);

      const totals = {};
      for (const doc of results) {
        for (const r of doc.records) {
          if (setsParts.length > 0 && !setsParts.includes(r.part)) continue;
          const count = parseInt(r.sets) || 0;
          if (!totals[r.part]) totals[r.part] = 0;
          totals[r.part] += count;
        }
      }
      if (setsParts.length > 0) {
        for (const k in totals) {
          if (!setsParts.includes(k)) {
            delete totals[k];
          }
        }
      }
      const labels = Object.keys(totals);
      const data = labels.map(label => totals[label]);
      const chartData = {
        labels,
        datasets: [
          {
            label: "總訓練組數",
            data,
            backgroundColor: "rgba(75, 192, 192, 0.6)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1,
          }
        ]
      };
      setSetsChartData(chartData);
    } catch (err) {
      console.error("查詢部位總組數失敗", err);
    }
  };

  // 動作重量分析圖表
  const weightChartData = {
    labels: analysisData.map(d => d.date),
    datasets: [
      {
        label: `${analysisAction} 最高重量`,
        data: analysisData.map(d => {
          const weights = d.records
            .filter(r => r.action === analysisAction)
            .map(r => Number(r.weight));
          return weights.length > 0 ? Math.max(...weights) : null;
        }),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        tension: 0.3,
      },
    ],
  };

  const weightChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: '動作重量分析圖' },
    },
  };

  // 報表內容 (依部位與動作分組)
  let groupedReport = {};
  if (todayReport && todayReport.records) {
    for (const r of todayReport.records) {
      if (!groupedReport[r.part]) groupedReport[r.part] = {};
      if (!groupedReport[r.part][r.action]) groupedReport[r.part][r.action] = [];
      groupedReport[r.part][r.action].push(r);
    }
  }

  // 編輯動作管理：依部位排序 + 顏色
  const handleEditActionName = (index, newName) => {
    const updated = [...actionsList];
    updated[index].action = newName;
    setActionsList(updated);
  };
  const deleteActionItem = (index) => {
    const item = actionsList[index];
    if (item.id) {
      setDeletedActionIds(prev => [...prev, item.id]);
    }
    const updated = actionsList.filter((_, i) => i !== index);
    setActionsList(updated);
  };
  const saveActionsChanges = async () => {
    try {
      for (const item of actionsList) {
        await updateDoc(doc(db, 'actions', item.id), {
          part: item.part,
          action: item.action
        });
      }
      for (const id of deletedActionIds) {
        await deleteDoc(doc(db, 'actions', id));
      }
      alert("動作更新完成");
      setDeletedActionIds([]);
      fetchAllActionsFromDB();
    } catch (err) {
      console.error("更新動作失敗", err);
      alert("更新動作失敗");
    }
  };
  const addNewAction = async () => {
    if (!newActionPart || !newActionName) {
      alert("請輸入完整資訊");
      return;
    }
    try {
      await addDoc(collection(db, 'actions'), { part: newActionPart, action: newActionName });
      alert("新增動作成功");
      setNewActionPart('');
      setNewActionName('');
      fetchAllActionsFromDB();
    } catch (err) {
      console.error("新增動作失敗", err);
      alert("新增動作失敗");
    }
  };

  return (
    <div className="container">
      <h1>Nelson 的健身紀錄</h1>

      {/* 分頁導覽 */}
      <div className="tabs">
        <button 
          className={activeTab === "today" ? "active" : ""} 
          onClick={() => setActiveTab("today")}
        >
          當日健身記錄
        </button>
        <button 
          className={activeTab === "history" ? "active" : ""} 
          onClick={() => setActiveTab("history")}
        >
          歷史紀錄查詢
        </button>
        <button 
          className={activeTab === "analysis" ? "active" : ""} 
          onClick={() => setActiveTab("analysis")}
        >
          健身紀錄分析
        </button>
        <button 
          className={activeTab === "edit" ? "active" : ""} 
          onClick={() => setActiveTab("edit")}
        >
          編輯動作管理
        </button>
      </div>

      {/* 當日健身記錄 */}
      {activeTab === "today" && (
        <div className="tab-content">
          <div className="form-group">
            <label>日期：</label>
            <input 
              type="date" 
              value={date} 
              max={today} 
              onChange={(e) => setDate(e.target.value)}
            />
            <label>訓練部位：</label>
            <select 
              value={part} 
              onChange={(e) => {
                setPart(e.target.value);
                setAction('');
              }}
            >
              <option value="">選擇訓練部位</option>
              {Object.keys(dbActions).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {part && (
              <>
                <label>訓練動作：</label>
                <select 
                  value={action} 
                  onChange={(e) => setAction(e.target.value)}
                >
                  <option value="">選擇訓練動作</option>
                  {dbActions[part]?.map((act) => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
              </>
            )}

            <label>重量 (kg)：</label>
            <input 
              type="number" 
              placeholder="重量 (kg)" 
              value={weight} 
              onChange={(e) => setWeight(e.target.value)} 
            />
            <label>次數 (次)：</label>
            <input 
              type="number" 
              placeholder="次數 (次)" 
              value={reps} 
              onChange={(e) => setReps(e.target.value)} 
            />
            <label>組數 (組)：</label>
            <input 
              type="number" 
              placeholder="組數 (組)" 
              value={sets} 
              onChange={(e) => setSets(e.target.value)} 
            />
            <button onClick={addRecord}>新增紀錄</button>
          </div>

          {/* 今日紀錄 - 不同部位背景顏色 */}
          <div className="records-wrapper">
            <h2>今日紀錄</h2>
            {records.map((r, i) => {
              // 依部位套用背景色
              const bgColor = partColors[r.part] || '#FAFFFF';
              return (
                <div
                  className="record-item"
                  key={i}
                  style={{ backgroundColor: bgColor }}
                >
                  <div className="info">
                    <div>
                      {r.part} - {r.action} | {r.weight}kg x {r.reps}次 x {r.sets}組
                    </div>
                    <button 
                      className="delete-button" 
                      onClick={() => deleteRecord(i)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={finishWorkout}>完成紀錄</button>
          {todayReport && (
            <>
              <button onClick={exportTextReport}>匯出文字報表</button>
              <button onClick={exportPDF}>匯出 PDF 報表</button>
            </>
          )}
        </div>
      )}

      {/* 歷史紀錄查詢 */}
      {activeTab === "history" && (
        <div className="tab-content">
          <div className="form-group">
            <label>起始日期：</label>
            <input 
              type="date" 
              value={historyStartDate} 
              max={today} 
              onChange={(e) => setHistoryStartDate(e.target.value)}
            />
            <label>結束日期：</label>
            <input 
              type="date" 
              value={historyEndDate} 
              min={historyStartDate} 
              max={today} 
              onChange={(e) => setHistoryEndDate(e.target.value)}
            />
            <label>訓練部位：</label>
            <select 
              value={historyPart} 
              onChange={(e) => setHistoryPart(e.target.value)}
            >
              <option value="">全部部位</option>
              {Object.keys(dbActions).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button onClick={queryHistory}>查詢歷史紀錄</button>
          </div>

          {historyData.length > 0 && (
            <div>
              {historyData.map((item, idx) => (
                <div key={idx} className="history-record">
                  <div><strong>📅 {item.date}</strong></div>
                  {item.records.map((r, j) => (
                    <div 
                      key={j} 
                      className="info" 
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        {r.part} - {r.action} | {r.weight}kg x {r.reps}次 x {r.sets}組
                      </div>
                      <button
                        className="delete-button"
                        onClick={async () => {
                          try {
                            // 只刪除當日紀錄中的第 j 筆，若刪除完後無紀錄，便直接刪除文件
                            const snapshot = await getDocs(collection(db, 'fitnessRecords'));
                            const foundDoc = snapshot.docs.find(d => d.data().date === item.date);
                            if (foundDoc) {
                              const docRef = foundDoc.ref;
                              const docData = foundDoc.data();
                              const updatedRecords = docData.records.filter((_, recordIndex) => recordIndex !== j);

                              if (updatedRecords.length === 0) {
                                // 若沒有剩餘紀錄，直接刪除此份文件
                                await deleteDoc(docRef);
                              } else {
                                // 否則僅更新該文件的 records
                                await updateDoc(docRef, { records: updatedRecords });
                              }
                              alert('刪除成功');
                              queryHistory();
                            }
                          } catch (err) {
                            console.error('刪除失敗', err);
                            alert('刪除失敗');
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#555' }}>
                    ⏱️ 總健身時長：{Math.floor(item.duration / 60)} 分 {item.duration % 60} 秒
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 健身紀錄分析 */}
      {activeTab === "analysis" && (
        <div className="tab-content">
          <div className="analysis-tabs">
            <button 
              onClick={() => setAnalysisSubTab("weight")} 
              className={analysisSubTab === "weight" ? "active" : ""}
            >
              動作重量分析
            </button>
            <button 
              onClick={() => setAnalysisSubTab("calendar")} 
              className={analysisSubTab === "calendar" ? "active" : ""}
            >
              單月健身紀錄
            </button>
            <button 
              onClick={() => setAnalysisSubTab("sets")} 
              className={analysisSubTab === "sets" ? "active" : ""}
            >
              部位總組數
            </button>
          </div>

          {/* 1. 動作重量分析 */}
          {analysisSubTab === "weight" && (
            <>
              <div className="analysis form-group">
                <label>分析動作：</label>
                <select 
                  value={analysisAction} 
                  onChange={(e) => setAnalysisAction(e.target.value)}
                >
                  <option value="">選擇訓練動作</option>
                  {[...new Set(Object.values(dbActions).flat())].map(act => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
                <label>起始日期：</label>
                <input 
                  type="date" 
                  value={analysisStartDate} 
                  max={today} 
                  onChange={(e) => setAnalysisStartDate(e.target.value)}
                />
                <label>結束日期：</label>
                <input 
                  type="date" 
                  value={analysisEndDate} 
                  min={analysisStartDate} 
                  max={today} 
                  onChange={(e) => setAnalysisEndDate(e.target.value)}
                />
                <button onClick={queryAnalysisData}>查詢</button>
              </div>
              {analysisData.length > 0 && analysisAction && (
                <div className="chart-section">
                  <Line options={weightChartOptions} data={weightChartData} />
                </div>
              )}
            </>
          )}

          {/* 2. 單月健身紀錄 (日曆) */}
          {analysisSubTab === "calendar" && (
            <>
              <div className="analysis form-group">
                <label>選擇月份：</label>
                <input 
                  type="month" 
                  value={calendarMonth} 
                  max={today.substring(0,7)} 
                  onChange={(e) => setCalendarMonth(e.target.value)}
                />
                <button onClick={queryCalendar}>更新</button>
                <button 
                  onClick={() => setCalendarDisplayMode(calendarDisplayMode === "icon" ? "parts" : "icon")}
                >
                  切換顯示模式：{calendarDisplayMode === "icon" ? "圖示" : "部位"}
                </button>
              </div>
              <div className="calendar-grid">
                {[...Array(31)].map((_, i) => {
                  const d = `${calendarMonth}-${(i + 1).toString().padStart(2, '0')}`;
                  const calInfo = calendarData[d];
                  const isToday = (d === today);
                  const isSelected = (d === selectedDate);

                  return (
                    <div 
                      key={d}
                      className={`calendar-day ${calInfo ? 'marked' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                      title={calInfo ? calInfo.parts.join(', ') : ''}
                      onClick={async () => {
                        try {
                          setSelectedDate(d);
                          const snapshot = await getDocs(collection(db, 'fitnessRecords'));
                          const found = snapshot.docs.find(doc => doc.data().date === d);
                          setSelectedDayData(found ? found.data() : null);
                        } catch (err) {
                          console.error("讀取選取日期失敗", err);
                        }
                      }}
                    >
                      {i + 1}
                      {calInfo && (
                        calendarDisplayMode === "icon"
                          ? " 🏋️"
                          : (
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              marginTop: 4 
                            }}>
                              {calInfo.parts.map((pName, idx) => (
                                <span
                                  key={idx}
                                  className="calendar-part-tag"
                                  style={{
                                    backgroundColor: partColors[pName] || '#eee'
                                  }}
                                >
                                  {pName}
                                </span>
                              ))}
                            </div>
                          )
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedDayData && (
                <div className="history-record">
                  <h3>📅 {selectedDayData.date} 詳細紀錄</h3>
                  {selectedDayData.records.map((r, i) => (
                    <div key={i} className="info">
                      {r.part} - {r.action} | {r.weight}kg x {r.reps}次 x {r.sets}組
                    </div>
                  ))}
                  <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#555' }}>
                    ⏱️ 總健身時長：{Math.floor(selectedDayData.duration/60)} 分 {selectedDayData.duration % 60} 秒
                  </div>
                </div>
              )}
            </>
          )}

          {/* 3. 部位總組數 */}
          {analysisSubTab === "sets" && (
            <>
              <div className="analysis form-group">
                <label>選擇部位 (多選)：</label>
                <select 
                  multiple 
                  value={setsParts} 
                  onChange={(e) => {
                    const opts = e.target.options;
                    const values = [];
                    for (let i = 0; i < opts.length; i++) {
                      if (opts[i].selected) {
                        values.push(opts[i].value);
                      }
                    }
                    setSetsParts(values);
                  }}
                >
                  {Object.keys(dbActions).map(partName => (
                    <option key={partName} value={partName}>{partName}</option>
                  ))}
                </select>
                <label>選擇時間區間：</label>
                <select 
                  value={setsPeriod} 
                  onChange={(e) => setSetsPeriod(e.target.value)}
                >
                  <option value="7">近一周</option>
                  <option value="30">近一個月</option>
                  <option value="90">近三個月</option>
                  <option value="180">近半年</option>
                  <option value="365">近一年</option>
                </select>
                <button onClick={querySets}>查詢</button>
              </div>
              {setsChartData && (
                <div className="chart-section">
                  <Bar 
                    data={setsChartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: '部位總訓練組數' }
                      }
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 編輯動作管理 */}
      {activeTab === "edit" && (
        <div className="tab-content">
          <h2>編輯現有動作</h2>
          <button onClick={fetchAllActionsFromDB}>重新載入動作列表</button>

          <div className="edit-section">
            {(() => {
              const groupByPart = {};
              for (const act of actionsList) {
                if (!groupByPart[act.part]) groupByPart[act.part] = [];
                groupByPart[act.part].push(act);
              }

              // 依 partOrder 排序
              const sorted = [];
              for (const p of partOrder) {
                if (groupByPart[p] && groupByPart[p].length > 0) {
                  sorted.push({ part: p, items: groupByPart[p] });
                }
              }
              // 其他未列在 partOrder 的部位
              for (const p in groupByPart) {
                if (!partOrder.includes(p)) {
                  sorted.push({ part: p, items: groupByPart[p] });
                }
              }

              return sorted.map((group) => (
                <div 
                  key={group.part} 
                  className="edit-part-group"
                  style={{ backgroundColor: partColors[group.part] || '#EEE' }}
                >
                  <div className="edit-part-title">{group.part}</div>
                  {group.items.map(actItem => {
                    const idx = actionsList.findIndex(a => a.id === actItem.id);
                    if (idx === -1) return null;
                    return (
                      <div key={actItem.id} className="edit-item-row">
                        <input
                          className="edit-input"
                          type="text"
                          value={actionsList[idx].action}
                          onChange={(e) => handleEditActionName(idx, e.target.value)}
                        />
                        <button 
                          className="delete-button"
                          onClick={() => deleteActionItem(idx)}
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
          <button onClick={saveActionsChanges}>儲存修改</button>

          <h2>新增新動作</h2>
          <div className="form-group">
            <label>訓練部位：</label>
            <select 
              value={newActionPart} 
              onChange={(e) => setNewActionPart(e.target.value)}
            >
              <option value="">請選擇</option>
              {partOrder.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <label>動作名稱：</label>
            <input 
              type="text" 
              value={newActionName} 
              onChange={(e) => setNewActionName(e.target.value)}
              className="edit-input"
            />
            <button onClick={addNewAction}>新增動作</button>
          </div>
        </div>
      )}

      {/* 報表 (供 PDF 匯出) */}
      {todayReport && (
        <div id="report">
          <h1 style={{ textAlign: 'center' }}>健身報表</h1>
          <p>日期：{todayReport.date}</p>
          <p>總健身時長：{Math.floor(todayReport.duration / 60)} 分 {todayReport.duration % 60} 秒</p>
          {Object.entries(groupedReport).map(([pt, actions]) => (
            <div key={pt}>
              <h2>{pt}</h2>
              {Object.entries(actions).map(([act, items]) => (
                <div key={act}>
                  <h3>{act}</h3>
                  <ul>
                    {items.map((item, idx) => (
                      <li key={idx}>重量：{item.weight}kg, 次數：{item.reps}, 組數：{item.sets}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
