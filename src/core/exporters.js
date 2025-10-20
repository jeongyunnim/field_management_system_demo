// src/core/exporters.js
import { buildCsv } from "../utils/csvHelpers";

export function downloadCsvInBrowser(filename, header, rows) {
  const csv = buildCsv(rows, header);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function saveCsvOnAndroid(filename, header, rows) {
  const csv = buildCsv(rows, header);

  // 1) 런타임이 Capacitor Android인지 간단 체크
  const isCapacitor = typeof window !== "undefined" && !!window.Capacitor;
  const isAndroid = isCapacitor && typeof window.Capacitor.getPlatform === "function"
    ? window.Capacitor.getPlatform() === "android"
    : false;

  if (!isAndroid) {
    // 네이티브 환경이 아니면 false 반환 (caller가 브라우저 다운로드로 폴백)
    return false;
  }

  try {
    // 2) dynamic import: Vite의 import 분석을 피하려면 모듈 이름을 변수로 전달한다.
    const fsModuleName = "@capacitor/filesystem";
    const shareModuleName = "@capacitor/share";

    const { Filesystem, Directory, Encoding } = await import(fsModuleName);
    await Filesystem.writeFile({
      path: filename,
      data: csv,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    try {
      const { Share } = await import(shareModuleName);
      // 기기에 따라 path가 다를 수 있으니 필요 시 조정
      await Share.share({
        title: "RSE CSV",
        text: "점검 보고서 CSV",
        url: `file:///storage/emulated/0/Documents/${filename}`,
        dialogTitle: "공유",
      });
    } catch (shareErr) {
      // 공유 실패해도 파일은 저장된 상태라 무시
      console.warn("Share failed (non-fatal):", shareErr);
    }

    return true;
  } catch (e) {
    console.error("saveCsvOnAndroid failed:", e);
    return false;
  }
}