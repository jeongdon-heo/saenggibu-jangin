import { downloadBytes, downloadTextFile } from "./download";
import { buildExportTable, type ExportLayout } from "./exportRows";
import { backupFilename, xlsxFilename } from "./format";
import { serializeBackup } from "./storage";
import { buildXlsxTable } from "./xlsx";
import type { AppData } from "../types";

export function saveBackupFile(data: AppData) {
  downloadTextFile(backupFilename(data.classInfo), serializeBackup(data));
}

export function saveXlsxFile(data: AppData, layout: ExportLayout = "rows") {
  downloadBytes(
    xlsxFilename(data.classInfo),
    buildXlsxTable(buildExportTable(data, layout)),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
