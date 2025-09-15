import MapPanel from './map/MapPanel'
import RightSidebar from './map/RightSidebar'

export default function App() {
  return (
    <div className="grid h-screen" style={{ gridTemplateColumns: '1fr 360px' }}>
      <MapPanel />
      <RightSidebar />
    </div>
  )
}
