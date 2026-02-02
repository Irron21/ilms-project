import { useState, useEffect } from 'react';
import api from '@utils/api';
import { Icons } from '@shared'; 

function ShipmentHistoryModal({ employee, periodID, periodName, onClose }) {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const res = await api.get(`/payroll/trips/${periodID}/${employee.userID}`);
                setTrips(res.data);
            } catch (err) {
                console.error("Failed to load trips", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTrips();
    }, [periodID, employee.userID]);

    const totalBaseFee = trips.reduce((sum, t) => sum + Number(t.baseFee), 0);
    const totalAllowance = trips.reduce((sum, t) => sum + Number(t.allowance), 0);
    const totalEarnings = totalBaseFee + totalAllowance;

    return (
        <div className="modal-backdrop">
            <div className="payment-modal-card" style={{width: '850px'}}> 

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
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="5" style={{textAlign:'center', padding:'30px'}}>Loading trips...</td></tr>
                                    ) : trips.length === 0 ? (
                                        <tr><td colSpan="5" style={{textAlign:'center', padding:'30px', color:'#b2bec3'}}>No trips found.</td></tr>
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
    );
}

export default ShipmentHistoryModal;