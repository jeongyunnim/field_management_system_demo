import StatCard from "../components/StatCard";

export default function Main() {
return (
<div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100 p-6">
  <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* ① 원형 통계 + 범례 */}
  <section className="relative rounded-2xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6 flex items-center justify-center min-h-[220px]">
  <div className="flex items-center gap-6">
  {/* 원형 차트 (자리표시자) */}
  <div className="relative h-32 w-32 rounded-full shadow-inner ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden grid place-items-center text-slate-400">
  차트 영역
</div>


{/* 범례 */}
<div className="space-y-3 text-sm">
<Legend color="bg-emerald-500" label="정상" />
<Legend color="bg-rose-500" label="장애" />
</div>
</div>
</section>


{/* ② 이벤트 리스트 로그 (기본 : 장애 로그) */}
<section className="relative rounded-2xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6 min-h-[220px] flex">
<div className="m-auto text-center">
<h2 className="text-lg font-semibold">이벤트 리스트 로그</h2>
<p className="text-sm text-slate-500 mt-1">(기본 : 장애 로그)</p>
<div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-slate-400 text-sm">
테이블/리스트 컴포넌트 영역
</div>
</div>
</section>


{/* ③ 현장관리 단말기 상태 (LED 표시) */}
<section className="relative md:col-span-2 rounded-2xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 p-6">
<h3 className="text-base font-semibold">현장관리 단말기 상태 <span className="text-slate-500 font-normal">(LED 표시)</span></h3>


<div className="mt-6 flex items-start gap-10">
{status === "normal" ? (
<div className="flex items-center gap-3">
<span className="inline-block h-5 w-5 rounded-full bg-emerald-500 shadow" />
<span>정상</span>
</div>
) : (
<div className="flex items-center gap-3">
<span className="inline-block h-5 w-5 rounded-full bg-rose-500 shadow" />
<span>비정상</span>
</div>
)}
</div>
</section>
</div>
</div>
);
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 rounded-sm ring-1 ring-black/10 ${color}`} />
      <span>{label}</span>
    </div>
  );
}
