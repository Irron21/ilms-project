import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Icons } from '../Icons'; 
import './RatesManager.css'; 
import FeedbackModal from '../FeedbackModal';

function RatesManager({ onClose }) {
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);

    // Form State
    const [isEditing, setIsEditing] = useState(null); 
    const [editForm, setEditForm] = useState({});
    const [newRate, setNewRate] = useState({
        routeCluster: '', vehicleType: 'AUV', driverBaseFee: '', helperBaseFee: '', foodAllowance: 350
    });

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/rates');
            setRates(res.data);
        } catch (error) {
            alert("Failed to load rates");
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS ---
    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/rates', newRate);
            setNewRate({ routeCluster: '', vehicleType: 'AUV', driverBaseFee: '', helperBaseFee: '', foodAllowance: 350 });
            fetchRates(); 
            setFeedback({
                type: 'success',
                title: 'Rate Added',
                message: 'New payroll rate added successfully.',
                confirmLabel: 'OK',
                onClose: () => setFeedback(null)
            });
        } catch (error) {
            setFeedback({
                type: 'error',
                title: 'Error',
                message: error.response?.data?.error || "Failed to add rate.",
                confirmLabel: 'Close',
                onClose: () => setFeedback(null)
            });
        }
    };

    const handleDeleteClick = (rate) => {      
        const targetID = rate.rateID || rate.id || rate.rateId;

        if (!targetID) {
            alert("Error: Could not find Rate ID. Check console for details.");
            return;
        }

        setFeedback({
            type: 'warning',
            title: 'Delete Payroll Rate?',
            message: `Are you sure you want to delete the rate for ${rate.routeCluster} (${rate.vehicleType})?`,
            subMessage: "This action cannot be undone.",
            confirmLabel: "Delete",
            onClose: () => setFeedback(null),
            onConfirm: () => confirmDelete(targetID) 
        });
    };

    const confirmDelete = async (id) => {
        try {
            await api.delete(`/rates/${id}`);

            setRates(prev => prev.filter(r => r.rateID !== id));

            setFeedback({
                type: 'success',
                title: 'Deleted Successfully',
                message: 'The payroll rate has been removed.',
                confirmLabel: 'Great',
                onClose: () => setFeedback(null) 
            });

        } catch (error) {
            setFeedback({
                type: 'error',
                title: 'Deletion Failed',
                message: 'Could not delete the rate. Please try again.',
                confirmLabel: 'Close',
                onClose: () => setFeedback(null)
            });
        }
    };

    const startEdit = (rate) => {
        setIsEditing(rate.rateID);
        setEditForm({ ...rate });
    };

    const saveEdit = async () => {
    try {
        await api.put(`/rates/${isEditing}`, editForm);

        setRates(prevRates => prevRates.map(rate => 
            rate.rateID === isEditing ? { ...rate, ...editForm } : rate
        ));

        setIsEditing(null);
    } catch (error) {
        alert("Error updating rate");
    }
};

    return (
        <div className="modal-backdrop">
            <div className="modal-card rates-modal">

                <div className="rates-header">
                    <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                        <div style={{
                            width:'40px', height:'40px', borderRadius:'50%', 
                            background:'#e1f5fe', display:'flex', alignItems:'center', justifyContent:'center',
                            color: '#03a9f4'
                        }}>
                            <Icons.Settings size={22} />
                        </div>
                        <div style={{display: 'flex', alignItems: 'flex-start', flexDirection: 'column'}}>
                            <h2 style={{margin:0, fontSize:'18px', color:'#2d3436'}}>Payroll Rates</h2>
                            <p style={{margin:0, fontSize:'13px', color:'#636e72'}}>Manage pricing per route & vehicle</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{border:'none', background:'none', cursor:'pointer', padding:'8px'}}>
                        <Icons.X size={20} color="#b2bec3" />
                    </button>
                </div>

                {/* Body: Form + Table */}
                <div className="rates-body">
                    
                    {/* HORIZONTAL FORM ROW */}
                    <form onSubmit={handleAdd} className="rates-form">
                        
                        {/* Route Input (Flexible Width) */}
                        <div className="form-group-mini" style={{flex: 2}}>
                            <label>Route / Cluster</label>
                            <input className="form-input" placeholder="e.g. Taguig" required 
                                value={newRate.routeCluster} 
                                onChange={e => setNewRate({...newRate, routeCluster: e.target.value})} 
                            />
                        </div>
                        
                        {/* Vehicle Select (Fixed Width) */}
                        <div className="form-group-mini" style={{width: '130px'}}>
                            <label>Vehicle</label>
                            <select className="form-input" required 
                                value={newRate.vehicleType} onChange={e => setNewRate({...newRate, vehicleType: e.target.value})}
                            >
                                <option value="AUV">AUV</option>
                                <option value="H100">H100</option>
                                <option value="4WH">4WH</option>
                                <option value="6WH">6WH</option>
                                <option value="FWD">FWD</option>
                                <option value="10WH">10WH</option>
                            </select>
                        </div>

                        {/* Fees (Small Widths) */}
                        <div className="form-group-mini" style={{width: '110px'}}>
                            <label>Driver Fee</label>
                            <input className="form-input text-right" type="number" placeholder="e.g. 600" required 
                                value={newRate.driverBaseFee} onChange={e => setNewRate({...newRate, driverBaseFee: e.target.value})} 
                            />
                        </div>
                        
                        <div className="form-group-mini" style={{width: '110px'}}>
                            <label>Helper Fee</label>
                            <input className="form-input text-right" type="number" placeholder="e.g. 400"required 
                                value={newRate.helperBaseFee} onChange={e => setNewRate({...newRate, helperBaseFee: e.target.value})} 
                            />
                        </div>

                        <div className="form-group-mini" style={{width: '110px'}}>
                            <label>Allowance</label>
                            <input className="form-input text-right" type="number" placeholder="e.g. 350" required 
                                value={newRate.foodAllowance} onChange={e => setNewRate({...newRate, foodAllowance: e.target.value})} 
                            />
                        </div>

                        {/* Add Button */}
                        <div className="form-group-mini">
                            <label>&nbsp;</label>
                            <button className="btn-add-rate" type="submit">
                                <Icons.Plus size={18} />
                            </button>
                        </div>
                    </form>

                    {/* Table Container */}
                    <div className="rates-table-container">
                        <table className="payroll-table">
                            <thead>
                                <tr>
                                    <th>Route Cluster</th>
                                    <th>Vehicle</th>
                                    <th className="text-right">Driver Pay</th>
                                    <th className="text-right">Helper Pay</th>
                                    <th className="text-right">Allowance</th>
                                    <th style={{textAlign: 'center'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rates.map(rate => (
                                    <tr key={rate.rateID} style={{background: isEditing === rate.rateID ? '#fff8e1' : 'transparent'}}>
                                       {isEditing === rate.rateID ? (
                                        // --- EDIT MODE ---
                                        <>
                                            {/* 1. Non-Editable Fields: Show as TEXT (Saves space) */}
                                            <td>
                                                <span style={{fontWeight: '600', color: '#7f8c8d'}}>
                                                    {editForm.routeCluster}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="vehicle-badge" style={{opacity: 0.7}}>
                                                    {editForm.vehicleType}
                                                </span>
                                            </td>

                                            {/* 2. Editable Fields: Use .compact-input */}
                                            <td>
                                                <input 
                                                    className="compact-input text-right" 
                                                    type="number" 
                                                    value={editForm.driverBaseFee} 
                                                    onChange={e => setEditForm({...editForm, driverBaseFee: e.target.value})} 
                                                />
                                            </td>
                                            <td>
                                                <input 
                                                    className="compact-input text-right" 
                                                    type="number" 
                                                    value={editForm.helperBaseFee} 
                                                    onChange={e => setEditForm({...editForm, helperBaseFee: e.target.value})} 
                                                />
                                            </td>
                                            <td>
                                                <input 
                                                    className="compact-input text-right" 
                                                    type="number" 
                                                    value={editForm.foodAllowance} 
                                                    onChange={e => setEditForm({...editForm, foodAllowance: e.target.value})} 
                                                />
                                            </td>

                                            {/* 3. Actions */}
                                            <td className="actions-cell">
                                                <button onClick={saveEdit} className="action-btn" title="Save">
                                                    <Icons.Check size={18} color="#27ae60"/>
                                                </button>
                                                <button onClick={() => setIsEditing(null)} className="action-btn" title="Cancel">
                                                    <Icons.X size={18} color="#e74c3c"/>
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                             <>
                                                {/* View Mode... */}
                                                <td style={{fontWeight:'600'}}>{rate.routeCluster}</td>
                                                <td><span className="vehicle-badge">{rate.vehicleType}</span></td>
                                                <td className="text-right">{rate.driverBaseFee}</td>
                                                <td className="text-right">{rate.helperBaseFee}</td>
                                                <td className="text-right">{rate.foodAllowance}</td>
                                                <td className="actions-cell">
                                                    <button className="action-btn" onClick={() => startEdit(rate)}><Icons.Edit size={16} /></button>
                                                    <button className="action-btn" onClick={() => handleDeleteClick(rate)}><Icons.Trash size={16} /></button>
                                                </td>
                                             </>
                                         )}
                                    </tr>
                                ))}
                                {rates.length === 0 && <tr><td colSpan="6" style={{textAlign:'center', padding:'40px', color:'#999'}}>No rates found. Add one above.</td></tr>}
                            </tbody>
                        </table>
                    </div>
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

export default RatesManager;