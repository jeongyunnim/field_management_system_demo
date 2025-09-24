import { useRef, useState, useEffect } from "react";

export function useInspection({ toastDuration = 2000, onStart, onStop }) {
  const [isInspecting, setIsInspecting] = useState(false);
  const [toast, setToast] = useState({ visible: false, text: "" });
  const toastTimerRef = useRef(null);

  const showToast = (text) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ visible: true, text });
    toastTimerRef.current = setTimeout(() => {
      setToast({ visible: false, text: "" });
      toastTimerRef.current = null;
    }, toastDuration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const startInspection = () => {
    setIsInspecting(true);
    onStart?.();
    showToast("점검이 시작되었습니다.");
  };

  const stopInspection = () => {
    setIsInspecting(false);
    onStop?.();
    showToast("점검이 중단되었습니다.");
  };

  return { isInspecting, startInspection, stopInspection, toast };
}
