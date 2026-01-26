import React from 'react';
import './PayrollView.css';

function PayrollView() {
  return (
    <div className="payroll-container">
      {/* Header Actions */}
      <div className="header-actions">
        <div className="filter-group-inline">
          <label>Filter by:</label>

          <select className="payroll-filter-dropdown" disabled>
            <option>All Employees</option>
          </select>

          <span className="count-badge">0 Records</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="payroll-table">
          <thead>
            <tr>
              <th>EMPLOYEE ID</th>
              <th>NAME</th>
              <th>TOTAL JOBS</th>
              <th>SUGGESTED SALARY</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan="5" className="empty-state">
                No payroll records available
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PayrollView;
