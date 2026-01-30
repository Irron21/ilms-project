import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Icons } from '../Icons';
import './PaymentModal.css'; // ✅ IMPORT THE NEW CSS
import FeedbackModal from '../FeedbackModal';

function PaymentModal({ employee, periodID, netSalary, onClose, onUpdate }) {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);

    // Calculate Balance
    const totalPaid = history.filter(item => item.status !== 'VOID').reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = netSalary - totalPaid;

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await api.get(`/payments/${periodID}/${employee.userID}`);
            setHistory(res.data);
        } catch (err) { console.error(err); }
    };

    const handlePayClick = (e) => {
        e.preventDefault();
        const payAmount = Number(amount);
        
        if (!payAmount || payAmount <= 0) return;

        if (payAmount > balance) {
            const overage = payAmount - balance;
            setFeedback({
                type: 'warning',
                title: 'Overpayment Warning',
                message: `You are paying ₱${payAmount.toLocaleString()}, but the remaining balance is only ₱${balance.toLocaleString()}.`,
                subMessage: `This will result in an Overpayment (Negative Balance) of ₱${overage.toLocaleString()}.`,
                confirmLabel: 'Pay Anyway',
                onClose: () => setFeedback(null),
                onConfirm: () => executePay() 
            });
            return;
        }
        executePay();
    };

    const executePay = async () => {
        setLoading(true);
        setFeedback(null); 
        try {
            await api.post('/payments', { periodID, userID: employee.userID, amount: amount, notes: notes || 'Partial Payment' });
            setAmount('');
            setNotes('');
            await fetchHistory();
            onUpdate(); 
            setFeedback({ type: 'success', title: 'Payment Recorded', confirmLabel: 'Done', onClose: () => setFeedback(null) });
        } catch (err) { 
            setFeedback({ type: 'error', title: 'Payment Failed', message: 'Could not record the payment.', onClose: () => setFeedback(null) });
        } finally { setLoading(false); }
    };

    const handleVoidClick = (payment) => {
        setFeedback({
            type: 'warning',
            title: 'Void Payment?',
            message: `Void payment of ₱${Number(payment.amount).toLocaleString()}?`,
            subMessage: "This action cannot be undone.",
            confirmLabel: "Void Payment",
            onClose: () => setFeedback(null),
            onConfirm: () => confirmVoid(payment.paymentID) 
        });
    };

    const confirmVoid = async (id) => {
        try {
            await api.delete(`/payments/${id}`);
            await fetchHistory();
            onUpdate(); 
            setFeedback({ type: 'success', title: 'Payment Voided', confirmLabel: 'OK', onClose: () => setFeedback(null) });
        } catch (err) { setFeedback({ type: 'error', title: 'Error', onClose: () => setFeedback(null) }); }
    };

    return (
        <div className="modal-backdrop">
            <div className="payment-modal-card">
                
                {/* 1. HEADER */}
                <div className="payment-header">
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                        <div style={{width:'48px', height:'48px', borderRadius:'50%', background:'#cff1ddff', display:'flex', alignItems:'center', justifyContent:'center', color:'#1cca62ff'}}>
                            <Icons.Cash size={24} />
                        </div>
                        <div>
                            <h2 style={{margin:0, fontSize:'20px', color:'#2d3436'}}>Payout: {employee.firstName} {employee.lastName}</h2>
                            <p style={{margin:0, fontSize:'13px', color:'#636e72'}}>Record payments & track balance</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:'8px'}}><Icons.X size={24} color="#b2bec3"/></button>
                </div>

                {/* 2. BODY */}
                <div className="payment-body">
                    
                    {/* STATS ROW (Centered) */}
                    <div className="payment-stats-row">
                        {/* Net Payable */}
                        <div className="stat-box neutral">
                            <span className="stat-label">Net Payable</span>
                            <div className="stat-value" style={{color:'#2c3e50'}}>₱{Number(netSalary).toLocaleString()}</div>
                        </div>

                        {/* Balance (Color Coded) */}
                        <div className={`stat-box ${balance <= 0 ? 'balance-cleared' : 'balance-pending'}`}>
                            <span className="stat-label">Remaining Balance</span>
                            <div className="stat-value">₱{Number(balance).toLocaleString()}</div>
                            {balance <= 0 && <div style={{fontSize:'12px', fontWeight:'700', marginTop:'5px', display:'flex', alignItems:'center', gap:'5px'}}><Icons.CheckCircle size={14}/> PAID</div>}
                        </div>
                    </div>

                    {/* FORM ROW (Horizontal & Stretched) */}
                    {balance > 0 ? (
                        <div className="payment-form-container">
                            <span className="form-label-small">Record New Payment</span>
                            <form onSubmit={handlePayClick} className="payment-form">
                                
                                {/* Amount */}
                                <div className="payment-input-wrapper">
                                    <span className="currency-symbol">₱</span>
                                    <input 
                                        className="payment-input amount" 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                {/* Notes (Flex Grow) */}
                                <input 
                                    className="payment-input notes" 
                                    placeholder="Notes (e.g. Cash, GCash Ref#)" 
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />

                                {/* Button */}
                                <button className="btn-pay-action" type="submit" disabled={loading}>
                                    {loading ? 'Processing...' : 'Pay Now'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div style={{textAlign:'center', padding:'20px', background:'#f8f9fa', color:'#7f8c8d', borderRadius:'12px', fontSize:'14px', border:'1px dashed #dcdde1'}}>
                            This employee is fully paid. Use the <b>Adjustments Ledger</b> for advances.
                        </div>
                    )}

                    {/* HISTORY TABLE */}
                    <div className="history-section">
                        <h4>Payment History</h4>
                        <div className="history-box">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Notes</th>
                                        <th>Amount</th>
                                        <th></th> 
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(pay => {
                                        const isVoid = pay.status === 'VOID';
                                        return (
                                            <tr key={pay.paymentID} style={{ opacity: isVoid ? 0.6 : 1, background: isVoid ? '#fcfcfc' : 'white' }}>
                                                <td style={{color:'#636e72'}}>
                                                    {new Date(pay.paymentDate).toLocaleDateString()}
                                                    {isVoid && <span style={{marginLeft:'8px', fontSize:'10px', fontWeight:'700', color:'#c0392b', background:'#fadbd8', padding:'2px 6px', borderRadius:'4px'}}>VOID</span>}
                                                </td>
                                                <td style={{fontWeight:'500', textDecoration: isVoid ? 'line-through' : 'none'}}>
                                                    {pay.notes}
                                                </td>
                                                <td style={{color: isVoid ? '#b2bec3' : '#27ae60', textDecoration: isVoid ? 'line-through' : 'none'}}>
                                                    -₱{Number(pay.amount).toLocaleString()}
                                                </td>
                                                <td>
                                                    {!isVoid && (
                                                        <button 
                                                            onClick={() => handleVoidClick(pay)} 
                                                            className="action-btn"
                                                            title="Void Transaction"
                                                        >
                                                            <Icons.Trash size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {history.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', padding:'30px', color:'#b2bec3'}}>No payments yet.</td></tr>}
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

export default PaymentModal;