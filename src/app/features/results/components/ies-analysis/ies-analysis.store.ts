import { computed, signal } from '@angular/core';
import {
  IesData,
  SymmetryResult,
  getBeamAngle,
  getFieldAngle,
  mirrorCandelaForSymmetry,
} from '../../../../services/ies-parser';

export function createIesStore() {
  const iesData = signal<IesData | null>(null);
  const selectedCAngleIndex = signal(0);

  const mirroredData = computed(() => {
    const data = iesData();
    if (!data) return null;
    return mirrorCandelaForSymmetry(
      data.candelaValues,
      data.horizontalAngles,
      data.symmetry,
    );
  });

  const selectedCData = computed(() => {
    const mirrored = mirroredData();
    if (!mirrored) return null;
    const idx = selectedCAngleIndex();
    return mirrored.candelaValues[idx] ?? null;
  });

  const selectedCAngle = computed(() => {
    const mirrored = mirroredData();
    if (!mirrored) return 0;
    return mirrored.horizontalAngles[selectedCAngleIndex()] ?? 0;
  });

  const peakCandela = computed(() => {
    const values = selectedCData();
    const data = iesData();
    if (!values || !data || values.length === 0) return null;
    const peak = Math.max(...values);
    const idx = values.indexOf(peak);
    const angle = data.verticalAngles[idx] ?? 0;
    return { value: peak, angle };
  });

  const beamAngleData = computed(() => {
    const values = selectedCData();
    const data = iesData();
    if (!values || !data) return null;
    return getBeamAngle(values, data.verticalAngles);
  });

  const fieldAngleData = computed(() => {
    const values = selectedCData();
    const data = iesData();
    if (!values || !data) return null;
    return getFieldAngle(values, data.verticalAngles);
  });

  const symmetryData = computed(() => {
    const data = iesData();
    if (!data) return null;
    return data.symmetry;
  });

  const maxCandela = computed(() => {
    const data = iesData();
    if (!data) return 0;
    let max = 0;
    for (const row of data.candelaValues) {
      for (const val of row) {
        if (val > max) max = val;
      }
    }
    return max;
  });

  function loadIes(content: string) {
    const parsed = parseIesFile(content);
    iesData.set(parsed);
    selectedCAngleIndex.set(0);
  }

  function selectCAngle(index: number) {
    selectedCAngleIndex.set(index);
  }

  return {
    iesData,
    mirroredData,
    selectedCAngleIndex,
    selectedCData,
    selectedCAngle,
    peakCandela,
    beamAngleData,
    fieldAngleData,
    symmetryData,
    maxCandela,
    loadIes,
    selectCAngle,
  };
}

function parseIesFile(content: string): IesData {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  let lineIndex = 0;

  if (lines[lineIndex].startsWith('IESNA')) {
    lineIndex++;
  }

  const metadata: Record<string, string> = {};
  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim();
    const keywordMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (keywordMatch) {
      metadata[keywordMatch[1]] = keywordMatch[2].trim();
      lineIndex++;
    } else {
      break;
    }
  }

  while (lineIndex < lines.length && !lines[lineIndex].startsWith('TILT=')) {
    lineIndex++;
  }
  lineIndex++;

  const photometricLine = lines[lineIndex++].trim().split(/\s+/);
  const photometricParams = {
    numberOfLamps: parseInt(photometricLine[0], 10),
    lumensPerLamp: parseFloat(photometricLine[1]),
    candelaMultiplier: parseFloat(photometricLine[2]),
    verticalAngleCount: parseInt(photometricLine[3], 10),
    horizontalAngleCount: parseInt(photometricLine[4], 10),
    photometricType: parseInt(photometricLine[5], 10) || 1,
    unitsType: parseInt(photometricLine[6], 10) || 1,
    width: parseFloat(photometricLine[7]) || 0,
    length: parseFloat(photometricLine[8]) || 0,
    height: parseFloat(photometricLine[9]) || 0,
  };

  const ballastLine = lines[lineIndex++].trim().split(/\s+/);
  const ballastData = {
    ballastFactor: parseFloat(ballastLine[0]) || 1.0,
    ballastLampFactor: parseFloat(ballastLine[1]) || 1.0,
    inputWatts: parseFloat(ballastLine[2]) || 0,
  };

  const verticalAngles: number[] = [];
  while (
    verticalAngles.length < photometricParams.verticalAngleCount &&
    lineIndex < lines.length
  ) {
    const tokens = lines[lineIndex++].trim().split(/\s+/);
    for (const token of tokens) {
      if (verticalAngles.length < photometricParams.verticalAngleCount) {
        verticalAngles.push(parseFloat(token));
      }
    }
  }

  const horizontalAngles: number[] = [];
  while (
    horizontalAngles.length < photometricParams.horizontalAngleCount &&
    lineIndex < lines.length
  ) {
    const tokens = lines[lineIndex++].trim().split(/\s+/);
    for (const token of tokens) {
      if (horizontalAngles.length < photometricParams.horizontalAngleCount) {
        horizontalAngles.push(parseFloat(token));
      }
    }
  }

  const totalValues =
    photometricParams.verticalAngleCount * photometricParams.horizontalAngleCount;
  const allCandela: number[] = [];
  while (allCandela.length < totalValues && lineIndex < lines.length) {
    const tokens = lines[lineIndex++].trim().split(/\s+/);
    for (const token of tokens) {
      if (allCandela.length < totalValues) {
        allCandela.push(parseFloat(token) * photometricParams.candelaMultiplier);
      }
    }
  }

  const candelaValues: number[][] = [];
  for (let h = 0; h < photometricParams.horizontalAngleCount; h++) {
    const start = h * photometricParams.verticalAngleCount;
    candelaValues.push(allCandela.slice(start, start + photometricParams.verticalAngleCount));
  }

  const symmetry = detectSymmetry(candelaValues, horizontalAngles);

  return {
    metadata,
    photometricParams,
    ballastData,
    verticalAngles,
    horizontalAngles,
    candelaValues,
    symmetry,
  };
}

function detectSymmetry(
  candelaValues: number[][],
  horizontalAngles: number[],
): SymmetryResult {
  const n = horizontalAngles.length;

  if (n <= 1) {
    return {
      type: 'axial',
      label: 'Axial Symmetry',
      description: 'Single C-plane detected. Full rotational symmetry assumed.',
      isAssumed: true,
    };
  }

  if (n === 2) {
    const c0 = candelaValues[0];
    const cOther = candelaValues[1];
    let isMatch = true;
    for (let v = 0; v < c0.length; v++) {
      if (c0[v] > 0 && Math.abs(c0[v] - cOther[v]) / c0[v] > 0.05) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      return {
        type: 'bilateral',
        label: 'Bilateral Symmetry',
        description: 'Two identical C-planes detected. Bilateral symmetry confirmed.',
        isAssumed: false,
      };
    }
    return {
      type: 'none',
      label: 'No Symmetry',
      description: 'Two C-planes differ significantly. No symmetry detected.',
      isAssumed: false,
    };
  }

  const hasC0 = horizontalAngles.includes(0);
  const hasC90 = horizontalAngles.includes(90);
  const hasC180 = horizontalAngles.includes(180);
  const hasC270 = horizontalAngles.includes(270);
  const hasFullQuadrants = hasC0 && hasC90 && hasC180 && hasC270;

  if (!hasFullQuadrants) {
    return {
      type: 'quadrilateral',
      label: 'Quadrilateral Symmetry',
      description: `Only ${n} C-plane(s) provided without full quadrant coverage. Quadrilateral symmetry assumed by mirroring.`,
      isAssumed: true,
    };
  }

  const c0Data = candelaValues[horizontalAngles.indexOf(0)];
  const c90Data = candelaValues[horizontalAngles.indexOf(90)];
  const c180Data = candelaValues[horizontalAngles.indexOf(180)];
  const c270Data = candelaValues[horizontalAngles.indexOf(270)];

  let isQuadrilateral = true;
  for (const quadData of [c90Data, c180Data, c270Data]) {
    for (let v = 0; v < c0Data.length; v++) {
      if (c0Data[v] > 0 && Math.abs(c0Data[v] - quadData[v]) / c0Data[v] > 0.05) {
        isQuadrilateral = false;
        break;
      }
    }
    if (!isQuadrilateral) break;
  }

  if (isQuadrilateral) {
    return {
      type: 'quadrilateral',
      label: 'Quadrilateral Symmetry',
      description: 'All four C-planes match within 5% tolerance. Quadrilateral symmetry confirmed.',
      isAssumed: false,
    };
  }

  let isBilateral = true;
  for (let v = 0; v < c0Data.length; v++) {
    if (c0Data[v] > 0 && Math.abs(c0Data[v] - c180Data[v]) / c0Data[v] > 0.05) {
      isBilateral = false;
      break;
    }
  }

  if (isBilateral) {
    return {
      type: 'bilateral',
      label: 'Bilateral Symmetry',
      description: 'C0 and C180 planes match within 5% tolerance. Bilateral symmetry confirmed.',
      isAssumed: false,
    };
  }

  return {
    type: 'none',
    label: 'No Symmetry',
    description: 'C-planes differ significantly. No symmetry detected.',
    isAssumed: false,
  };
}
