// src/services/database/OtaDatabase.js
import Dexie from "dexie";

/**
 * OTA 패키지 저장용 IndexedDB
 */
class OtaDatabase extends Dexie {
  constructor() {
    super("OtaDatabase");
    
    // 스키마 정의
    this.version(1).stores({
      // 소프트웨어 패키지 테이블
      packages: "sw_id, version, sw_md5, updated_at",
      
      // 메타데이터 테이블
      metadata: "key, value, updated_at",
    });

    // 타입스크립트 타입 힌트용
    this.packages = this.table("packages");
    this.metadata = this.table("metadata");
  }
}

// 싱글톤 인스턴스
export const otaDb = new OtaDatabase();

/**
 * 패키지 저장
 */
export async function savePackage(packageData) {
  const { sw_id, version, sw_md5, sw_path, data_base64 } = packageData;

  await otaDb.packages.put({
    sw_id,
    version,
    sw_md5,
    sw_path,
    data_base64,
    updated_at: new Date().toISOString(),
  });
}

/**
 * 패키지 조회
 */
export async function getPackage(sw_id) {
  return await otaDb.packages.get(sw_id);
}

/**
 * 모든 패키지 조회
 */
export async function getAllPackages() {
  return await otaDb.packages.toArray();
}

/**
 * 패키지 삭제
 */
export async function deletePackage(sw_id) {
  await otaDb.packages.delete(sw_id);
}

/**
 * 모든 패키지 삭제
 */
export async function clearAllPackages() {
  await otaDb.packages.clear();
}

/**
 * index.json 저장 (메타데이터)
 */
export async function saveIndexMetadata(indexData) {
  await otaDb.metadata.put({
    key: "index",
    value: indexData,
    updated_at: new Date().toISOString(),
  });
}

/**
 * index.json 조회
 */
export async function getIndexMetadata() {
  const record = await otaDb.metadata.get("index");
  return record?.value || null;
}

/**
 * DB 통계
 */
export async function getDbStats() {
  const packageCount = await otaDb.packages.count();
  const packages = await otaDb.packages.toArray();
  
  const totalSize = packages.reduce((sum, pkg) => {
    // Base64 문자열 크기 (대략적인 바이트 수)
    return sum + (pkg.data_base64?.length || 0) * 0.75;
  }, 0);

  return {
    packageCount,
    totalSize: Math.round(totalSize),
    packages: packages.map(p => ({
      sw_id: p.sw_id,
      version: p.version,
      size: Math.round((p.data_base64?.length || 0) * 0.75),
      updated_at: p.updated_at,
    })),
  };
}

/**
 * 패키지 버전 비교 (업데이트 필요 여부)
 */
export async function checkPackageNeedsUpdate(sw_id, newVersion) {
  const existingPackage = await getPackage(sw_id);
  
  if (!existingPackage) {
    return true; // 패키지가 없으면 업데이트 필요
  }

  // 버전 비교
  return compareVersions(newVersion, existingPackage.version) > 0;
}

/**
 * 버전 비교 함수 (semantic versioning)
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  
  return 0;
}