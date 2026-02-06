import * as echarts from 'echarts';
import * as XLSX from 'xlsx';

export function exportToPng(chartInstance: echarts.EChartsType, fileName: string) {
  const url = chartInstance.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#fff'
  });
  
  const link = document.createElement('a');
  link.download = `${fileName}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToSvg(chartInstance: echarts.EChartsType, fileName: string) {
  // Note: This requires the chart to be initialized with { renderer: 'svg' } 
  // or checking if the current renderer supports SVG export.
  // ECharts default is Canvas. If Canvas, we can't easily get SVG.
  // For now, we'll try to get DataURL as svg, but it might fallback if not supported.
  
  const url = chartInstance.getDataURL({
    type: 'svg',
    pixelRatio: 2,
    backgroundColor: '#fff'
  });
  
  const link = document.createElement('a');
  link.download = `${fileName}.svg`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(data: any[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
