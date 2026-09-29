import { TestBed } from '@angular/core/testing';
import { AdvancedStudyStore } from './advanced-study.store';
import type { CalculateResponse } from '../../../core/calculate/dtos/calculate-response.dto';

describe('AdvancedStudyStore', () => {
  let store: AdvancedStudyStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdvancedStudyStore],
    });
    store = TestBed.inject(AdvancedStudyStore);
  });

  it('initializes with step 1 and invalid until project fields filled', () => {
    expect(store.currentStep()).toBe(1);
    expect(store.viewMode()).toBe('wizard');
    expect(store.isStep1Valid()).toBe(false);

    store.updateProject({
      projectName: 'Test Project',
      companyName: 'Test Corp',
      clientName: 'Jane Doe',
      clientPhone: '+1 555 123 4567',
      clientEmail: 'jane@example.com',
    });

    expect(store.isStep1Valid()).toBe(true);
  });

  it('validates mounting height cannot exceed ceiling height', () => {
    store.ceilingHeight.set(3.0);
    store.mountingHeight.set(3.5);
    expect(store.isStep1Valid()).toBe(false);

    store.mountingHeight.set(2.8);
    expect(store.roomLength()).toBe(8.0);
  });

  it('builds CalculateRequest for pattern layouts correctly with free placements', () => {
    store.updateProject({
      projectName: 'P1',
      companyName: 'C1',
      clientName: 'U1',
      clientPhone: '12345678',
      clientEmail: 'a@b.com',
    });
    store.roomLength.set(10.0);
    store.roomWidth.set(6.0);
    store.fixturePattern.set('grid');
    store.gridType.set('count');
    store.countX.set(4);
    store.countY.set(2);
    store.selectedVariantIds.set(['v-panel-600']);

    const req = store.buildCalculateRequest(false);
    expect(req.polygon.length).toBe(4);
    expect(req.ceilingHeight).toBe(3.0);
    expect(req.mountingHeight).toBe(2.8);
    expect((req as unknown as Record<string, unknown>)['height']).toBeUndefined();
    // In advanced study, fixtures are generated on the frontend as free placements and req.grid is omitted
    expect(req.grid).toBeUndefined();
    expect(req.fixtures).toBeDefined();
    expect(req.fixtures?.length).toBe(8); // 4 x 2
    expect(req.fixtures?.[0].variantId).toBe('v-panel-600');
    expect(req.fixtures?.[0].z).toBe(2.8);
    expect(req.fixtures?.[0].tiltAngle).toBe(0);
    expect(req.variantId).toBe('v-panel-600');
    expect(req.floorZone).toBeUndefined();

    // Verify setting custom floorZone
    store.floorZone.set(0.3);
    const reqWithFz = store.buildCalculateRequest(false);
    expect(reqWithFz.floorZone).toBe(0.3);

    // Verify perimeter pattern layout
    store.fixturePattern.set('perimeter');
    store.perimeterWallOffset.set(1.0);
    store.perimeterSpacing.set(2.5);
    const perimReq = store.buildCalculateRequest(false);
    expect(perimReq.grid).toBeUndefined();
    expect(perimReq.fixtures?.length).toBeGreaterThan(0);
    // Fixtures should be positioned inside the room bounds
    for (const f of perimReq.fixtures ?? []) {
      expect(f.x).toBeGreaterThan(0);
      expect(f.x).toBeLessThan(10);
      expect(f.y).toBeGreaterThan(0);
      expect(f.y).toBeLessThan(6);
    }

    // Verify staggered pattern layout
    store.fixturePattern.set('staggered');
    const stagReq = store.buildCalculateRequest(false);
    expect(stagReq.grid).toBeUndefined();
    expect(stagReq.fixtures?.length).toBe(8);

    // Verify clearing floorZone sends undefined so backend defaults it
    store.floorZone.set(null);
    expect(store.buildCalculateRequest(false).floorZone).toBeUndefined();
  });

  it('supports custom polygon mode and templates', () => {
    store.setGeometryMode('polygon');
    store.applyPolygonTemplate('l-shape');

    expect(store.polygon().length).toBe(6);
    expect(store.isStep1Valid()).toBe(false);

    store.updateProject({
      projectName: 'L-Room Project',
      companyName: 'L Corp',
      clientName: 'Alice',
      clientPhone: '+1 555 987 6543',
      clientEmail: 'alice@example.com',
    });

    expect(store.isStep1Valid()).toBe(true);

    const req = store.buildCalculateRequest(false);
    expect(req.polygon.length).toBe(6);
    expect(req.polygon[0]).toEqual({ x: 0, y: 0 });
    expect(req.polygon[1]).toEqual({ x: 8, y: 0 });
  });


  it('manages interactive free fixtures and snapping', () => {
    const mockRes: Partial<CalculateResponse> = {
      fixtures: [
        {
          id: 'F1',
          position: { x: 2.0, y: 3.0, z: 2.8 },
          aimDirection: { x: 0, y: 0, z: -1 },
          rotation: 0,
          length: 0.6,
          width: 0.6,
          height: 0.1,
          corners: [],
          elements: [],
        },
      ],
      floorPatches: [],
      totalFloorIlluminance: { values: [], metadata: {} },
      evaluation: {
        average: 500,
        minimum: 400,
        maximum: 600,
        uniformity: 0.8,
        minPoint: { x: 0, y: 0, z: 0 },
        maxPoint: { x: 0, y: 0, z: 0 },
        nx: 1,
        ny: 1,
        spacingX: 1,
        spacingY: 1,
      },
    };

    store.setCalculationResult(mockRes as CalculateResponse, 'req-123');

    expect(store.viewMode()).toBe('studio');
    expect(store.freeFixtures().length).toBe(1);
    expect(store.freeFixtures()[0].id).toBe('F1');
    expect(store.isDirty()).toBe(false);

    // Move fixture smoothly (no snapping)
    store.moveFixture('F1', 2.37, 3.12);

    expect(store.freeFixtures()[0].x).toBe(2.37);
    expect(store.freeFixtures()[0].y).toBe(3.12);
    expect(store.isDirty()).toBe(true);

    // Add new fixture to the plan
    store.addFixtureAt();
    expect(store.freeFixtures().length).toBe(2);
    expect(store.freeFixtures()[1].id).toBe('F2');

    // Customize second fixture
    store.setFixtureVariant('F2', 'custom-panel-id');
    expect(store.freeFixtures()[1].variantId).toBe('custom-panel-id');
    expect(store.freeFixtures()[1].iesRef).toBeNull();

    // Tilt fixture
    store.updateFixture('F1', { tiltAngle: 30 });
    expect(store.freeFixtures()[0].tiltAngle).toBe(30);

    // Build request with free fixtures
    const freeReq = store.buildCalculateRequest(true);
    expect(freeReq.fixtures?.length).toBe(2);
    expect(freeReq.fixtures?.[0].x).toBe(2.37);
    expect(freeReq.fixtures?.[0].tiltAngle).toBe(30);
    expect(freeReq.fixtures?.[1].variantId).toBe('custom-panel-id');
    expect(freeReq.fixtures?.[1].tiltAngle).toBe(0);
    expect(freeReq.includeWallCeilingMatrices).toBe(true);
    expect(freeReq.grid).toBeUndefined();
  });
});
