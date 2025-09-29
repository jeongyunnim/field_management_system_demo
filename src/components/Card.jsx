export function Card({ className = "", children }) {
  return (
    <section
      className={[
        "flex flex-col",
        "bg-[#121D2D] text-slate-100",
        "relative rounded-2xl shadow-sm",
        "ring-1 ring-[#576476] p-5",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

/**
[예시]

<Card>
    <div className="flex flex-row justify-between">
        <h2 className="text-3xl font-semibold">
            시스템 통계
        </h2>
        // ...
    </div>
</Card>

*/