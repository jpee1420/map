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
          if (Array.isArray(filter.value)) {
            if (filter.value.length === 0) return true;
            return filter.value.includes(String(rowValue));
          }
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

  /**
   * Apply "Others" grouping: for any dimension field with groupOthers enabled,
   * replace matching row values with "Others". This transformation is applied
   * before any aggregation so all consumers automatically see grouped data.
   */
  const processedData = computed(() => {
    const pivotList = toValue(pivotFields);
    const data = filteredData.value;
    
    // Find dimension/breakdown fields that have "Others" grouping enabled
    const othersFields = pivotList.filter(
      f => (f.fieldType === 'dimension' || f.fieldType === 'breakdown') && f.groupOthers && f.othersCategories?.length
    );
    
    if (othersFields.length === 0) return data;
    
    // Transform rows: replace matching values with "Others"
    return data.map(row => {
      let transformed = false;
      const newRow: DataRow = { ...row };
      
      for (const field of othersFields) {
        const val = String(newRow[field.column] ?? '');
        if (field.othersCategories!.includes(val)) {
          newRow[field.column] = 'Others';
          transformed = true;
        }
      }
      
      return transformed ? newRow : row;
    });
  });

  const chartData = computed(() => {
    const pivotList = toValue(pivotFields);
    if (pivotList.length === 0) return { dimensions: [], source: [] };
    
    const data = processedData.value;
    if (data.length === 0) return { dimensions: [], source: [] };
    
    // Separate field types
    const dimensionFields = pivotList.filter(f => f.fieldType === 'dimension');
    const metricFields = pivotList.filter(f => f.fieldType === 'metric');
    const breakdownField = pivotList.find(f => f.fieldType === 'breakdown');
    
    // ─── Constraint: no metric → no data ───
    if (metricFields.length === 0) {
      return { dimensions: [], source: [] };
    }
    // ─── Constraint: no dimension → no data ───
    if (dimensionFields.length === 0) {
      return { dimensions: [], source: [] };
    }
    
    // Determine grouping columns
    const groupByColumns: string[] = dimensionFields.map(f => f.column);
    
    const categoryColName = dimensionFields.length > 0
      ? dimensionFields.map(f => f.displayName || f.column).join(' - ')
      : groupByColumns.join(' - ') || '_category';
    const getGroupKey = (row: DataRow): string => {
      if (groupByColumns[0] === '_category') return 'All';
      return groupByColumns.map(col => String(row[col] || 'Unknown')).join(' - ');
    };

    // ─── Breakdown pivot path ───
    if (breakdownField && metricFields.length > 0) {
      const bdCol = breakdownField.column;
      const metricField = metricFields[0]!; // Only 1 metric allowed with breakdown
      
      // Collect unique breakdown values
      const breakdownValues = new Set<string>();
      data.forEach(row => {
        const val = row[bdCol];
        if (val != null && val !== '') breakdownValues.add(String(val));
      });
      const bdValues = Array.from(breakdownValues).sort();
      
      // Group by dimension, then sub-group by breakdown value
      const grouped = new Map<string, Map<string, DataRow[]>>();
      data.forEach(row => {
        const groupKey = getGroupKey(row);
        const bdKey = String(row[bdCol] ?? 'Unknown');
        
        if (!grouped.has(groupKey)) grouped.set(groupKey, new Map());
        const subMap = grouped.get(groupKey)!;
        if (!subMap.has(bdKey)) subMap.set(bdKey, []);
        subMap.get(bdKey)!.push(row);
      });
      
      // Build pivoted source rows
      const source: Record<string, unknown>[] = [];
      grouped.forEach((subMap, groupKey) => {
        const row: Record<string, unknown> = { [categoryColName]: groupKey };
        
        for (const bdVal of bdValues) {
          const subRows = subMap.get(bdVal) || [];
          if (metricField.aggregation === 'count') {
            row[bdVal] = subRows.length;
          } else {
            const values = subRows
              .map(r => {
                const v = r[metricField.column];
                return typeof v === 'number' ? v : Number(v);
              })
              .filter(v => !isNaN(v));
            row[bdVal] = aggregate(values, metricField.aggregation);
          }
        }
        
        source.push(row);
      });
      
      return {
        dimensions: [categoryColName, ...bdValues],
        source
      };
    }

    // ─── Standard path (no breakdown) ───
    const grouped = new Map<string, DataRow[]>();
    data.forEach(row => {
      const key = getGroupKey(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    const source: Record<string, unknown>[] = [];
    
    grouped.forEach((rows, groupKey) => {
      const aggregatedRow: Record<string, unknown> = { [categoryColName]: groupKey };
      
      metricFields.forEach(field => {
        const metricName = field.displayName || `${field.aggregation.toUpperCase()}(${field.column})`;
        
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

    const metricNames = metricFields.map(f => f.displayName || `${f.aggregation.toUpperCase()}(${f.column})`);

    return {
      dimensions: [categoryColName, ...metricNames],
      source
    };
  });

  return {
    filteredData,
    processedData,
    chartData,
    formatValue
  };
}
