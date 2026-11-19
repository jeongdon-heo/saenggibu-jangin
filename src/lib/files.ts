import { downloadBytes, downloadTextFile } from "./download";
import { buildExportRows } from "./exportRows";
import { backupFilename, xlsxFilename } from "./format";
import { serializeBackup } from "./storage";
import { buildXlsxBytes } from "./xlsx";
import type { AppData } from "../types";

export function saveBackupFile(data: AppData) {
  downloadTextFile(backupFilename(data.classInfo), serializeBackup(data));
}

export function saveXlsxFile(data: AppData) {
  downloadBytes(
    xlsxFilename(data.classInfo),
    buildXlsxBytes(buildExportRows(data)),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
