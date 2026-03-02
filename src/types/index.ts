export interface MapLocation {
  name: string;
  region_name?: string;
  province_name?: string;
  code?: string;
}

export interface MetricValue {
  value: number;
  formatted: string;
}

export interface DataRow {
  [key: string]: string | number | null | undefined;
}

export interface ImportedDataset {
  fileName: string;
  columns: string[];
  data: DataRow[];
  timestamp: number;
}

export interface FilterConfig {
  id: string;
  column: string;
  type: 'select' | 'date' | 'range' | 'search';
  value: any; // Can be string[], {min, max}, {from, to}, or string
}

export interface PivotField {
  id: string;
  column: string;
  fieldType: 'dimension' | 'metric' | 'breakdown';
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  formatType?: 'number' | 'currency' | 'percentage';
  decimals?: number;
  displayName?: string;
  colorScale?: {
    min: string;
    max: string;
  };
  groupOthers?: boolean;
  othersCategories?: string[];
  seriesType?: 'bar' | 'line';  // Used in combo chart to assign metric to bar or line
  color?: string;               // Direct color for non-map chart series
}

export interface DataLabelConfig {
  enabled: boolean;
  format: 'number' | 'percentage' | 'both';
  display: 'value' | 'breakdown';
}

export interface TabConfig {
  id: string;
  name: string;
  type: 'map' | 'bar' | 'line' | 'doughnut' | 'hbar' | 'stacked' | 'combo' | 'table';
  filters: FilterConfig[];
  pivotFields: PivotField[];
  sortOrder?: 'asc' | 'desc' | 'none';
  dataLabel?: DataLabelConfig;
}
