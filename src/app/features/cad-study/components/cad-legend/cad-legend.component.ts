import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { isApproximateFootprint, netArea as roomNetArea } from '../../cad-geometry';
import { CadLayerVisibility, CadViewerStore } from '../../cad-viewer.store';
import { Room } from '../../models/room.model';

interface RoomGroup {
  physicalId: string;
  name: string;
  rooms: Room[];
}

@Component({
  selector: 'app-cad-legend',
  imports: [DecimalPipe],
  templateUrl: './cad-legend.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadLegendComponent {
  protected readonly store = inject(CadViewerStore);

  protected readonly roomGroups = computed((): RoomGroup[] => {
    const layout = this.store.currentLayout();
    const rooms = layout?.rooms ?? [];
    const physical = layout?.physical_rooms ?? [];
    const groups = new Map<string, RoomGroup>();

    for (const room of rooms) {
      const physicalId = room.physical_room_id || room.id;
      let group = groups.get(physicalId);
      if (!group) {
        const parent = physical.find((item) => item.id === physicalId);
        group = {
          physicalId,
          name: parent?.name || room.name || physicalId,
          rooms: [],
        };
        groups.set(physicalId, group);
      }
      group.rooms.push(room);
    }

    return [...groups.values()];
  });

  protected readonly warningCount = computed(
    () => this.store.layoutWarnings().length,
  );

  netArea(room: Room): number {
    return roomNetArea(room);
  }

  sizeLabel(room: Room): string | null {
    const dimensions = room.dimensions;
    if (!dimensions) {
      return null;
    }
    const prefix = isApproximateFootprint(room) ? '≈ ' : '';
    return `${prefix}${dimensions.length_m.toFixed(2)} × ${dimensions.width_m.toFixed(2)} m`;
  }

  protected readonly layerItems: { key: keyof CadLayerVisibility; label: string }[] = [
    { key: 'walls', label: 'Walls' },
    { key: 'rooms', label: 'Rooms' },
    { key: 'doors', label: 'Doors & windows' },
    { key: 'objects', label: 'Objects' },
    { key: 'texts', label: 'Texts' },
    { key: 'warnings', label: 'Warnings' },
  ];
}
