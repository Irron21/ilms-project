import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Icons } from '../Icons';
import './RatesManager.css'; 
import FeedbackModal from '../FeedbackModal';

function EmployeeLedger({ employee, periodID, onClose, onUpdate }) {
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

    const handleAdd = (e) => {
        e.preventDefault();
        if(!form.amount || !form.reason) return;

        // A. CHECK FOR NEGATIVE BALANCE RISK
        if (form.type === 'DEDUCTION') {
            const deductionAmount = Number(form.amount);
            
            // ✅ FIX: Filter out VOID items from the live calculation
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
                    subMessage: `This creates a NEGATIVE BALANCE of ₱${overage.toLocaleString()}. The employee will owe this amount.`,
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

            setFeedback({
                type: 'success',
                title: 'Adjustment Added',
                confirmLabel: 'OK',
                onClose: () => setFeedback(null)
            });

        } catch (err) { 
            setFeedback({
                type: 'error',
                title: 'Error',
                message: 'Failed to save adjustment.',
                confirmLabel: 'Close',
                onClose: () => setFeedback(null)
            });
        } finally { 
            setLoading(false); 
        }
    };

    // --- DELETE / VOID HANDLERS ---
    const handleDeleteClick = (item) => {
        setFeedback({
            type: 'warning',
            title: 'Void Adjustment?',
            message: `Are you sure you want to void "${item.reason}"?`,
            subMessage: "This will remove the amount from calculations. It cannot be undone.",
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
            setFeedback({
                type: 'success',
                title: 'Voided',
                message: 'Entry voided successfully.',
                confirmLabel: 'OK',
                onClose: () => setFeedback(null)
            });
        } catch (err) {
            setFeedback({ 
                type: 'error', 
                title: 'Error', 
                message: 'Could not void entry.', 
                confirmLabel: 'Close',
                onClose: () => setFeedback(null) 
            });
        }
    };

    // Helper to calculate totals excluding voided items
    const calculateTotal = (type) => {
        return items
            .filter(i => i.type === type && i.status !== 'VOID') // <--- CRITICAL CHECK
            .reduce((a, b) => a + Number(b.amount), 0);
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-card rates-modal" style={{height: '600px'}}> 
                
                {/* HEADER */}
                <div className="rates-header">
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                        <div style={{width:'40px', height:'40px', borderRadius:'50%', background:'#f0f2f5', display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <Icons.Profile size={20} color="#555"/>
                        </div>
                        <div style={{display: 'flex', alignItems: 'flex-start', flexDirection: 'column'}}>
                            <h2 style={{margin:0, fontSize:'18px'}}>{employee.firstName} {employee.lastName}</h2>
                            <p style={{margin:0, fontSize:'12px', color:'#888'}}>Adjustments & Bonuses Ledger</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer'}}><Icons.X size={20}/></button>
                </div>

                {/* BODY CONTAINER */}
                <div className="rates-body">
                    
                    {/* FORM */}
                    <form onSubmit={handleAdd} className="rates-form">
                        <div className="form-group-mini" style={{width: '130px'}}>
                            <label>Type</label>
                            <select className="form-input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                                <option value="DEDUCTION">Deduction</option>
                                <option value="BONUS">Bonus</option>
                            </select>
                        </div>
                        <div className="form-group-mini" style={{width: '120px'}}>
                            <label>Amount</label>
                            <input className="form-input text-right" placeholder="0.00" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}/>
                        </div>
                        <div className="form-group-mini" style={{flex: 1}}>
                            <label>Reason</label>
                            <input className="form-input" placeholder="e.g. Cash Advance, Late Penalty" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}/>
                        </div>
                        <div className="form-group-mini">
                            <label>&nbsp;</label>
                            <button type="submit" className="btn-add-rate" disabled={loading}>
                                {loading ? '...' : <><Icons.Plus size={18} /></>}
                            </button>
                        </div>
                    </form>

                    {/* LIST TABLE */}
                    <div className="rates-table-container">
                        <table className="payroll-table">
                            <thead>
                                <tr>
                                    <th style={{paddingLeft:'25px', width:'20%'}}>Date</th>
                                    <th style={{width:'50%'}}>Reason</th>
                                    <th className="text-right" style={{width:'20%'}}>Amount</th>
                                    <th style={{textAlign:'center', width:'10%'}}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr><td colSpan="4" style={{textAlign:'center', padding:'40px', color:'#ccc'}}>No adjustments recorded for this period.</td></tr>
                                ) : (
                                    items.map(item => {
                                        // ✅ CHECK VOID STATUS
                                        const isVoid = item.status === 'VOID';
                                        
                                        return (
                                            <tr key={item.adjustmentID} style={{ opacity: isVoid ? 0.6 : 1, background: isVoid ? '#f9f9f9' : 'transparent' }}>
                                                <td style={{paddingLeft:'25px', fontSize:'13px', color:'#888'}}>
                                                    {new Date(item.created_at).toLocaleDateString()}
                                                    {/* VOID BADGE */}
                                                    {isVoid && <span style={{marginLeft:'8px', fontSize:'9px', fontWeight:'700', color:'#e74c3c', border:'1px solid #e74c3c', padding:'1px 4px', borderRadius:'3px'}}>VOID</span>}
                                                </td>
                                                <td style={{fontWeight:'500', display:'flex', alignItems:'center', gap:'10px', textDecoration: isVoid ? 'line-through' : 'none'}}>
                                                    {item.reason}
                                                </td>
                                                <td className={`text-right ${item.type === 'BONUS' ? 'money-positive' : 'money-negative'}`} style={{textDecoration: isVoid ? 'line-through' : 'none'}}>
                                                    {item.type === 'DEDUCTION' ? '-' : '+'}{Number(item.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}
                                                </td>
                                                <td style={{textAlign:'center'}}>
                                                    {/* Hide delete button if already void */}
                                                    {!isVoid && (
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

                {/* FOOTER SUMMARY */}
                <div style={{padding:'15px 25px', borderTop:'1px solid #eee', background:'#f8f9fa', display:'flex', justifyContent:'space-between', fontSize:'13px', borderRadius:'0 0 12px 12px'}}>
                    <span><strong>Total Deductions:</strong> <span style={{color:'#e74c3c'}}>{Number(calculateTotal('DEDUCTION')).toLocaleString('en-PH', {style:'currency', currency:'PHP'})}</span></span>
                    <span><strong>Total Bonuses:</strong> <span style={{color:'#27ae60'}}>{Number(calculateTotal('BONUS')).toLocaleString('en-PH', {style:'currency', currency:'PHP'})}</span></span>
                </div>
            </div>
            {feedback && (
                <FeedbackModal 
                    type={feedback.type}
                    title={feedback.title}
                    message={feedback.message}
                    subMessage={feedback.subMessage}
                    confirmLabel={feedback.confirmLabel}
                    onConfirm={feedback.onConfirm}
                    onClose={feedback.onClose}
                />
            )}
        </div>
    );
}

export default EmployeeLedger;