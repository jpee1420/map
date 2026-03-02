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
  // ECharts Canvas renderer doesn't support SVG export directly.
  // We get a high-res PNG as a reliable fallback with .svg extension workaround,
  // or try to render via SVG renderer if available.
  try {
    // Try getting SVG string via getDataURL with svg type
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
  } catch {
    // Fallback: export as high-res PNG with SVG name
    const url = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 4,
      backgroundColor: '#fff'
    });
    
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function exportToExcel(data: any[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
