import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LUXSCALE_BACKEND_BASE_URL } from '../../common/tokens';
import { CalculateApi } from './calculate.api';
import type { CalculateRequest } from '../dtos/calculate-request.dto';
import type { CalculateResponse } from '../dtos/calculate-response.dto';

describe('CalculateApi', () => {
  let api: CalculateApi;
  let httpTesting: HttpTestingController;

  const mockResponse: Partial<CalculateResponse> = {
    bounces: 3,
    fixtures: [],
    floorPatches: [],
    totalFloorIlluminance: { values: [300, 320], metadata: {} },
    evaluation: {
      average: 310,
      minimum: 280,
      maximum: 340,
      uniformity: 0.9,
      minPoint: { x: 1, y: 1, z: 0.8 },
      maxPoint: { x: 3, y: 3, z: 0.8 },
      nx: 2,
      ny: 1,
      spacingX: 1,
      spacingY: 1,
    },
    compliance: {
      compliant: true,
      targetLux: 300,
      targetUniformity: 0.6,
      luxGap: 10,
      uniformityGap: 0.3,
      overdesign: 0.03,
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CalculateApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LUXSCALE_BACKEND_BASE_URL, useValue: 'http://localhost:8000' },
      ],
    });

    api = TestBed.inject(CalculateApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('sends POST /calculate with JSON body', () => {
    const req: CalculateRequest = {
      polygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
      ceilingHeight: 3.0,
      mountingHeight: 2.8,
      grid: {
        count: { countX: 2, countY: 2, offsetFraction: 0.5 },
      },
      variantIds: ['v1'],
    };

    api.calculate(req).subscribe((res) => {
      expect(res.data.evaluation.average).toBe(310);
      expect(res.requestId).toBe('test-req-id');
    });

    const testReq = httpTesting.expectOne('http://localhost:8000/calculate');
    expect(testReq.request.method).toBe('POST');
    expect(testReq.request.body).toEqual(req);
    testReq.flush(mockResponse, {
      headers: { 'X-Request-ID': 'test-req-id' },
    });
  });

  it('sends POST /calculate with multipart/form-data for ies upload', () => {
    const req: CalculateRequest = {
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      ceilingHeight: 3.0,
      mountingHeight: 2.8,
      grid: {
        count: { countX: 1, countY: 1 },
      },
    };

    const dummyBlob = new Blob(['IESNA:LM-63-2002\nTILT=NONE\n'], { type: 'text/plain' });

    api.calculateMultipart(req, dummyBlob).subscribe((res) => {
      expect(res.data.compliance?.compliant).toBe(true);
    });

    const testReq = httpTesting.expectOne('http://localhost:8000/calculate');
    expect(testReq.request.method).toBe('POST');
    expect(testReq.request.body instanceof FormData).toBe(true);
    testReq.flush(mockResponse);
  });
});
