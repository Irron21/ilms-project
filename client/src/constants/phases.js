/** Shipment delivery phase order used for status progression */
export const STORE_PHASES = [
  'Arrival',
  'Handover Invoice',
  'Start Unload',
  'Finish Unload',
  'Invoice Receive',
  'Departure'
];

export const WAREHOUSE_PHASES = [
  'Arrival at Warehouse',
  'Start Loading',
  'End Loading',
  'Document Released',
  'Start Route'
];

export const PHASE_ORDER = [
  ...WAREHOUSE_PHASES,
  ...STORE_PHASES
];

/** Step definitions for mobile shipment details (icons added in component) */
export const STEP_DEFINITIONS = [
  // Warehouse steps
  { label: 'Warehouse Arrival', dbStatus: 'Arrival at Warehouse', iconName: 'Clock' },
  { label: 'Start Loading', dbStatus: 'Start Loading', iconName: 'Box' },
  { label: 'End Loading', dbStatus: 'End Loading', iconName: 'CheckCircle' },
  { label: 'Document Released', dbStatus: 'Document Released', iconName: 'FileText' },
  { label: 'Start Route', dbStatus: 'Start Route', iconName: 'Truck' },
  // Store steps
  { label: 'Arrival Time', dbStatus: 'Arrival', iconName: 'Truck' },
  { label: 'Handover Invoice', dbStatus: 'Handover Invoice', iconName: 'Document' },
  { label: 'Start Unload', dbStatus: 'Start Unload', iconName: 'Box' },
  { label: 'Finish Unload', dbStatus: 'Finish Unload', iconName: 'Timer' },
  { label: 'Invoice Receive', dbStatus: 'Invoice Receive', iconName: 'Pen' },
  { label: 'Departure', dbStatus: 'Departure', iconName: 'Flag' }
];

/** Export column configuration for shipment reports */
export const EXPORT_COLUMNS = [
  { key: 'shipmentID', label: 'Shipment ID', checked: true },
  { key: 'destName', label: 'Destination Name', checked: true },
  { key: 'destLocation', label: 'Destination Address', checked: true },
  { key: 'loadingDate', label: 'Loading Date', checked: true },
  { key: 'deliveryDate', label: 'Delivery Date', checked: true },
  { key: 'plateNo', label: 'Truck Plate', checked: true },
  { key: 'truckType', label: 'Truck Type', checked: true },
  { key: 'currentStatus', label: 'Current Status', checked: true },
  { key: 'driverName', label: 'Driver Name', checked: true },
  { key: 'helperName', label: 'Helper Name', checked: true },
  
  // Warehouse Steps
  { key: 'arrivalWarehouse', label: 'Time: Arrival at Warehouse', checked: true },
  { key: 'startLoading', label: 'Time: Start Loading', checked: true },
  { key: 'endLoading', label: 'Time: End Loading', checked: true },
  { key: 'documentReleased', label: 'Time: Document Released', checked: true },
  { key: 'startRoute', label: 'Time: Start Route', checked: true },
  
  // Store Steps
  { key: 'arrival', label: 'Time: Arrival', checked: true },
  { key: 'handover', label: 'Time: Handover Invoice', checked: true },
  { key: 'startUnload', label: 'Time: Start Unload', checked: true },
  { key: 'finishUnload', label: 'Time: Finish Unload', checked: true },
  { key: 'invoiceReceive', label: 'Time: Invoice Receive', checked: true },
  { key: 'departure', label: 'Time: Departure', checked: true },
  { key: 'completed', label: 'Time: Completed', checked: true },
  { key: 'remarks', label: 'Remarks', checked: true },

      
  { key: 'driverFee', label: 'Driver Base Fee', checked: false },
  { key: 'helperFee', label: 'Helper Base Fee', checked: false },
  { key: 'allowance', label: 'Allowance (Per Person)', checked: false },
  { key: 'dateCreated', label: 'Date Created', checked: false }
];

