import { useState, useEffect, useRef } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal } from '@shared';
import '@styles/features/payroll.css';
import RatesManager from '@features/resources/RatesManager';
import EmployeeLedger from './EmployeeLedger';
import PaymentModal from './PaymentModal';
import ShipmentHistoryModal from '@features/shipments/ShipmentHistoryModal';

const INITIAL_PAYROLL_COLS = [
    { key: 'date', label: 'Date', checked: true },
    { key: 'shipmentID', label: 'Shipment ID', checked: true },
    { key: 'customer', label: 'Customer/Dest', checked: true },
    { key: 'route', label: 'Route', checked: true },
    { key: 'vehicleType', label: 'Vehicle Type', checked: true },
    { key: 'rate', label: 'Rate/Fee', checked: true },
    { key: 'adjustment', label: 'Shipment Adj', checked: true },
    { key: 'reason', label: 'Adj Reason', checked: true },
    { key: 'allowance', label: 'Allowance', checked: false },
];

// --- ✅ SMART PAGINATION COMPONENT ---
const PaginationControls = ({ currentPage, totalItems, rowsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    
    // Sliding Window Logic (Show 5 pages at a time)
    const currentBlock = Math.ceil(currentPage / 5);
    const startPage = (currentBlock - 1) * 5 + 1;
    const endPage = Math.min(startPage + 4, totalPages);

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    if (totalPages <= 1) return null;

    return (
        <div className="pagination-footer">
            <button 
                disabled={currentPage === 1} 
                onClick={() => onPageChange(currentPage - 1)}
            >
                Prev
            </button>
            {pageNumbers.map(num => (
                <button 
                    key={num} 
                    className={currentPage === num ? 'active' : ''} 
                    onClick={() => onPageChange(num)}
                >
                    {num}
                </button>
            ))}
            <button 
                disabled={currentPage === totalPages} 
                onClick={() => onPageChange(currentPage + 1)}
            >
                Next
            </button>
        </div>
    );
};

function PayrollView() {
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [payrollData, setPayrollData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ totalSalary: 0, totalAllowance: 0, headCount: 0 });
    const [showRatesManager, setShowRatesManager] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [payingEmployee, setPayingEmployee] = useState(null);
    const [viewingTrips, setViewingTrips] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [columnConfig, setColumnConfig] = useState(INITIAL_PAYROLL_COLS);
    const [selectedExportPeriods, setSelectedExportPeriods] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 8;
    const [feedbackModal, setFeedbackModal] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState('');

    const getAvailableYears = () => {
        const years = periods.map(p => {
            const parts = p.periodName.split(', '); // Split "January 1-15, 2026"
            return parts[1] || ''; // Get "2026"
        }).filter(y => y); // Remove empties
        return [...new Set(years)].sort().reverse(); // Unique & Descending
    };

    // --- 2. HELPER: FILTER PERIODS ---
    const getFilteredPeriods = () => {
        return periods.filter(p => p.periodName.includes(selectedYear));
    };

    const availableYears = getAvailableYears();
    const filteredPeriods = getFilteredPeriods();
    
    // Get unique months for the dropdown
    const availableMonths = [...new Set(filteredPeriods.map(p => p.periodName.split(' ')[0]))];
    
    // Get periods for the selected month
    const periodsInMonth = filteredPeriods.filter(p => p.periodName.startsWith(selectedMonth));

    // Sync Month when Period Changes (e.g. initial load)
    useEffect(() => {
        if (selectedPeriod && periods.length > 0) {
            const p = periods.find(item => item.periodID === Number(selectedPeriod));
            if (p) {
                const month = p.periodName.split(' ')[0];
                if (month !== selectedMonth) setSelectedMonth(month);
            }
        }
    }, [selectedPeriod, periods]);

    const getPeriodName = () => {
        const p = periods.find(item => item.periodID === Number(selectedPeriod));
        return p ? p.periodName : '';
    };
    const dragItem = useRef();
    const dragOverItem = useRef();
    
    // Load Periods
    useEffect(() => {
        const loadPeriods = async () => {
            try {
                const res = await api.get('/payroll/periods');
                const allPeriods = res.data;
                setPeriods(allPeriods);
                
                // Logic: Prioritize CURRENT period (based on today's date)
                const today = new Date();
                today.setHours(0,0,0,0);

                let targetPeriod = null;

                // 1. Try to find the period that contains "Today"
                const currentPeriod = allPeriods.find(p => {
                    const start = new Date(p.startDate);
                    const end = new Date(p.endDate);
                    return today >= start && today <= end;
                });

                if (currentPeriod) {
                    targetPeriod = currentPeriod;
                } else {
                    // 2. Fallback: Find the latest "Open" period that is in the past or present (not future)
                    // We filter out periods that haven't started yet to avoid showing future generated months by default
                    const pastOrActiveOpen = allPeriods.filter(p => {
                        const start = new Date(p.startDate);
                        return p.status === 'OPEN' && start <= today;
                    });

                    if (pastOrActiveOpen.length > 0) {
                        targetPeriod = pastOrActiveOpen[0]; // First one is usually latest due to backend sort
                    } else {
                        // 3. Last Resort: Just take the first one (Backend usually sorts DESC by date)
                        targetPeriod = allPeriods[0];
                    }
                }

                if (targetPeriod) {
                    setSelectedPeriod(targetPeriod.periodID);
                }
            } catch (err) {
                console.error("Failed to load periods", err);
            }
        };
        loadPeriods();
    }, []);

    // Fetch Data when Period Changes
    useEffect(() => {
        if (selectedPeriod) fetchPayrollSummary(selectedPeriod);
    }, [selectedPeriod]);

    // 2. AUTO-FETCH DATA WHEN PERIOD CHANGES
    // This runs immediately after 'setSelectedPeriod' above, and whenever user changes dropdown
    useEffect(() => {
        if (selectedPeriod) {
            fetchPayrollSummary(selectedPeriod);
        }
    }, [selectedPeriod]);

    const isPeriodLocked = () => {
        const p = periods.find(item => item.periodID === Number(selectedPeriod));
        return p && p.status === 'CLOSED';
    };

    const confirmLockPeriod = () => {
        setFeedbackModal({
            type: 'warning',
            title: 'Lock Period?',
            message: 'Are you sure you want to LOCK this payroll period?',
            subMessage: "No more adjustments or payments can be made. This action is final.",
            confirmLabel: "Lock Period",
            onConfirm: () => executeLockPeriod(),
            onClose: () => setFeedbackModal(null)
        });
    };
    // HANDLER: Lock Period
    const executeLockPeriod = async () => {
        try {
            await api.post('/payroll/close', { periodID: selectedPeriod });
            
            // Refresh periods to update status UI
            const res = await api.get('/payroll/periods');
            setPeriods(res.data);
            
            setFeedbackModal({
                type: 'success',
                title: 'Period Locked',
                message: 'The period has been successfully closed.',
                onClose: () => setFeedbackModal(null)
            });
        } catch (error) {
            setFeedbackModal({
                type: 'error',
                title: 'Lock Failed',
                message: 'Could not lock the period. Please try again.',
                onClose: () => setFeedbackModal(null)
            });
        }
    };

    // --- TOGGLE PERIOD HANDLER ---
    const togglePeriod = (id) => {
        setSelectedExportPeriods(prev => 
            prev.includes(id) 
                ? prev.filter(p => p !== id) 
                : [...prev, id]
        );
    };

    const handleSelectAllPeriods = () => {
        if (selectedExportPeriods.length === periods.length) {
            setSelectedExportPeriods([]);
        } else {
            setSelectedExportPeriods(periods.map(p => p.periodID));
        }
    };

    const handleSelectAllColumns = () => {
        const allChecked = columnConfig.every(col => col.checked);
        const newConfig = columnConfig.map(col => ({
            ...col,
            checked: !allChecked
        }));
        setColumnConfig(newConfig);
    };

    const dragStart = (e, position) => {
        dragItem.current = position;
        e.target.classList.add('dragging'); 
    };

    const dragEnter = (e, position) => {
        if (dragItem.current === null || dragItem.current === undefined) return;
        if (dragItem.current !== position) {
            const newList = [...columnConfig];
            const draggedItemContent = newList[dragItem.current];
            newList.splice(dragItem.current, 1);
            newList.splice(position, 0, draggedItemContent);
            dragItem.current = position;
            setColumnConfig(newList);
        }
    };

    const dragEnd = (e) => {
        e.target.classList.remove('dragging');
        dragItem.current = null;
    };

    // --- EXPORT HANDLER ---
    const handleExport = async () => {
        // At least one period selected
        if (selectedExportPeriods.length === 0) {
            setFeedbackModal({
                type: 'error',
                title: 'No Period Selected',
                message: "Please select at least one payroll period sheet to export.",
                onClose: () => setFeedbackModal(null)
            });
            return;
        }

        // At least one column selected
        const hasSelectedColumns = columnConfig.some(col => col.checked);
        if (!hasSelectedColumns) {
            setFeedbackModal({
                type: 'error',
                title: 'No Columns Selected',
                message: "Please check at least one column to include in the export.",
                onClose: () => setFeedbackModal(null)
            });
            return;
        }

        try {
            const selectedKeys = columnConfig.filter(c => c.checked).map(c => c.key);
            
            // Send IDs as a JSON string array
            const params = { 
                periodIDs: JSON.stringify(selectedExportPeriods),
                columns: JSON.stringify(selectedKeys)
            };

            const config = { params: params, responseType: 'blob' };

            const response = await api.get('/payroll/export', config);
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            // Name file based on selection count
            const fileName = selectedExportPeriods.length === 1 
                ? `Payroll_Report_${periods.find(p=>p.periodID === selectedExportPeriods[0])?.periodName}.xlsx`
                : `Payroll_Batch_Report_${new Date().toISOString().slice(0,10)}.xlsx`;

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setShowExportModal(false); 
        } catch (error) {
            console.error(error);
            setFeedbackModal({
                type: 'error',
                title: 'Export Failed',
                message: "An error occurred while generating the file.",
                onClose: () => setFeedbackModal(null)
            });
        }
    };

    const fetchPayrollSummary = async (id) => {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/summary/${id}`);
            setPayrollData(res.data);
            
            // Calc Stats
            const totalSal = res.data.reduce((sum, row) => sum + Number(row.netSalary), 0);
            const totalAllow = res.data.reduce((sum, row) => sum + Number(row.totalAllowance), 0);
            setStats({
                totalSalary: totalSal,
                totalAllowance: totalAllow,
                headCount: res.data.length
            });

        } catch (error) {
            console.error("Error fetching payroll:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedPeriod || loading) return;
        
        setLoading(true);

        try {
            // Artificial delay for spinner visibility 
            await new Promise(resolve => setTimeout(resolve, 600));

            await api.post('/payroll/generate', { periodID: selectedPeriod });

            await fetchPayrollSummary(selectedPeriod); 

        } catch (error) {
            console.error("Generation failed:", error);
            alert("Failed to generate payroll. Please check if the server is running.");
        } finally {
            setLoading(false);
        }
    };

    // B. GENERATE FUTURE PERIODS CONFIRMATION
    const confirmGeneratePeriods = () => {
        setFeedbackModal({
            type: 'confirm', // Using confirm style (usually blue/info)
            title: 'Generate Future Periods',
            message: 'This will automatically generate payroll periods for the next 12 months.',
            subMessage: "Based on the last recorded period date.",
            confirmLabel: "Generate",
            onConfirm: () => executeGeneratePeriods(),
            onClose: () => setFeedbackModal(null)
        });
    };

    const executeGeneratePeriods = async () => {
        setLoading(true);
        setFeedbackModal(null); // Close confirmation
        try {
            const res = await api.post('/payroll/periods/generate');
            
            // Refresh list
            const refreshRes = await api.get('/payroll/periods');
            setPeriods(refreshRes.data);

            setFeedbackModal({
                type: 'success',
                title: 'Periods Generated',
                message: res.data.message,
                onClose: () => setFeedbackModal(null)
            });
        } catch (err) {
            setFeedbackModal({
                type: 'error',
                title: 'Generation Failed',
                message: 'Could not generate new periods.',
                onClose: () => setFeedbackModal(null)
            });
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
    };

    const paginatedData = payrollData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    
    return (
        <div className="payroll-container">
            <div className="payroll-header">                              
                <div className="payroll-controls">
                  
                    <div className="filter-group-bordered">
                        <div style={{display:'flex', flexDirection:'column'}}>
                        <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Year:</label>
                            <select 
                                className="period-select" 
                                style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer'}}
                                value={selectedYear}
                                onChange={(e) => {
                                    setSelectedYear(e.target.value);
                                    // Optional: Auto-select the first period of the new year to avoid dead state
                                    const firstInYear = periods.find(p => p.periodName.includes(e.target.value));
                                    if (firstInYear) setSelectedPeriod(firstInYear.periodID);
                                }}
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{width:'1px', height:'25px', background:'#eee'}}></div>
                        <div style={{display:'flex', flexDirection:'column'}}>
                            <div style={{display:'flex', alignItems:'center', gap: '5px'}}>
                                <label style={{fontSize:'10px', fontWeight:'700', color:'#999', textTransform:'uppercase'}}>Select Period:</label>
                                {selectedPeriod && (
                                    <span style={{
                                        fontSize: '9px',
                                        fontWeight: '700',
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        textTransform: 'uppercase',
                                        backgroundColor: isPeriodLocked() ? '#ffebee' : '#e8f5e9',
                                        color: isPeriodLocked() ? '#c62828' : '#2e7d32',
                                        border: `1px solid ${isPeriodLocked() ? '#ffcdd2' : '#c8e6c9'}`
                                    }}>
                                        {isPeriodLocked() ? 'CLOSED' : 'OPEN'}
                                    </span>
                                )}
                            </div>
                            <div style={{display:'flex', gap: '8px'}}>
                                {/* Month Selector */}
                                <select 
                                    className="period-select" 
                                    style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer', minWidth: '80px'}}
                                    value={selectedMonth}
                                    onChange={(e) => {
                                        const newMonth = e.target.value;
                                        setSelectedMonth(newMonth);
                                        // Auto-select first period of new month
                                        const firstPeriod = filteredPeriods.find(p => p.periodName.startsWith(newMonth));
                                        if (firstPeriod) setSelectedPeriod(firstPeriod.periodID);
                                    }}
                                >
                                    {availableMonths.map(month => (
                                        <option key={month} value={month}>{month}</option>
                                    ))}
                                </select>

                                {/* Period Range Selector */}
                                <select 
                                    className="period-select" 
                                    style={{border:'none', fontSize:'13px', outline:'none', background:'transparent', cursor:'pointer', minWidth: '50px'}} 
                                    value={selectedPeriod}
                                    onChange={(e) => setSelectedPeriod(e.target.value)}
                                >
                                    {periodsInMonth.length > 0 ? (
                                        periodsInMonth.map(p => (
                                            <option key={p.periodID} value={p.periodID}>
                                                {p.periodName.split(',')[0].replace(selectedMonth, '').trim()}
                                            </option>
                                        ))
                                    ) : (
                                        <option disabled>No periods</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div style={{width:'1px', height:'35px', background:'#eee'}}></div>  
                    <button 
                        onClick={confirmGeneratePeriods}
                        className='manage-rates-button'
                        title="Auto-Generate Next Year's Periods"
                    >
                        Generate
                    </button>
                    <button 
                        className="btn-alert" 
                        onClick={confirmLockPeriod}
                        disabled={!selectedPeriod || isPeriodLocked()}
                        style={{
                            background: '#bec0c0ff',
                            border: '2px solid #b7bdbdff',
                            fontSize: '13px',
                            opacity: !selectedPeriod || isPeriodLocked() ? 0.5 : 1,
                            cursor: !selectedPeriod || isPeriodLocked() ? 'not-allowed' : 'pointer'
                        }}
                        title={
                            !selectedPeriod
                                ? 'Select a period first'
                                : isPeriodLocked()
                                    ? 'Period is already locked'
                                    : 'Lock this period'
                        }
                    >
                        <Icons.Lock size={14} style={{marginRight:'5px'}}/> 
                        Lock Period
                    </button>
                    
                    <button 
                      className="btn-generate" 
                      onClick={handleGenerate} 
                      disabled={loading || !selectedPeriod || isPeriodLocked()}
                        style={{ opacity: isPeriodLocked() ? 0.5 : 1, cursor: isPeriodLocked() ? 'not-allowed' : 'pointer' }}
                        title={isPeriodLocked() ? "Period is Locked" : "Generate Payroll"}
                  >
                      <Icons.Refresh 
                          size={18} 
                          className={loading ? "icon-spin" : ""} 
                      />
                    </button>   
                  {/* 3. NEW: Lock Button (Only show if Open) */}
                           
                </div>
                <div style={{display: "flex", gap: "10px"}}>
                    <button className="extract-btn" onClick={() => setShowExportModal(true)}>
                            <Icons.Upload size={16} /> Export to .xlsx
                    </button>
                    <button 
                    className="manage-rates-button" 
                    onClick={() => setShowRatesManager(true)}
                    >
                    <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" style={{fill: 'none',stroke: 'currentColor',strokeWidth: '2px',strokeLinecap: 'round',strokeLinejoin: 'round'}}>
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                        Manage Rates
                    </div>
                    </button>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="stats-row">
                <StatCard 
                    label="Estimated Salary Payout" 
                    value={formatMoney(stats.totalSalary)} 
                    color="#27ae60" 
                />
                <StatCard 
                    label="Total Allowance Given" 
                    value={formatMoney(stats.totalAllowance)} 
                    color="#f39c12" 
                />
                <StatCard 
                    label="Active Employees" 
                    value={stats.headCount} 
                    color="#3498db"
                />
            </div>

            {/* Table */}
            <div className="table-wrapper">
                <div className="payroll-table-scroll-container">
                {paginatedData.length === 0 ? (
                    <EmptyState />
                ) : (
                    <table className="payroll-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Role</th>
                                <th>Trips</th>
                                <th>Base Pay</th>
                                <th>Deductions</th>
                                <th>Bonus</th>
                                <th>Net Salary</th>
                                <th>Allowance</th>
                                <th>Paid</th>
                                <th>Status</th>
                                <th style={{textAlign: 'center'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row) => (
                                <tr key={row.userID}>
                                    <td className="employee-name">
                                        <span style={{ fontWeight: '700' }}>
                                            {row.firstName} {row.lastName}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`role-badge ${row.role === 'Driver' ? 'role-driver' : 'role-helper'}`}>
                                            {row.role}
                                        </span>
                                    </td>
                                    <td style={{textAlign: 'center'}}>{row.tripCount}</td>
                                    <td className="text-right money-positive">{formatMoney(row.totalBasePay)}</td>
                                    <td className="text-right money-negative">
                                        {row.totalDeductions > 0 ? `-${formatMoney(row.totalDeductions)}` : '-'}
                                    </td>
                                    <td className="text-right money-positive">
                                        {row.totalBonus > 0 ? `+${formatMoney(row.totalBonus)}` : '-'}
                                    </td>
                                    <td className="text-right net-pay-cell" style={{background: '#fcfcfc'}}>
                                        {formatMoney(row.netSalary)}
                                    </td>
                                    <td className="text-right money-neutral">
                                        {formatMoney(row.totalAllowance)}
                                    </td>
                                    <td className="text-right">
                                        {formatMoney(row.totalPaid)}
                                    </td>
                                    <td style={{textAlign:'center'}}>
                                      {/* CASE 1: DEFICIT (Negative Net Salary) */}
                                      {Number(row.netSalary) < 0 ? (
                                          <div className="status-tooltip-wrapper">
                                              <span className="vehicle-badge badge-deficit">
                                                  DEFICIT
                                              </span>
                                              {/* HOVER CONTENT */}
                                              <div className="custom-tooltip">
                                                  Will Carry Over:<br/>
                                                  {formatMoney(Math.abs(row.netSalary))}
                                              </div>
                                          </div>
                                      ) : 

                                      /* CASE 2: BAL. DUE (Overpaid via Cash Advance) */
                                      Number(row.totalPaid) > Number(row.netSalary) ? (
                                          <div className="status-tooltip-wrapper">
                                              <span className="vehicle-badge badge-bal-due">
                                                  BAL. DUE
                                              </span>
                                              {/* HOVER CONTENT */}
                                              <div className="custom-tooltip">
                                                  Overpaid Amount:<br/>
                                                  {formatMoney(row.totalPaid - row.netSalary)}
                                              </div>
                                          </div>
                                      ) : 
                                      
                                      /* CASE 3: CLEARED (Fully Paid) */
                                      Number(row.totalPaid) === Number(row.netSalary) && Number(row.netSalary) > 0 ? (
                                          <span className="vehicle-badge badge-cleared">
                                              CLEARED
                                          </span>
                                      ) : 
                                      
                                      /* CASE 4: NEEDS PAYMENT */
                                      (
                                          <span className="vehicle-badge" style={{background:'#f5f6f7', color:'#7f8c8d'}}>
                                              PENDING
                                          </span>
                                      )}
                                    </td>
                                    <td style={{textAlign: 'center'}}>
                                        <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                                            <button 
                                                className="icon-action-btn" 
                                                onClick={() => setViewingTrips(row)}
                                                title="Trip History"
                                            >
                                                <Icons.Truck size={18} />
                                            </button>
                                            <button 
                                                className="icon-action-btn" 
                                                onClick={() => setSelectedEmployee(row)}
                                                title="Adjustments Ledger"
                                            >
                                                <Icons.Clipboard size={18} />
                                            </button>
                                            {(Number(row.netSalary) > 0 || Number(row.totalPaid) > 0) && (
                                                <button 
                                                    className="icon-action-btn" 
                                                    onClick={() => setPayingEmployee(row)}
                                                    title={isPeriodLocked() ? "View Payments (Period Closed)" : (Number(row.totalPaid) < Number(row.netSalary) ? "Pay Remaining" : "View Payments")}
                                                    style={{color: isPeriodLocked() ? '#2d3436' : '#27ae60'}}
                                                >
                                                    <Icons.Cash size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                </div>
                {/* 2. PAGINATION FOOTER (FIXED AT BOTTOM OF CARD) */}
                <PaginationControls 
                    currentPage={currentPage} 
                    totalItems={payrollData.length} 
                    rowsPerPage={rowsPerPage} 
                    onPageChange={setCurrentPage} 
                />
            </div>
            
            {showRatesManager && (
                <RatesManager onClose={() => setShowRatesManager(false)} />
            )}

            {selectedEmployee && (
                <EmployeeLedger 
                    employee={selectedEmployee} 
                    periodID={selectedPeriod}
                    isLocked={isPeriodLocked()}
                    onClose={() => setSelectedEmployee(null)}
                    onUpdate={() => fetchPayrollSummary(selectedPeriod)} 
                />
            )}

            {payingEmployee && (
                <PaymentModal 
                    employee={payingEmployee}
                    periodID={selectedPeriod}
                    isLocked={isPeriodLocked()}
                    netSalary={payingEmployee.netSalary}
                    onClose={() => setPayingEmployee(null)}
                    onUpdate={() => fetchPayrollSummary(selectedPeriod)}
                />
            )}

            {viewingTrips && (
                <ShipmentHistoryModal 
                    employee={viewingTrips} 
                    periodID={selectedPeriod} 
                    periodName={getPeriodName()}
                    isLocked={isPeriodLocked()}
                    onClose={() => {
                        setViewingTrips(null);
                        fetchPayrollSummary(selectedPeriod);
                    }} 
                />
            )}

          {/* --- EXPORT MODAL --- */}
            {showExportModal && (
                <div className="modal-overlay-desktop">
                    <div className="modal-form-card" onClick={e => e.stopPropagation()} style={{width: '500px'}}>
                        <div className="modal-header">
                            <h2>Export Payroll</h2>
                            <button className="close-btn" onClick={() => setShowExportModal(false)}>×</button>
                        </div>
                        
                        <div className="export-modal-body">
                            
                            {/* --- 1. PERIOD SELECTION --- */}
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                                <label className="export-options-label" style={{marginBottom:0}}>Select Periods (Sheets)</label>
                                <button className="text-link-btn" onClick={handleSelectAllPeriods} style={{fontSize:'11px', color:'#43B2DA', background:'none', border:'none', cursor:'pointer'}}>
                                    {selectedExportPeriods.length === periods.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>

                            <div className="period-multiselect-container">
                                {periods.map(p => (
                                    <label key={p.periodID} className="period-checkbox-item">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedExportPeriods.includes(p.periodID)}
                                            onChange={() => togglePeriod(p.periodID)}
                                        />
                                        <span>{p.periodName}</span>
                                        <span style={{fontSize:'11px', color: p.status === 'OPEN' ? '#27ae60' : '#95a5a6', marginLeft:'auto'}}>
                                            {p.status}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {/* --- 2. COLUMN CONFIG --- */}
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                                <label className="export-options-label" style={{marginBottom:0}}>Customize Columns</label>
                                <button className="text-link-btn" onClick={handleSelectAllColumns} style={{fontSize:'11px', color:'#43B2DA', background:'none', border:'none', cursor:'pointer'}}>
                                    {columnConfig.every(col => col.checked) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="sortable-list">
                                {columnConfig.map((col, index) => (
                                    <div 
                                        key={col.key} 
                                        className="sortable-item"
                                        draggable
                                        onDragStart={(e) => dragStart(e, index)}
                                        onDragEnter={(e) => dragEnter(e, index)}
                                        onDragEnd={dragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <div className="drag-handle" title="Drag to reorder">
                                            <Icons.GripIcon />
                                        </div>
                                        <label>
                                            <input 
                                                type="checkbox" 
                                                checked={col.checked}
                                                onChange={() => {
                                                    const newConfig = [...columnConfig];
                                                    newConfig[index].checked = !newConfig[index].checked;
                                                    setColumnConfig(newConfig);
                                                }}
                                            />
                                            {col.label}
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions" style={{marginTop:'25px'}}>
                                <button className="cancel-btn-secondary" onClick={() => setShowExportModal(false)}>Cancel</button>
                                <button className="submit-btn" onClick={handleExport} style={{flex:1}}>Download .xlsx</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {feedbackModal && <FeedbackModal {...feedbackModal} onClose={() => setFeedbackModal(null)} />}
        </div>
    );
}

const StatCard = ({ label, value, color }) => (
    <div className="stat-card" style={{ '--card-color': color }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
    </div>
);

const EmptyState = () => (
    <div style={{
        textAlign: 'center', padding: '60px', color: '#95a5a6', 
        borderRadius: '10px', border: '1px dashed #dcdcdc'
    }}>
        <h3 style={{margin: '0', fontSize: '16px', color: '#34495e'}}>No Data Available</h3>
        <p style={{fontSize: '13px'}}>Select a period above and click "Generate" to see the suggestion.</p>
    </div>
);

export default PayrollView;
