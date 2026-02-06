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
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  formatType?: 'number' | 'currency' | 'percentage';
  decimals?: number;
  colorScale?: {
    min: string;
    max: string;
  };
}

export interface TabConfig {
  id: string;
  name: string;
  type: 'map' | 'bar' | 'line' | 'pie' | 'scatter' | 'table';
  filters: FilterConfig[];
  pivotFields: PivotField[];
}
