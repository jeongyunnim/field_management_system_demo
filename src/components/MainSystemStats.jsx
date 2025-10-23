import React, { useMemo } from "react";
import { shallow } from "zustand/shallow";
import { Card } from "./common/Card";
import Donut from "./common/Donut";
import { useInspectStore } from "../stores/InspectStore";
import { useRseStore } from "../stores/RseStore";
import { useModalStore } from "../stores/ModalStore";
import {
  calculateDeviceStatistics,
  generateChartData,
  generateStatsSummary,
  DEVICE_STATUS,
  STATUS_LABELS,
} from "../utils/statsUtils";

// 빈 객체 상수 (무한 루프 방지)
const EMPTY_OBJECT = {};

/**
 * 메인 시스템 통계 컴포넌트
 */
export default function MainSystemStats() {
  const phase = useInspectStore((state) => state.phase);
  const inspecting = phase === "running";

  // RSE 스토어에서 등록된 장치와 미확인 장치 데이터 가져오기
  const devicesById = useRseStore((state) => state.byId, shallow);
  const unregisteredDevices = useRseStore(
    (state) => state.unregisteredDevices ?? EMPTY_OBJECT, 
    shallow
  );
  
  // 장치 배열로 변환 (메모이제이션)
  const devices = useMemo(() => {
    return Object.values(devicesById);
  }, [devicesById]);

  // 미확인 기기 수
  const unregisteredCount = useMemo(() => {
    return Object.keys(unregisteredDevices).length;
  }, [unregisteredDevices]);

  // 통계 계산 (메모이제이션)
  const stats = useMemo(() => {
    return calculateDeviceStatistics(devices);
  }, [devices]);

  // 차트 데이터 생성
  const chartData = useMemo(() => {
    return generateChartData(stats);
  }, [stats]);

  // 요약 텍스트
  const summaryText = useMemo(() => {
    const registeredText = generateStatsSummary(stats);
    return registeredText;
  }, [stats, unregisteredCount]);

  // 점검 중이 아닌 경우
  if (!inspecting) {
    return (
      <Card className="h-full grid place-items-center text-slate-300">
        <div className="text-center space-y-2">
          <div className="text-lg">점검을 시작해 주세요.</div>
          <div className="text-sm text-slate-400">
            점검이 시작되면 실시간 통계가 표시됩니다.
          </div>
        </div>
      </Card>
    );
  }

  // 장치가 없는 경우
  if (stats.total === 0 && unregisteredCount === 0) {
    return (
      <Card className="h-full">
        <h2 className="main-card-title">시스템 통계</h2>
        <div className="flex-1 grid place-items-center text-slate-300">
          <div className="text-center space-y-2">
            <div className="text-lg">등록된 장치가 없습니다.</div>
            <div className="text-sm text-slate-400">
              장치가 연결되면 통계가 표시됩니다.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        {/* 헤더 */}
        <div className="flex flex-row justify-between items-start mb-4">
          <div className="flex-1">
            <h2 className="main-card-title">시스템 통계</h2>
            <div className="text-sm text-slate-400 mt-1">{summaryText}</div>
          </div>
        </div>

        {/* 범례 */}
        <div className="mb-4">
          <LegendGroup showUnregistered={unregisteredCount > 0} />
        </div>

        {/* 통계 도넛 차트 그리드 */}
        <div className="grid grid-cols-2 grid-rows-2 w-full flex-1 place-items-center gap-6">
          {chartData.map((data) => (
            <StatCard
              key={data.key}
              label={data.label}
              value={data.value}
              percent={data.percent}
              color={data.color}
              total={stats.activeCount}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

/**
 * 범례 그룹 컴포넌트
 */
function LegendGroup({ showUnregistered = false }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs">
      <Legend 
        dot="bg-emerald-500" 
        label={STATUS_LABELS[DEVICE_STATUS.OK]} 
      />
      <Legend 
        dot="bg-rose-500" 
        label={STATUS_LABELS[DEVICE_STATUS.FAULT]} 
      />
      <Legend 
        dot="bg-amber-500" 
        label={STATUS_LABELS[DEVICE_STATUS.WARNING]} 
      />
      <Legend 
        dot="bg-slate-400" 
        label={STATUS_LABELS[DEVICE_STATUS.UNKNOWN]} 
      />
      {showUnregistered && (
        <Legend 
          dot="bg-amber-400" 
          label="미확인 기기" 
        />
      )}
    </div>
  );
}

/**
 * 개별 범례 아이템
 */
function Legend({ dot, label }) {
  return (
    <div className="flex items-center">
      <span 
        className={`h-1.5 w-1.5 rounded-full ring-1 ring-black/10 ${dot} mr-1.5`} 
      />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}

/**
 * 통계 카드 컴포넌트
 */
function StatCard({ label, value, percent, color, total }) {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* Donut 컴포넌트에 children으로 중앙 콘텐츠 전달 */}
      <Donut 
        size={150} 
        value={percent} 
        color={color}
        stroke={16}
        showValue={false}
      >
        <div className="flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-100">{value}</span>
          <span className="text-xs text-slate-400 mt-0.5">/ {total}</span>
        </div>
      </Donut>
      
      {/* 하단 레이블 */}
      <div className="mt-3 text-center">
        <div className="text-lg text-slate-200">{label}</div>
        <div className="text-sm text-slate-400">{percent}%</div>
      </div>
    </div>
  );
}

/**
 * 헬스 스코어에 따른 색상 클래스 반환
 */
function getHealthScoreColor(score) {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  if (score >= 50) return "text-orange-400";
  return "text-rose-400";
}