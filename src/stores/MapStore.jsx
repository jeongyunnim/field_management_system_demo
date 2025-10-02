// Lightweight global store for map‑related state shared by multiple pages
import { create } from 'zustand';


export const useMapStore = create((set, get) => ({
vehiclePosition: null, // { latitude, longitude, heading }
stationStatusMap: {}, // { [l2id]: { gnss_data, lastMsgTs, ... } }


setVehiclePosition: (vp) => set({ vehiclePosition: vp }),
setStationStatus: (l2id, status) => set((s) => ({
stationStatusMap: { ...s.stationStatusMap, [l2id]: status },
})),
resetStations: () => set({ stationStatusMap: {} }),
}));