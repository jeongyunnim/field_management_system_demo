/**
 * 파일 선택 다이얼로그
 */
export function selectFile({ accept = "*", description = "파일" } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      
      input.onchange = (event) => {
        const file = event.target.files?.[0];
        resolve(file || null);
      };
      
      input.oncancel = () => {
        resolve(null);
      };

      input.click();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 파일을 텍스트로 읽기
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = (error) => {
      reject(new Error(`파일 읽기 실패: ${error}`));
    };
    
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * 파일을 ArrayBuffer로 읽기 (기존 인증서 업로드용)
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = (error) => {
      reject(new Error(`파일 읽기 실패: ${error}`));
    };
    
    reader.readAsArrayBuffer(file);
  });
}