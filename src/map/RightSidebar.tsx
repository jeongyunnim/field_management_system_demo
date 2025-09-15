import { useOnline } from '@/hooks/useOnline'

export default function RightSidebar() {
  const online = useOnline()
  return (
    <aside className="border-l border-gray-200 p-3 overflow-auto">
      <div className="font-semibold mb-3">
        Status: {online ? 'Online' : 'Offline (using cache/local tiles)'}
      </div>
      <ul className="space-y-2 text-sm">
        <li>• 지도가 오프라인에서도 표시되도록 PMTiles/캐시를 사용합니다.</li>
        <li>• 온라인 시 실시간 데이터/타일을 갱신합니다.</li>
      </ul>
    </aside>
  )
}
