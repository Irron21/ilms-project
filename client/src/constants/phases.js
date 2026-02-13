/** Shipment delivery phase order used for status progression */
export const PHASE_ORDER = [
  'Loaded',
  'Arrival',
  'Handover Invoice',
  'Start Unload',
  'Finish Unload',
  'Invoice Receive',
  'Departure'
];

/** Step definitions for mobile shipment details (icons added in component) */
export const STEP_DEFINITIONS = [
  { label: 'Confirm Loaded', dbStatus: 'Loaded', iconName: 'CheckCircle' },
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
  { key: 'driverFee', label: 'Driver Base Fee', checked: false },
  { key: 'helperFee', label: 'Helper Base Fee', checked: false },
  { key: 'allowance', label: 'Allowance (Per Person)', checked: false },
  { key: 'dateCreated', label: 'Date Created', checked: false },
  { key: 'loaded', label: 'Time: Loaded', checked: false },
  { key: 'arrival', label: 'Time: Arrival', checked: false },
  { key: 'handover', label: 'Time: Handover Invoice', checked: false },
  { key: 'startUnload', label: 'Time: Start Unload', checked: false },
  { key: 'finishUnload', label: 'Time: Finish Unload', checked: false },
  { key: 'invoiceReceive', label: 'Time: Invoice Receive', checked: false },
  { key: 'departure', label: 'Time: Departure', checked: false },
  { key: 'completed', label: 'Time: Completed', checked: false }
];
