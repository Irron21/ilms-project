import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './PayrollView.css'; 
import RatesManager from './RatesManager';
import { Icons } from '../Icons'; 
import EmployeeLedger from './EmployeeLedger';
import PaymentModal from './PaymentModal';

function PayrollView() {
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [payrollData, setPayrollData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ totalSalary: 0, totalAllowance: 0, headCount: 0 });
    const [showRatesManager, setShowRatesManager] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [payingEmployee, setPayingEmployee] = useState(null);

    // 1. Load Periods
    useEffect(() => {
        api.get('/payroll/periods')
           .then(res => {
               setPeriods(res.data);
               // Auto-select latest OPEN period
               const openPeriod = res.data.find(p => p.status === 'OPEN');
               if (openPeriod) {
                   setSelectedPeriod(openPeriod.periodID);
                   // Optionally fetch immediately on load:
                   // fetchPayrollSummary(openPeriod.periodID); 
               }
           })
           .catch(err => console.error(err));
    }, []);

    // 2. Fetch Data when Period Changes
    useEffect(() => {
        if (selectedPeriod) fetchPayrollSummary(selectedPeriod);
    }, [selectedPeriod]);

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
        if (!selectedPeriod) return;
        
        setLoading(true);

        await new Promise(resolve => setTimeout(resolve, 600));

        try {
            const res = await api.post('/payroll/generate', { periodID: selectedPeriod });
            fetchPayrollSummary(selectedPeriod); 
        } catch (error) {
            alert("Failed to generate payroll.");
        }
    };

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
    };

    return (
        <div className="payroll-container">
            {/* 1. Header (Minimal & Functional) */}
            <div className="payroll-header">                              
                <div className="payroll-controls">
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>Select Period:</label>
                    <select 
                        className="period-select" 
                        style={{ minWidth: '200px' }} // Only control width here
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                    >
                        {periods.map(p => (
                            <option key={p.periodID} value={p.periodID}>
                                {p.periodName} ({p.status})
                            </option>
                        ))}
                    </select>
                  </div>
                    <button 
                      className="btn-generate" 
                      onClick={handleGenerate} 
                      disabled={!selectedPeriod || loading}
                      title="Harvest & Refresh"
                  >
                      <Icons.Refresh 
                          size={18} 
                          className={loading ? "icon-spin" : ""} 
                      />
                  </button>
                </div>
                <button 
                className="manage-rates-button" 
                onClick={() => setShowRatesManager(true)}
                >
                  <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                    <Icons.Settings size={14} />
                    Manage Rates
                  </div>
                </button>
            </div>

            {/* 2. Stats Dashboard */}
            <div className="stats-row">
                <StatCard 
                    label="Estimated Salary Payout" 
                    value={formatMoney(stats.totalSalary)} 
                    color="#27ae60" // Green
                />
                <StatCard 
                    label="Total Allowance (Cash)" 
                    value={formatMoney(stats.totalAllowance)} 
                    color="#f39c12" // Orange
                />
                <StatCard 
                    label="Active Employees" 
                    value={stats.headCount} 
                    color="#3498db" // Blue
                />
            </div>

            {/* 3. The Table */}
            <div className="table-wrapper">
                {payrollData.length === 0 ? (
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
                            </tr>
                        </thead>
                        <tbody>
                            {payrollData.map((row) => (
                                <tr key={row.userID} onClick={() => setSelectedEmployee(row)} style={{cursor: 'pointer'}}>
                                    <td className="employee-name">{row.firstName} {row.lastName}</td>
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
                                      {/* CASE 1: OVERPAID (Paid > Net) - Employee owes company */}
                                      {Number(row.totalPaid) > Number(row.netSalary) ? (
                                          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                              <span className="vehicle-badge" style={{background:'#fff3cd', color:'#856404', border:'1px solid #ffeeba'}}>
                                                  OVERPAID
                                              </span>
                                              <span style={{fontSize:'10px', color:'#e74c3c', fontWeight:'700', marginTop:'2px'}}>
                                                  (Owes {formatMoney(row.totalPaid - row.netSalary)})
                                              </span>
                                          </div>
                                      ) : 
                                      
                                      /* CASE 2: FULLY PAID (Paid == Net) */
                                      Number(row.totalPaid) === Number(row.netSalary) && Number(row.netSalary) > 0 ? (
                                          <span className="vehicle-badge" style={{background:'#e9f7ef', color:'#27ae60'}}>
                                              PAID
                                          </span>
                                      ) : 
                                      
                                      /* CASE 3: BALANCE REMAINING (Paid < Net) */
                                      (
                                          <button 
                                              className="action-btn" 
                                              style={{
                                                  background:'#eaf6fa', color:'#3498db', padding:'4px 10px', 
                                                  borderRadius:'15px', fontSize:'11px', fontWeight:'700', width:'auto',
                                                  whiteSpace: 'nowrap', border: '1px solid #2191dcff'
                                              }}
                                              onClick={(e) => { e.stopPropagation(); setPayingEmployee(row); }}
                                          >
                                              PAY BAL
                                          </button>
                                      )}
</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showRatesManager && (
                <RatesManager onClose={() => setShowRatesManager(false)} />
            )}

            {selectedEmployee && (
                <EmployeeLedger 
                    employee={selectedEmployee} 
                    periodID={selectedPeriod}
                    onClose={() => setSelectedEmployee(null)}
                    onUpdate={() => fetchPayrollSummary(selectedPeriod)} // Refresh main numbers when they close ledger
                />
            )}

            {payingEmployee && (
                <PaymentModal 
                    employee={payingEmployee}
                    periodID={selectedPeriod}
                    netSalary={payingEmployee.netSalary}
                    onClose={() => setPayingEmployee(null)}
                    onUpdate={() => fetchPayrollSummary(selectedPeriod)}
                />
            )}
        </div>
    );
}

// Sub-components for cleaner code
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