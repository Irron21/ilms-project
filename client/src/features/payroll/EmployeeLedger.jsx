import { useState, useEffect } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal } from '@shared';

function EmployeeLedger({ employee, periodID, isLocked, onClose, onUpdate }) {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({ type: 'DEDUCTION', amount: '', reason: '' });
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        fetchLedger();
    }, []);

    const fetchLedger = async () => {
        try {
            const res = await api.get(`/adjustments/${periodID}/${employee.userID}`);
            setItems(res.data);
        } catch (err) { console.error(err); }
    };

    // --- CALCULATIONS ---
    const calculateTotal = (type) => {
        return items
            .filter(i => i.type === type && i.status !== 'VOID') 
            .reduce((a, b) => a + Number(b.amount), 0);
    };

    const totalDeductions = calculateTotal('DEDUCTION');
    const totalBonuses = calculateTotal('BONUS');

    // --- HANDLERS ---
    const handleAdd = (e) => {
        e.preventDefault();
        if(!form.amount || !form.reason) return;

        if (form.type === 'DEDUCTION') {
            const deductionAmount = Number(form.amount);
            const validItems = items.filter(i => i.status !== 'VOID');
            const currentBonuses = validItems.filter(i => i.type === 'BONUS').reduce((sum, i) => sum + Number(i.amount), 0);
            const currentDeductions = validItems.filter(i => i.type === 'DEDUCTION').reduce((sum, i) => sum + Number(i.amount), 0);
            
            const basePay = Number(employee.totalBasePay || 0); 
            const liveNetSalary = (basePay + currentBonuses) - currentDeductions;
            const projectedNetSalary = liveNetSalary - deductionAmount;
            const amountPaidSoFar = Number(employee.totalPaid || 0);

            if (amountPaidSoFar > projectedNetSalary) {
                const overage = amountPaidSoFar - projectedNetSalary;
                setFeedback({
                    type: 'warning',
                    title: 'Overpayment Risk',
                    message: `This deduction drops Net Salary to ₱${projectedNetSalary.toLocaleString()}, but you already paid ₱${amountPaidSoFar.toLocaleString()}.`,
                    subMessage: `This creates a NEGATIVE BALANCE of ₱${overage.toLocaleString()}.`,
                    confirmLabel: 'Proceed Anyway',
                    onClose: () => setFeedback(null),
                    onConfirm: () => executeAdd()
                });
                return; 
            }
        }
        executeAdd();
    };

    const executeAdd = async () => {
        setLoading(true);
        setFeedback(null); 
        try {
            await api.post('/adjustments', { ...form, userID: employee.userID, periodID });
            setForm({ type: 'DEDUCTION', amount: '', reason: '' }); 
            fetchLedger(); 
            onUpdate();
            setFeedback({ type: 'success', title: 'Adjustment Added', confirmLabel: 'OK', onClose: () => setFeedback(null) });
        } catch (err) { 
            setFeedback({ type: 'error', title: 'Error', message: 'Failed to save adjustment.', onClose: () => setFeedback(null) });
        } finally { setLoading(false); }
    };

    const handleDeleteClick = (item) => {
        setFeedback({
            type: 'warning',
            title: 'Void Adjustment?',
            message: `Void "${item.reason}"?`,
            subMessage: "This will remove the amount from calculations.",
            confirmLabel: "Void It",
            onClose: () => setFeedback(null),
            onConfirm: () => confirmDelete(item.adjustmentID)
        });
    };

    const confirmDelete = async (id) => {
        try {
            await api.delete(`/adjustments/${id}`);
            fetchLedger();
            onUpdate();
            setFeedback({ type: 'success', title: 'Voided', confirmLabel: 'OK', onClose: () => setFeedback(null) });
        } catch (err) { setFeedback({ type: 'error', title: 'Error', onClose: () => setFeedback(null) }); }
    };

    return (
        <div className="modal-backdrop">
            <div className="payment-modal-card" style={{width: '850px'}}> 
                <div className="payment-header">
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                        <div style={{width:'48px', height:'48px', borderRadius:'50%', background:'#cff1ddff', display:'flex', alignItems:'center', justifyContent:'center', color:'#1cca62ff'}}>
                            <Icons.Cash size={24} />
                        </div>
                        <div>
                            <h2 style={{margin:0, fontSize:'20px', color:'#2d3436'}}>{employee.firstName} {employee.lastName}</h2>
                            <p style={{margin:0, fontSize:'13px', color:'#636e72'}}>Adjustments & Bonuses Ledger</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:'8px'}}><Icons.X size={24} color="#b2bec3"/></button>
                </div>
                <div className="payment-body">
                                  
                    {/* STATS ROW */}
                    <div className="payment-stats-row">
                        <div className="stat-box neutral">
                            <span className="stat-label">Total Bonuses</span>
                            <div className="stat-value" style={{color:'#27ae60'}}>₱{totalBonuses.toLocaleString()}</div>
                        </div>
                        <div className="stat-box neutral">
                            <span className="stat-label">Total Deductions</span>
                            <div className="stat-value" style={{color:'#e74c3c'}}>₱{totalDeductions.toLocaleString()}</div>
                        </div>
                        <div className="stat-box neutral" style={{background: '#fff8e1', border: '1px solid #ffe0b2', color: '#e67e22'}}>
                            <span className="stat-label">Net Adjustment</span>
                            <div className="stat-value" style={{color: (totalBonuses - totalDeductions) >= 0 ? '#27ae60' : '#e74c3c'}}>
                                ₱{(totalBonuses - totalDeductions).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* FORM ROW */}
                    <div className="payment-form-container">
                        <span className="form-label-small">Add New Entry</span>
                        {!isLocked && (
                        <form onSubmit={handleAdd} className="payment-form">
                            
                            {/* Type Select */}
                            <select 
                                className="payment-input" 
                                style={{width:'120px', cursor:'pointer'}}
                                value={form.type} 
                                onChange={e => setForm({...form, type: e.target.value})}
                            >
                                <option value="DEDUCTION">Deduction</option>
                                <option value="BONUS">Bonus</option>
                            </select>

                            {/* Amount Input */}
                            <div className="payment-input-wrapper">
                                <span className="currency-symbol">₱</span>
                                <input 
                                    className="payment-input amount" 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={form.amount} 
                                    onChange={e => setForm({...form, amount: e.target.value})}
                                />
                            </div>

                            {/* Reason Input */}
                            <input 
                                className="payment-input notes" 
                                placeholder="Reason (e.g. Advance)" 
                                value={form.reason} 
                                onChange={e => setForm({...form, reason: e.target.value})}
                            />

                            {/* Button */}
                            <button type="submit" className="btn-pay-action" disabled={loading}>
                                {loading ? '...' : 'Add Entry'}
                            </button>
                        </form>
                        )}
                    
                    {isLocked && (
                        <div style={{padding:'10px', background:'#f1f2f6', marginBottom:'15px', borderRadius:'6px', textAlign:'center', fontSize:'12px', color:'#7f8c8d'}}>
                            This period is closed. Adjustments are read-only.
                        </div>
                    )}
                    </div>

                    {/* TABLE SECTION */}
                    <div className="history-section">
                        <h4>Ledger History</h4>
                        <div className="history-box">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Reason</th>
                                        <th>Amount</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr><td colSpan="4" style={{textAlign:'center', padding:'30px', color:'#b2bec3'}}>No adjustments recorded.</td></tr>
                                    ) : (
                                        items.map(item => {
                                            const isVoid = item.status === 'VOID';
                                            return (
                                                <tr key={item.adjustmentID} style={{ opacity: isVoid ? 0.6 : 1, background: isVoid ? '#fcfcfc' : 'white' }}>
                                                    <td style={{color:'#636e72'}}>
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                        {isVoid && <span style={{marginLeft:'8px', fontSize:'10px', fontWeight:'700', color:'#c0392b', background:'#fadbd8', padding:'2px 6px', borderRadius:'4px'}}>VOID</span>}
                                                    </td>
                                                    <td style={{fontWeight:'500', display:'flex', alignItems:'center', gap:'8px', textDecoration: isVoid ? 'line-through' : 'none'}}>
                                                        {item.reason}
                                                    </td>
                                                    <td style={{color: isVoid ? '#b2bec3' : (item.type === 'BONUS' ? '#27ae60' : '#c0392b'), textDecoration: isVoid ? 'line-through' : 'none', textAlign:'right'}}>
                                                        {item.type === 'DEDUCTION' ? '-' : '+'}₱{Number(item.amount).toLocaleString()}
                                                    </td>
                                                    <td>
                                                        {!isLocked && item.status !== 'VOID' && (
                                                            <button onClick={() => handleDeleteClick(item)} className="action-btn">
                                                                <Icons.Trash size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
            {feedback && <FeedbackModal {...feedback} />}
        </div>
    );
}

export default EmployeeLedger;