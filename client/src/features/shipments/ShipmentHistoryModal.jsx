import { useState, useEffect } from 'react';
import api from '@utils/api';
import { Icons, FeedbackModal } from '@shared'; 

function ShipmentHistoryModal({ employee, periodID, periodName, isLocked, onClose }) {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState(null);
    const [adjustingTrip, setAdjustingTrip] = useState(null);
    const [shipmentAdjustments, setShipmentAdjustments] = useState([]);
    const [loadingAdjustments, setLoadingAdjustments] = useState(false);
    const [adjAmount, setAdjAmount] = useState('');
    const [adjReason, setAdjReason] = useState('');
    const [adjType, setAdjType] = useState('BONUS');

    const fetchTrips = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/trips/${periodID}/${employee.userID}`);
            setTrips(res.data);
        } catch (err) {
            console.error("Failed to load trips", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchShipmentAdjustments = async (shipmentID) => {
        setLoadingAdjustments(true);
        try {
            const res = await api.get(`/payroll/shipment-adjustments/${shipmentID}/${employee.userID}`);
            setShipmentAdjustments(res.data);
        } catch (err) {
            console.error("Failed to load shipment adjustments", err);
        } finally {
            setLoadingAdjustments(false);
        }
    };

    useEffect(() => {
        fetchTrips();
    }, [periodID, employee.userID]);

    const handleAdjustClick = (trip) => {
        setAdjustingTrip(trip);
        setAdjAmount('');
        setAdjType('BONUS');
        setAdjReason('');
        fetchShipmentAdjustments(trip.shipmentID);
    };

    const saveAdjustment = async () => {
        if (!adjustingTrip) return;
        
        // Validation
        if (!adjAmount || isNaN(adjAmount) || Number(adjAmount) <= 0) {
            setFeedback({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid positive numeric amount.', onClose: () => setFeedback(null) });
            return;
        }
        if (!adjReason || adjReason.trim().length < 3) {
            setFeedback({ type: 'error', title: 'Reason Required', message: 'Please provide a descriptive reason (min 3 characters).', onClose: () => setFeedback(null) });
            return;
        }

        try {
            await api.post('/payroll/shipment-adjustment', {
                shipmentID: adjustingTrip.shipmentID,
                crewID: employee.userID,
                amount: Number(adjAmount),
                type: adjType,
                reason: adjReason.trim()
            });
            setAdjAmount('');
            setAdjReason('');
            fetchShipmentAdjustments(adjustingTrip.shipmentID);
            fetchTrips();
        } catch (err) {
            setFeedback({ type: 'error', title: 'Save Failed', message: 'Could not add adjustment.', onClose: () => setFeedback(null) });
        }
    };

    const deleteAdjustment = async (adjID) => {
        try {
            await api.delete(`/payroll/shipment-adjustment/${adjID}`);
            fetchShipmentAdjustments(adjustingTrip.shipmentID);
            fetchTrips();
        } catch (err) {
            setFeedback({ type: 'error', title: 'Delete Failed', message: 'Could not remove adjustment.', onClose: () => setFeedback(null) });
        }
    };

    const totalBaseFee = trips.reduce((sum, t) => sum + Number(t.baseFee), 0);
    const totalAllowance = trips.reduce((sum, t) => sum + Number(t.allowance), 0);
    const totalAdjustments = trips.reduce((sum, t) => sum + Number(t.adjustmentAmount || 0), 0);
    const totalEarnings = totalBaseFee + totalAllowance + totalAdjustments;

    return (
        <div className="modal-backdrop">
            <div className="payment-modal-card" style={{width: '950px'}}> 

                <div className="payment-header">
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                        <div style={{width:'48px', height:'48px', borderRadius:'50%', background:'#fff3e0', display:'flex', alignItems:'center', justifyContent:'center', color:'#f39c12'}}>
                            <Icons.Truck size={24} />
                        </div>
                        <div>
                            <h2 style={{margin:0, fontSize:'20px', color:'#2d3436'}}>Trip History: {employee.firstName} {employee.lastName}</h2>
                            <p style={{margin:0, fontSize:'13px', color:'#636e72'}}>Completed shipments for <b>{periodName || 'this period'}</b></p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:'8px'}}><Icons.X size={24} color="#b2bec3"/></button>
                </div>

                <div className="payment-body">
                    <div className="payment-stats-row">
                        <div className="stat-box neutral">
                            <span className="stat-label">Total Trips</span>
                            <div className="stat-value">{trips.length}</div>
                        </div>
                        <div className="stat-box neutral">
                            <span className="stat-label">Total Base Pay</span>
                            <div className="stat-value" style={{color:'#27ae60'}}>₱{totalBaseFee.toLocaleString()}</div>
                        </div>
                        <div className="stat-box neutral">
                            <span className="stat-label">Total Allowance</span>
                            <div className="stat-value" style={{color:'#f39c12'}}>₱{totalAllowance.toLocaleString()}</div>
                        </div>
                        <div className="stat-box neutral">
                            <span className="stat-label">Shipment Adj.</span>
                            <div className="stat-value" style={{color: totalAdjustments >= 0 ? '#27ae60' : '#e74c3c'}}>
                                {totalAdjustments >= 0 ? '+' : ''}₱{totalAdjustments.toLocaleString()}
                            </div>
                        </div>
                        <div className="stat-box balance-cleared">
                            <span className="stat-label">Total Earnings</span>
                            <div className="stat-value">₱{totalEarnings.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="history-section">
                        <h4>Shipment Log</h4>
                        <div className="history-box">
                            <table className="shipment-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Route / Cluster</th>
                                        <th>Vehicle</th>
                                        <th className="text-right">Base Fee</th>
                                        <th className="text-right">Allowance</th>
                                        <th className="text-right">Adjustment</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="7" style={{textAlign:'center', padding:'30px'}}>Loading trips...</td></tr>
                                    ) : trips.length === 0 ? (
                                        <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color:'#b2bec3'}}>No trips found.</td></tr>
                                    ) : (
                                        trips.map(trip => (
                                            <tr key={trip.shipmentID}>
                                                <td style={{color:'#636e72'}}>
                                                    {new Date(trip.shipmentDate).toLocaleDateString()}
                                                </td>
                                                <td style={{fontWeight:'600', color:'#2d3436'}}>
                                                    {trip.routeCluster}
                                                </td>
                                                <td>
                                                    <span className="vehicle-badge">{trip.vehicleType}</span>
                                                </td>
                                                <td className="text-right" style={{color:'#27ae60', whiteSpace:'nowrap'}}>
                                                    +₱{Number(trip.baseFee).toLocaleString()}
                                                </td>
                                                <td className="text-right" style={{color:'#f39c12'}}>
                                                    +₱{Number(trip.allowance).toLocaleString()}
                                                </td>
                                                <td className="text-right">
                                                    {Number(trip.adjustmentAmount) !== 0 ? (
                                                        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                                                            <span style={{color: Number(trip.adjustmentAmount) > 0 ? '#27ae60' : '#e74c3c', fontWeight:'600'}}>
                                                                {Number(trip.adjustmentAmount) > 0 ? '+' : ''}₱{Number(trip.adjustmentAmount).toLocaleString()}
                                                            </span>
                                                            <span style={{fontSize:'10px', color:'#95a5a6', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={trip.adjustmentReason}>{trip.adjustmentReason}</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{color:'#bdc3c7'}}>-</span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <button 
                                                        onClick={() => handleAdjustClick(trip)}
                                                        className="icon-action-btn"
                                                        title={isLocked ? "View Adjustments (Period Closed)" : "Modify Adjustment"}
                                                        style={isLocked ? { color: '#2d3436' } : undefined}
                                                    >
                                                        <Icons.Edit size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Redesigned Adjustment Form Overlay (Consistent with EmployeeLedger) */}
                {adjustingTrip && (
                    <div className="modal-backdrop" style={{zIndex: 100}}>
                        <div className="payment-modal-card" style={{width: '850px'}} onClick={e => e.stopPropagation()}>
                            
                            <div className="payment-header">
                                <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                                    <div style={{
                                        width:'48px',
                                        height:'48px',
                                        borderRadius:'50%',
                                        background: isLocked ? '#ecf0f1' : '#cff1ddff',
                                        display:'flex',
                                        alignItems:'center',
                                        justifyContent:'center',
                                        color: isLocked ? '#2d3436' : '#1cca62ff'
                                    }}>
                                        <Icons.Cash size={24} />
                                    </div>
                                    <div>
                                        <h2 style={{margin:0, fontSize:'20px', color:'#2d3436'}}>Shipment #{adjustingTrip.shipmentID}</h2>
                                        <p style={{margin:0, fontSize:'13px', color:'#636e72'}}>Shipment Adjustments Ledger</p>
                                    </div>
                                </div>
                                <button onClick={() => setAdjustingTrip(null)} style={{background:'none', border:'none', cursor:'pointer', padding:'8px'}}><Icons.X size={24} color="#b2bec3"/></button>
                            </div>

                            <div className="payment-body">
                                {/* FORM ROW */}
                                {isLocked ? (
                                    <div className="locked-state-message" style={{padding:'20px', background:'#f8f9fa', borderRadius:'8px', textAlign:'center', color:'#7f8c8d', marginBottom:'15px'}}>
                                        <Icons.Lock size={20} style={{display:'block', margin:'0 auto 10px'}}/>
                                        <strong>Period Closed</strong>
                                        <p style={{fontSize:'12px', margin:'5px 0'}}>Shipment adjustments are read-only.</p>
                                    </div>
                                ) : (
                                    <div className="payment-form-container">
                                        <span className="form-label-small">Add New Entry</span>
                                        <div className="payment-form">
                                            {/* Type Select */}
                                            <select 
                                                className="payment-input" 
                                                style={{width:'120px', cursor:'pointer'}}
                                                value={adjType} 
                                                onChange={e => setAdjType(e.target.value)}
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
                                                    value={adjAmount} 
                                                    onChange={e => setAdjAmount(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Reason Input */}
                                            <input 
                                                className="payment-input notes" 
                                                placeholder="Reason (e.g. Damages)" 
                                                value={adjReason} 
                                                onChange={e => setAdjReason(e.target.value)}
                                            />

                                            {/* Button */}
                                            <button onClick={saveAdjustment} className="btn-pay-action">
                                                Add Entry
                                            </button>
                                        </div>
                                    </div>
                                )}

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
                                                {loadingAdjustments ? (
                                                    <tr><td colSpan="4" style={{textAlign:'center', padding:'20px'}}>Loading...</td></tr>
                                                ) : shipmentAdjustments.length === 0 ? (
                                                    <tr><td colSpan="4" style={{textAlign:'center', padding:'30px', color:'#b2bec3'}}>No adjustments recorded.</td></tr>
                                                ) : (
                                                    shipmentAdjustments.map(adj => (
                                                        <tr key={adj.adjustmentID}>
                                                            <td style={{color:'#636e72'}}>
                                                                {new Date(adj.created_at).toLocaleDateString()}
                                                            </td>
                                                            <td style={{fontWeight:'500'}}>
                                                                {adj.reason}
                                                            </td>
                                                            <td style={{color: adj.type === 'BONUS' ? '#27ae60' : '#c0392b', textAlign:'right'}}>
                                                                {adj.type === 'DEDUCTION' ? '-' : '+'}₱{Number(adj.amount).toLocaleString()}
                                                            </td>
                                                            <td className="text-right">
                                                                {!isLocked && (
                                                                    <button onClick={() => deleteAdjustment(adj.adjustmentID)} className="action-btn">
                                                                        <Icons.Trash size={16} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {feedback && <FeedbackModal {...feedback} />}
        </div>
    );
}

export default ShipmentHistoryModal;
