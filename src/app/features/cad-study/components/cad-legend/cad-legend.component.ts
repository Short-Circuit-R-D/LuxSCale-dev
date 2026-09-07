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

type LayerPreview =
  | { kind: 'rooms'; fills: string[]; stroke: string }
  | { kind: 'fill'; fill: string; stroke: string; dashed?: boolean }
  | { kind: 'line'; stroke: string; thicknessPx: number; dashed?: boolean }
  | { kind: 'outline'; stroke: string }
  | { kind: 'text'; color: string };

interface ColorLegendItem {
  key: keyof CadLayerVisibility;
  label: string;
  preview: LayerPreview;
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
    const rooms = this.store.physicalRoomsOnly()
      ? (layout?.physical_rooms ?? [])
      : (layout?.rooms ?? []);
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

  toggleRoom(id: string): void {
    this.store.selectRoom(id, { additive: true });
  }

  protected readonly renderItems: { key: 'physical' | 'faces'; label: string }[] = [
    { key: 'physical', label: 'Physical rooms only' },
    { key: 'faces', label: 'Show all faces' },
  ];

  protected readonly colorItems: ColorLegendItem[] = [
    {
      key: 'rooms',
      label: 'Rooms',
      preview: {
        kind: 'rooms',
        fills: [
          'rgba(108,182,255,0.18)',
          'rgba(108,182,255,0.28)',
          'rgba(232,180,80,0.18)',
          'rgba(232,180,80,0.28)',
        ],
        stroke: '#6cb6ff',
      },
    },
    {
      key: 'discardedFaces',
      label: 'Discarded faces',
      preview: { kind: 'fill', fill: 'rgba(255,255,255,0.08)', stroke: '#8b9aab', dashed: true },
    },
    {
      key: 'walls',
      label: 'Walls',
      preview: { kind: 'line', stroke: '#d7dee7', thicknessPx: 2 },
    },
    {
      key: 'doors',
      label: 'Doors',
      preview: { kind: 'line', stroke: '#ff6b6b', thicknessPx: 3 },
    },
    {
      key: 'windows',
      label: 'Windows',
      preview: { kind: 'line', stroke: '#3ecfcf', thicknessPx: 3 },
    },
    {
      key: 'virtualDividers',
      label: 'Virtual dividers',
      preview: { kind: 'line', stroke: '#c9a227', thicknessPx: 2 },
    },
    {
      key: 'objects',
      label: 'Objects',
      preview: { kind: 'fill', fill: '#b388ff', stroke: '#b388ff' },
    },
    {
      key: 'texts',
      label: 'Text',
      preview: { kind: 'text', color: '#9ad07a' },
    },
  ];

  renderChecked(key: 'physical' | 'faces'): boolean {
    return key === 'physical' ? this.store.physicalRoomsOnly() : this.store.showAllFaces();
  }

  toggleRender(key: 'physical' | 'faces'): void {
    if (key === 'physical') {
      this.store.setPhysicalRoomsOnly(!this.store.physicalRoomsOnly());
      return;
    }
    this.store.setShowAllFaces(!this.store.showAllFaces());
  }

  protected lineFill(item: ColorLegendItem): string {
    const preview = item.preview;
    if (preview.kind !== 'line') {
      return 'transparent';
    }
    if (preview.dashed) {
      return `repeating-linear-gradient(90deg, ${preview.stroke} 0 5px, transparent 5px 8px)`;
    }
    return preview.stroke;
  }

  protected lineThickness(item: ColorLegendItem): number {
    return item.preview.kind === 'line' ? item.preview.thicknessPx : 0;
  }
}
