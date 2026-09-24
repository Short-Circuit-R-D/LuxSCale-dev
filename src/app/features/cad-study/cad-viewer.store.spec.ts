import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { vi } from 'vitest';
import type { AutomateResponseDto } from '../../core/automate/dtos/automate-response.dto';
import { CadAnalysisService } from './cad-analysis.service';
import { CadRoomStudyDraft, CadViewerStore } from './cad-viewer.store';
import type { Layout } from './models/layout.model';

function draft(title = "Kitchen's study", roomId = 'room-1'): CadRoomStudyDraft {
  return {
    title,
    roomId,
    request: {
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      ceilingHeight: 3,
      mountingHeight: 2.5,
      activityId: 'en12464_1_v2019_6_2_3',
      variantIds: null,
    },
    response: { solutions: [], closestMiss: null } as unknown as AutomateResponseDto,
    project: null,
    standard: null,
    requestId: null,
    variantHeaders: new Map(),
    vertices: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    holes: [],
  };
}

describe('CadViewerStore room studies', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CadViewerStore, { provide: CadAnalysisService, useValue: {} }],
    });
  });

  it('adds, selects, closes, and resets room studies', () => {
    const store = TestBed.inject(CadViewerStore);
    expect(store.activeTab()).toBe('analysis');
    expect(store.roomStudies()).toEqual([]);

    const first = store.addRoomStudy(draft());
    expect(store.roomStudies()).toHaveLength(1);
    expect(store.activeTab()).toBe(first);
    expect(store.roomStudyOpen()).toBe(false);

    const second = store.addRoomStudy(draft("Office's study", 'room-2'));
    expect(store.roomStudies()).toHaveLength(2);
    expect(store.activeTab()).toBe(second);

    store.closeRoomStudy(first);
    expect(store.roomStudies()).toHaveLength(1);
    expect(store.activeTab()).toBe(second);

    store.closeRoomStudy(second);
    expect(store.roomStudies()).toEqual([]);
    expect(store.activeTab()).toBe('analysis');

    store.addRoomStudy(draft());
    store.selectTab('analysis');
    expect(store.activeTab()).toBe('analysis');
    store.reset();
    expect(store.roomStudies()).toEqual([]);
    expect(store.activeTab()).toBe('analysis');
  });
});

describe('CadViewerStore exact-number split', () => {
  const createDivider = vi.fn(() => EMPTY);

  function room(id = 'room-1') {
    return {
      id,
      name: 'Kitchen',
      kind: 'physical',
      selectable: true,
      confidence: 1,
      physical_room_id: id,
      parent_room_id: null,
      polygon: {
        vertices: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 4 },
          { x: 0, y: 4 },
        ],
      },
      center: { x: 2.5, y: 2 },
      area_m2: 20,
      area_net_m2: 20,
      area_gross_m2: 20,
      dimensions: null,
      perimeter_m: 18,
      bbox: { min_x: 0, min_y: 0, max_x: 5, max_y: 4 },
      neighbor_ids: [],
      objects: [],
      doors: [],
      windows: [],
      object_ids: [],
      door_ids: [],
      window_ids: [],
    };
  }

  function layoutWithRoom() {
    return {
      unit: 'm',
      meta: { layout_rev: 7 },
      walls: [],
      rooms: [room()],
      physical_rooms: [],
      virtual_dividers: [],
      objects: [],
      unassigned_objects: [],
      doors: [],
      windows: [],
      lights: [],
      texts: [],
      warnings: [],
    } as unknown as Layout;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CadViewerStore, { provide: CadAnalysisService, useValue: { createDivider } }],
    });
    createDivider.mockClear();
  });

  function readyStore() {
    const store = TestBed.inject(CadViewerStore);
    store.jobId.set('job-1');
    store.currentLayout.set(layoutWithRoom());
    return store;
  }

  it('posts a wall-to-wall divider at the exact offset', () => {
    const store = readyStore();
    store.splitAtOffset('room-1', 'horizontal', 'min', 1);
    expect(createDivider).toHaveBeenCalledWith('job-1', {
      start_x: 0,
      start_y: 1,
      end_x: 5,
      end_y: 1,
      expected_layout_rev: 7,
    });
    expect(store.splitError()).toBeNull();
  });

  it('measures from the max edge for vertical cuts', () => {
    const store = readyStore();
    store.splitAtOffset('room-1', 'vertical', 'max', 2);
    expect(createDivider).toHaveBeenCalledWith('job-1', {
      start_x: 3,
      start_y: 0,
      end_x: 3,
      end_y: 4,
      expected_layout_rev: 7,
    });
  });

  it('rejects out-of-range offsets without posting', () => {
    const store = readyStore();
    store.splitAtOffset('room-1', 'horizontal', 'min', 9);
    expect(createDivider).not.toHaveBeenCalled();
    expect(store.splitError()).toContain('between 0 and');
  });

  it('measures the live preview against the room under the cursor', () => {
    const store = readyStore();
    store.setPendingStart({ x: 0, y: 1 });
    store.setPreviewEnd({ x: 5, y: 1 });
    expect(store.splitMeasure()).toMatchObject({
      roomId: 'room-1',
      axis: 'horizontal',
      fromMin: 1,
      toMax: 3,
      span: 4,
    });
    store.setPendingStart({ x: 9, y: 9 });
    expect(store.splitMeasure()).toBeNull();
  });
});
