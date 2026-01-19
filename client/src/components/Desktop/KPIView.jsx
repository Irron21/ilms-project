import React from 'react';
import './KPIView.css'; 

function KPIView() {
    return (
        <div className="kpi-dashboard">
            {/* Header Section */}
            <div className="kpi-header">
                <h2>Performance Overview</h2> {/* Sub-header */}
                <div className="kpi-controls">
                    <button className="kpi-upload-btn">⬆ Upload New Report</button>
                    <select className="kpi-period-select">
                        <option>Weekly</option>
                        <option>Monthly</option>
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="kpi-tabs">
                <button className="tab active">KPI Scorecard</button>
                <button className="tab">Trend Analysis</button>
                <button className="tab">Performance Breakdown</button>
            </div>

            {/* Main Grid Content */}
            <div className="kpi-content-grid">
                <div className="kpi-section primary">
                    <h3>Primary Metrics</h3>
                    <div className="chart-card">
                        <h4>Booking Compliance <span>▼1%</span></h4>
                        <div className="progress-bar"><div style={{width: '98%'}}></div></div>
                        <div className="mini-chart-placeholder"></div>
                    </div>
                    <div className="chart-card">
                        <h4>Delivery Compliance <span>▼1%</span></h4>
                        <div className="progress-bar"><div style={{width: '98%'}}></div></div>
                        <div className="mini-chart-placeholder"></div>
                    </div>
                    <div className="chart-card">
                        <h4>POD Compliance <span>▼1%</span></h4>
                        <div className="progress-bar"><div style={{width: '98%'}}></div></div>
                        <div className="mini-chart-placeholder"></div>
                    </div>
                </div>

                <div className="kpi-section operational">
                    <h3>Operational Metrics</h3>
                    <div className="chart-card">
                        <h4>Truck Availability <span>▼1%</span></h4>
                        <div className="progress-bar"><div style={{width: '98%'}}></div></div>
                        <div className="mini-chart-placeholder"></div>
                    </div>
                    <div className="chart-card">
                        <h4>DwellTime Compliance <span>▼1%</span></h4>
                        <div className="progress-bar"><div style={{width: '98%'}}></div></div>
                        <div className="mini-chart-placeholder"></div>
                    </div>
                    <div className="chart-card">
                        <h4>CallTime Compliance <span>▼1%</span></h4>
                        <div className="progress-bar"><div style={{width: '98%'}}></div></div>
                        <div className="mini-chart-placeholder"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default KPIView;