/**
 * Google Drive URL parser, file ID extractor, and link builder for Yalla Center.
 */

export interface GoogleDriveMetadata {
  fileId: string;
  originalInput: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink: string;
  suggestedFileType: 'application/pdf' | 'application/vnd.google-apps.document' | 'application/vnd.google-apps.spreadsheet' | 'application/vnd.google-apps.presentation' | 'unknown';
}

/**
 * Extracts a Google Drive File ID from various URL formats or raw ID string.
 */
export function extractGoogleDriveFileId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Direct file ID check (alphanumeric, underscores, hyphens, 25-60 chars)
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. File URL pattern: /file/d/{id}
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // 3. Document/Presentation/Spreadsheet URL pattern: /d/{id}
  const docMatch = trimmed.match(/\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch) return docMatch[1];

  // 4. Query parameter pattern: id={id}
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  // 5. Short sharing url pattern: drive.google.com/open?id={id}
  const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  return null;
}

/**
 * Builds canonical Google Drive links for preview, download, and thumbnail.
 */
export function buildDriveLinks(fileId: string): {
  webViewLink: string;
  webContentLink: string;
  thumbnailLink: string;
} {
  return {
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: `https://drive.google.com/uc?export=download&id=${fileId}`,
    thumbnailLink: `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`,
  };
}

/**
 * Parses a Google Drive URL or raw file ID and returns rich metadata.
 */
export function parseGoogleDriveInput(input: string): GoogleDriveMetadata | null {
  const fileId = extractGoogleDriveFileId(input);
  if (!fileId) return null;

  const links = buildDriveLinks(fileId);
  let suggestedFileType: GoogleDriveMetadata['suggestedFileType'] = 'application/pdf';

  if (input.includes('/document/d/')) {
    suggestedFileType = 'application/vnd.google-apps.document';
  } else if (input.includes('/spreadsheets/d/')) {
    suggestedFileType = 'application/vnd.google-apps.spreadsheet';
  } else if (input.includes('/presentation/d/')) {
    suggestedFileType = 'application/vnd.google-apps.presentation';
  }

  return {
    fileId,
    originalInput: input,
    ...links,
    suggestedFileType,
  };
}
