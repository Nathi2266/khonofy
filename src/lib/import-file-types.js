export const IMPORT_FILE_ACCEPT =
  '.csv,.pdf,.txt,.docx,.xlsx,.png,.jpg,.jpeg,text/csv,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg';

export const IMPORT_FILE_LABEL = 'CSV, PDF, TXT, DOCX, XLSX, PNG, or JPEG';

/**
 * @param {File} file
 * @returns {'csv' | 'pdf' | 'txt' | 'docx' | 'xlsx' | 'image' | null}
 */
export function getImportFileKind(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const type = file.type?.toLowerCase() || '';

  if (extension === 'csv' || type === 'text/csv') return 'csv';
  if (extension === 'pdf' || type === 'application/pdf') return 'pdf';
  if (extension === 'txt' || type === 'text/plain') return 'txt';
  if (
    extension === 'docx'
    || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (
    extension === 'xlsx'
    || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx';
  }
  if (
    extension === 'png'
    || extension === 'jpg'
    || extension === 'jpeg'
    || type === 'image/png'
    || type === 'image/jpeg'
  ) {
    return 'image';
  }

  return null;
}

/**
 * @param {File} file
 */
export function isSupportedImportFile(file) {
  return getImportFileKind(file) !== null;
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read the uploaded file.'));
    reader.readAsDataURL(file);
  });
}
