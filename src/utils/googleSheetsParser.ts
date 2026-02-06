import * as XLSX from 'xlsx';
import type { DataRow } from '@/types';

/**
 * Extract Google Sheets ID from various URL formats
 */
export function extractSheetId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]{20,})$/ // Direct ID (min 20 chars)
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Build CSV export URL for public Google Sheets
 */
export function buildExportUrl(sheetId: string, gid: number = 0): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Extract GID from URL if present
 */
export function extractGid(url: string): number {
  const match = url.match(/gid=(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Fetch and parse data from a public Google Sheets URL
 */
export async function fetchGoogleSheetsData(url: string): Promise<{
  columns: string[];
  data: DataRow[];
  sheetId: string;
}> {
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    throw new Error('Invalid Google Sheets URL. Please provide a valid share link.');
  }

  const gid = extractGid(url);
  const exportUrl = buildExportUrl(sheetId, gid);

  try {
    const response = await fetch(exportUrl);
    
    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        throw new Error('This sheet is not publicly accessible. Please set sharing to "Anyone with the link".');
      }
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }

    const csvText = await response.text();
    
    // Parse CSV using XLSX
    const workbook = XLSX.read(csvText, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No sheets found in the document.');
    }
    
    const firstSheet = workbook.Sheets[sheetName];
    if (!firstSheet) {
      throw new Error('Could not read sheet data.');
    }
    
    const jsonData = XLSX.utils.sheet_to_json<DataRow>(firstSheet, { defval: null });

    if (jsonData.length === 0) {
      throw new Error('The sheet appears to be empty.');
    }

    const firstRow = jsonData[0];
    const columns = firstRow ? Object.keys(firstRow) : [];

    return {
      columns,
      data: jsonData,
      sheetId
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * Validate that a URL looks like a Google Sheets URL
 */
export function isValidGoogleSheetsUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('docs.google.com/spreadsheets') || /^[a-zA-Z0-9-_]{20,}$/.test(url);
}
