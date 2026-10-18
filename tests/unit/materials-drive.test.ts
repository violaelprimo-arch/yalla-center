import { describe, it, expect } from 'vitest';
import {
  extractGoogleDriveFileId,
  buildDriveLinks,
  parseGoogleDriveInput,
} from '@/lib/materials/drive';

describe('Milestone 5: Google Drive URL Parser & File ID Extractor (FEAT-32)', () => {
  it('extracts Google Drive file ID from standard view/sharing URLs', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';
    const id = extractGoogleDriveFileId(url);
    expect(id).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('extracts file ID from Google Docs URLs', () => {
    const docUrl = 'https://docs.google.com/document/d/17bWjK920_mKlQ-sU-7v8w9xYzA_B1C2D3E4F5G6H7/edit';
    const id = extractGoogleDriveFileId(docUrl);
    expect(id).toBe('17bWjK920_mKlQ-sU-7v8w9xYzA_B1C2D3E4F5G6H7');
  });

  it('extracts file ID from Google Sheets URLs', () => {
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1Spreadsheet_File_Id_ABC123xyz_987654321/edit#gid=0';
    const id = extractGoogleDriveFileId(sheetUrl);
    expect(id).toBe('1Spreadsheet_File_Id_ABC123xyz_987654321');
  });

  it('extracts file ID from open?id= URLs', () => {
    const openUrl = 'https://drive.google.com/open?id=1OpenIdFile_45678901234567890123456789';
    const id = extractGoogleDriveFileId(openUrl);
    expect(id).toBe('1OpenIdFile_45678901234567890123456789');
  });

  it('accepts raw Google Drive file ID strings (25-60 chars)', () => {
    const rawId = '1gDrive_Kirchhoff_Indexed_001_Longer_Identifier_Valid';
    const id = extractGoogleDriveFileId(rawId);
    expect(id).toBe(rawId);
  });

  it('returns null for invalid or empty inputs', () => {
    expect(extractGoogleDriveFileId('')).toBeNull();
    expect(extractGoogleDriveFileId('short')).toBeNull();
    expect(extractGoogleDriveFileId('https://example.com/not-drive')).toBeNull();
  });

  it('constructs canonical Drive links for preview, download, and thumbnail', () => {
    const fileId = '1TestFileId1234567890abcdefghij';
    const links = buildDriveLinks(fileId);

    expect(links.webViewLink).toContain(`https://drive.google.com/file/d/${fileId}/view`);
    expect(links.webContentLink).toContain(`https://drive.google.com/uc?export=download&id=${fileId}`);
    expect(links.thumbnailLink).toContain(`https://drive.google.com/thumbnail?id=${fileId}`);
  });

  it('parses input and returns rich metadata including suggested file type', () => {
    const docUrl = 'https://docs.google.com/document/d/17bWjK920_mKlQ-sU-7v8w9xYzA_B1C2D3E4F5G6H7/edit';
    const meta = parseGoogleDriveInput(docUrl);

    expect(meta).not.toBeNull();
    expect(meta?.fileId).toBe('17bWjK920_mKlQ-sU-7v8w9xYzA_B1C2D3E4F5G6H7');
    expect(meta?.suggestedFileType).toBe('application/vnd.google-apps.document');
  });
});
