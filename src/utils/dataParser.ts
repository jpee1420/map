import * as XLSX from 'xlsx';
import type { DataRow, ImportedDataset } from '@/types';

export const parseFile = async (file: File): Promise<ImportedDataset> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        
        if (!firstSheetName) {
           throw new Error('No sheets found');
        }

        // @ts-ignore
        const worksheet = workbook.Sheets[firstSheetName];
        
        if (!worksheet) {
           throw new Error('Sheet is empty');
        }
        
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          throw new Error('File is empty');
        }

        const headers = (jsonData[0] || []).map(String);
        // @ts-ignore
        const rows = jsonData.slice(1).map((row: any[]) => {
          const rowData: DataRow = {};
          headers.forEach((header: string, index: number) => {
             rowData[header] = row[index];
          });
          return rowData;
        });

        resolve({
          fileName: file.name,
          columns: headers,
          data: rows,
          timestamp: Date.now(),
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
