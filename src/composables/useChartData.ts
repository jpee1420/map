import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import type { ImportedDataset, FilterConfig, PivotField, DataRow } from '@/types';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';

/**
 * Aggregate an array of numbers by the specified method
 */
function aggregate(values: number[], method: AggregationType): number {
  if (values.length === 0) return 0;
  
  switch (method) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 !== 0) {
        return sorted[mid] ?? 0;
      }
      return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
    }
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/**
 * Format a number based on format type and decimal places
 */
export function formatValue(
  value: number, 
  formatType?: 'number' | 'currency' | 'percentage',
  decimals: number = 2
): string {
  if (isNaN(value)) return '-';
  
  switch (formatType) {
    case 'currency':
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value);
    case 'percentage':
      return new Intl.NumberFormat('en-PH', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value / 100);
    default:
      return new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value);
  }
}

export function useChartData(
  dataset: MaybeRefOrGetter<ImportedDataset | null>,
  filters: MaybeRefOrGetter<FilterConfig[]>,
  pivotFields: MaybeRefOrGetter<PivotField[]>
) {
  
  const filteredData = computed(() => {
    const ds = toValue(dataset);
    const filterList = toValue(filters);
    if (!ds || !ds.data) return [];
    
    return ds.data.filter(row => {
      return filterList.every(filter => {
        if (!filter.value) return true;
        const rowValue = row[filter.column];
        
        if (filter.type === 'select' || filter.type === 'search') {
          return String(rowValue) === String(filter.value);
        }

        if (filter.type === 'range' && filter.value) {
          const numVal = Number(rowValue);
          const { min, max } = filter.value as { min: number; max: number };
          return !isNaN(numVal) && numVal >= min && numVal <= max;
        }

        if (filter.type === 'date' && filter.value) {
          const dateVal = new Date(String(rowValue));
          const { from, to } = filter.value as { from: string; to: string };
          const fromDate = new Date(from);
          const toDate = new Date(to);
          return !isNaN(dateVal.getTime()) && dateVal >= fromDate && dateVal <= toDate;
        }

        return true;
      });
    });
  });

  const chartData = computed(() => {
    const pivotList = toValue(pivotFields);
    if (pivotList.length === 0) return { dimensions: [], source: [] };
    
    const data = filteredData.value;
    if (data.length === 0) return { dimensions: [], source: [] };
    
    // Separate dimension and metric fields
    const dimensionFields = pivotList.filter(f => f.fieldType === 'dimension');
    const metricFields = pivotList.filter(f => f.fieldType === 'metric');
    
    // If no dimension fields, fall back to first string column (backward compatibility)
    let groupByColumns: string[] = dimensionFields.map(f => f.column);
    if (groupByColumns.length === 0) {
      const firstRow = data[0];
      if (firstRow) {
        const potentialCat = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string');
        if (potentialCat) groupByColumns = [potentialCat];
      }
    }
    
    // If still no grouping columns, use 'All' as single category
    if (groupByColumns.length === 0) {
      groupByColumns = ['_category'];
    }
    
    // Create a composite group key from all dimension columns
    const getGroupKey = (row: DataRow): string => {
      if (groupByColumns[0] === '_category') return 'All';
      return groupByColumns.map(col => String(row[col] || 'Unknown')).join(' - ');
    };

    // Group data by dimensions
    const grouped = new Map<string, DataRow[]>();
    data.forEach(row => {
      const key = getGroupKey(row);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    });

    // Aggregate metrics per group
    const source: Record<string, unknown>[] = [];
    const categoryColName = groupByColumns.join(' - ') || '_category';
    
    grouped.forEach((rows, groupKey) => {
      const aggregatedRow: Record<string, unknown> = { [categoryColName]: groupKey };
      
      // If no metric fields but there are dimensions, add a default count
      if (metricFields.length === 0 && dimensionFields.length > 0) {
        aggregatedRow['Record Count'] = rows.length;
      }
      
      metricFields.forEach(field => {
        const metricName = `${field.aggregation.toUpperCase()}(${field.column})`;
        
        if (field.aggregation === 'count') {
          aggregatedRow[metricName] = rows.length;
        } else {
          const values = rows
            .map(r => {
              const val = r[field.column];
              return typeof val === 'number' ? val : Number(val);
            })
            .filter(v => !isNaN(v));
          
          aggregatedRow[metricName] = aggregate(values, field.aggregation);
        }
      });
      
      source.push(aggregatedRow);
    });

    // Build dimensions array for ECharts dataset
    const metricNames = metricFields.length > 0 
      ? metricFields.map(f => `${f.aggregation.toUpperCase()}(${f.column})`)
      : dimensionFields.length > 0 ? ['Record Count'] : pivotList.map(f => f.column);

    return {
      dimensions: [categoryColName, ...metricNames],
      source
    };
  });

  return {
    filteredData,
    chartData,
    formatValue
  };
}
