import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapCamp {
  id: string;
  title: string;
  venue: string;
  causeCategory: string;
  latitude?: number | null;
  longitude?: number | null;
  isDemo?: boolean;
  ngo?: { name: string; location?: string };
}

export default function CampMap({ camps, onSelect }: { camps: MapCamp[]; onSelect: (campId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const locatedCampCount = camps.filter((camp) => Number.isFinite(camp.latitude) && Number.isFinite(camp.longitude)).length;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    const locatedCamps = camps.filter((camp) => Number.isFinite(camp.latitude) && Number.isFinite(camp.longitude));
    const markers = locatedCamps.map((camp) => {
      const marker = L.marker([camp.latitude as number, camp.longitude as number], {
        icon: L.divIcon({
          className: '',
          html: `<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:${camp.isDemo ? '#B7791F' : '#52796F'};box-shadow:0 1px 5px #0008"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      const popup = document.createElement('div');
      popup.className = 'min-w-44 max-w-64';

      const category = document.createElement('p');
      category.className = 'mb-1 text-xs font-semibold text-[#52796F]';
      category.textContent = camp.isDemo ? `${camp.causeCategory} · Demo sample` : camp.causeCategory;
      popup.append(category);

      const title = document.createElement('h3');
      title.className = 'text-sm font-bold text-[#0B192C]';
      title.textContent = camp.title;
      popup.append(title);

      const host = document.createElement('p');
      host.className = 'mt-2 text-xs text-[#52616C]';
      host.textContent = `Hosted by ${camp.ngo?.name || 'Verified NGO'}`;
      popup.append(host);

      const venue = document.createElement('p');
      venue.className = 'mt-1 text-xs text-[#52616C]';
      venue.textContent = `${camp.venue} (${camp.latitude?.toFixed(4)}, ${camp.longitude?.toFixed(4)})`;
      popup.append(venue);

      const viewDetails = document.createElement('button');
      viewDetails.type = 'button';
      viewDetails.className = 'mt-3 w-full rounded-lg bg-[#0B192C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#192B40]';
      viewDetails.textContent = 'View camp details & Q&A';
      viewDetails.addEventListener('click', () => {
        viewDetails.blur();
        map.closePopup();
        onSelect(camp.id);
      });
      popup.append(viewDetails);

      marker.bindPopup(popup, {
        autoPan: true,
        autoPanPaddingTopLeft: L.point(64, 64),
        autoPanPaddingBottomRight: L.point(20, 20),
        closeButton: true,
        maxWidth: 280,
        minWidth: 200,
      });
      return marker;
    });
    if (markers.length === 1) map.setView(markers[0].getLatLng(), 12);
    else if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, [camps, onSelect]);

  return (
    <div className="overflow-hidden rounded-xl border border-[#DCE5E1]">
      <div ref={containerRef} className="h-80 w-full" aria-label="Interactive map of camp locations" />
      <p className="border-t border-[#E8ECEA] bg-white px-4 py-2 text-xs text-[#64727C]">
        {!camps.length
          ? 'No upcoming camp locations to show yet. Published camps with coordinates will appear here.'
          : locatedCampCount
            ? `${locatedCampCount} camp location${locatedCampCount === 1 ? '' : 's'} shown, including fictional demo locations. Organizers can add coordinates when creating or editing a camp.`
            : 'No camps have map coordinates yet. Organizers can add coordinates when creating or editing a camp.'}
      </p>
    </div>
  );
}
