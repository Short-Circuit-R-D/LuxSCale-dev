import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CalculationResponse } from '../../services/calculation-result.service';
import { ResultStoreService } from '../../services/result-store.service';
import { CadAnalysisService } from './cad-analysis.service';
import { CadRoomStudyDraft, CadViewerStore } from './cad-viewer.store';

function draft(title = "Kitchen's study", roomId = 'room-1'): CadRoomStudyDraft {
  return {
    title,
    roomId,
    result: { results: [] } as unknown as CalculationResponse,
    fallbackFields: new Set(),
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
      providers: [
        CadViewerStore,
        { provide: CadAnalysisService, useValue: {} },
        { provide: ResultStoreService, useValue: { fetchFixtureResults: () => of([]) } },
      ],
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
