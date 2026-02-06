import { computed } from 'vue';
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
  dataset: ImportedDataset | null,
  filters: FilterConfig[],
  pivotFields: PivotField[]
) {
  
  const filteredData = computed(() => {
    if (!dataset || !dataset.data) return [];
    
    return dataset.data.filter(row => {
      return filters.every(filter => {
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
    if (pivotFields.length === 0) return { dimensions: [], source: [] };
    
    const data = filteredData.value;
    if (data.length === 0) return { dimensions: [], source: [] };
    
    // Find category column (first string column)
    const firstRow = data[0];
    let categoryCol = 'id';
    if (firstRow) {
      const potentialCat = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string');
      if (potentialCat) categoryCol = potentialCat;
    }

    // Group data by category
    const grouped = new Map<string, DataRow[]>();
    data.forEach(row => {
      const category = String(row[categoryCol] || 'Unknown');
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(row);
    });

    // Aggregate values per category
    const source: Record<string, unknown>[] = [];
    grouped.forEach((rows, category) => {
      const aggregatedRow: Record<string, unknown> = { [categoryCol]: category };
      
      pivotFields.forEach(field => {
        const values = rows
          .map(r => {
            const val = r[field.column];
            return typeof val === 'number' ? val : Number(val) || 0;
          })
          .filter(v => !isNaN(v));
        
        aggregatedRow[field.column] = aggregate(values, field.aggregation);
      });
      
      source.push(aggregatedRow);
    });

    return {
      dimensions: [categoryCol, ...pivotFields.map(f => f.column)],
      source
    };
  });

  return {
    filteredData,
    chartData,
    formatValue
  };
}
