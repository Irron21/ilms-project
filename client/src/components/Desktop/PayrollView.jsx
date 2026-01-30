import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './PayrollView.css'; 
import RatesManager from './RatesManager';
import { Icons } from '../Icons'; 
import FeedbackModal from '../FeedbackModal';

function PayrollView() {
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [payrollData, setPayrollData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ totalSalary: 0, totalAllowance: 0, headCount: 0 });
    const [showRatesManager, setShowRatesManager] = useState(false);

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
                            </tr>
                        </thead>
                        <tbody>
                            {payrollData.map((row) => (
                                <tr key={row.userID}>
                                    <td className="employee-name">{row.firstName} {row.lastName}</td>
                                    <td>
                                        <span className={`role-badge ${row.role === 'Driver' ? 'role-driver' : 'role-helper'}`}>
                                            {row.role}
                                        </span>
                                    </td>
                                    <td style={{textAlign: 'center'}}>{row.tripCount}</td>
                                    <td className="text-right money-positive">{formatMoney(row.totalBasePay)}</td>
                                    <td className="text-right money-negative">
                                        {row.totalDeductions > 0 ? `(${formatMoney(row.totalDeductions)})` : '-'}
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showRatesManager && (
                <RatesManager onClose={() => setShowRatesManager(false)} />
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