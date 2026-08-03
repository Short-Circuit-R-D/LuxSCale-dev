export interface IesMetadata {
  [key: string]: string;
}

export interface IesPhotometricParams {
  numberOfLamps: number;
  lumensPerLamp: number;
  candelaMultiplier: number;
  verticalAngleCount: number;
  horizontalAngleCount: number;
  photometricType: number;
  unitsType: number;
  width: number;
  length: number;
  height: number;
}

export interface IesBallastData {
  ballastFactor: number;
  ballastLampFactor: number;
  inputWatts: number;
}

export interface IesData {
  metadata: IesMetadata;
  photometricParams: IesPhotometricParams;
  ballastData: IesBallastData;
  verticalAngles: number[];
  horizontalAngles: number[];
  candelaValues: number[][];
  symmetry: SymmetryResult;
}

export interface SymmetryResult {
  type: 'axial' | 'quadrilateral' | 'bilateral' | 'none';
  label: string;
  description: string;
  isAssumed: boolean;
}

export function parseIesFile(content: string): IesData {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  let lineIndex = 0;

  if (lines[lineIndex].startsWith('IESNA')) {
    lineIndex++;
  }

  const metadata: IesMetadata = {};
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
  const photometricParams: IesPhotometricParams = {
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
  const ballastData: IesBallastData = {
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

export function detectSymmetry(
  candelaValues: number[][],
  horizontalAngles: number[],
): SymmetryResult {
  const n = horizontalAngles.length;

  // Helper: compare two candela arrays within tolerance
  function matches(a: number[], b: number[], tol = 0.05): boolean {
    for (let v = 0; v < a.length; v++) {
      if (a[v] > 0 && Math.abs(a[v] - b[v]) / a[v] > tol) return false;
    }
    return true;
  }

  // 1. Axial: single C-plane → strictly axial per IES rule
  if (n <= 1) {
    return {
      type: 'axial',
      label: 'Axial Symmetry',
      description: 'Single C-plane detected. Full rotational symmetry assumed.',
      isAssumed: true,
    };
  }

  // 2. Axial: multiple planes but all identical → rotational symmetry confirmed
  const allMatch = candelaValues.every((cv) => matches(candelaValues[0], cv));
  if (allMatch) {
    return {
      type: 'axial',
      label: 'Axial Symmetry',
      description: `All ${n} C-plane(s) match within 5% tolerance. Full rotational symmetry confirmed.`,
      isAssumed: false,
    };
  }

  // Check if we have all 4 quadrant angles
  const hasC0 = horizontalAngles.includes(0);
  const hasC90 = horizontalAngles.includes(90);
  const hasC180 = horizontalAngles.includes(180);
  const hasC270 = horizontalAngles.includes(270);
  const hasFullQuadrants = hasC0 && hasC90 && hasC180 && hasC270;

  if (hasFullQuadrants) {
    const c0Data = candelaValues[horizontalAngles.indexOf(0)];
    const c90Data = candelaValues[horizontalAngles.indexOf(90)];
    const c180Data = candelaValues[horizontalAngles.indexOf(180)];
    const c270Data = candelaValues[horizontalAngles.indexOf(270)];

    // 3. Quadrilateral: all 4 cardinal planes match
    if (matches(c0Data, c90Data) && matches(c0Data, c180Data) && matches(c0Data, c270Data)) {
      return {
        type: 'quadrilateral',
        label: 'Quadrilateral Symmetry',
        description: 'All four C-planes match within 5% tolerance. Quadrilateral symmetry confirmed.',
        isAssumed: false,
      };
    }

    // 4. Bilateral: C0 matches C180 (front-back mirror), C90≠C270
    if (matches(c0Data, c180Data)) {
      return {
        type: 'bilateral',
        label: 'Bilateral Symmetry',
        description: 'C0 and C180 planes match within 5% tolerance. Bilateral symmetry confirmed.',
        isAssumed: false,
      };
    }

    // 5. No symmetry: all 4 present but differ
    return {
      type: 'none',
      label: 'No Symmetry',
      description: 'C-planes differ significantly. No symmetry detected.',
      isAssumed: false,
    };
  }

  // 6. Less than 4 planes without full quadrant coverage → quadrilateral assumed
  return {
    type: 'quadrilateral',
    label: 'Quadrilateral Symmetry',
    description: `Only ${n} C-plane(s) provided without full quadrant coverage. Quadrilateral symmetry assumed by mirroring.`,
    isAssumed: true,
  };
}

export function mirrorCandelaForSymmetry(
  candelaValues: number[][],
  horizontalAngles: number[],
  symmetry: SymmetryResult,
): { candelaValues: number[][]; horizontalAngles: number[] } {
  if (symmetry.type === 'none') {
    return { candelaValues, horizontalAngles };
  }

  if (symmetry.type === 'axial') {
    // Single C-plane - replicate to 4 quadrants for full polar display
    const c0 = candelaValues[0];
    return {
      candelaValues: [c0, [...c0], [...c0], [...c0]],
      horizontalAngles: [0, 90, 180, 270],
    };
  }

  if (symmetry.type === 'quadrilateral' && candelaValues.length < 4) {
    // Mirror single quadrant to fill all 4
    const c0 = candelaValues[0];
    return {
      candelaValues: [c0, [...c0], [...c0], [...c0]],
      horizontalAngles: [0, 90, 180, 270],
    };
  }

  if (symmetry.type === 'bilateral') {
    // Ensure we have C0 and C180
    if (candelaValues.length === 2) {
      return {
        candelaValues: [candelaValues[0], candelaValues[1]],
        horizontalAngles: [0, 180],
      };
    }
  }

  return { candelaValues, horizontalAngles };
}

export function getBeamAngle(
  candelaValues: number[],
  verticalAngles: number[],
): { beamAngle: number; leftAngle: number; rightAngle: number; peak: number; peakAngle: number } | null {
  if (candelaValues.length === 0) return null;

  const peak = Math.max(...candelaValues);
  if (peak === 0) return null;

  const halfMax = peak * 0.5;
  const peakIdx = candelaValues.indexOf(peak);
  const peakAngle = verticalAngles[peakIdx] ?? 0;

  // Scan left from peak
  let leftAngle = peakAngle;
  let hasLeft = false;
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (candelaValues[i] < halfMax) {
      const vLow = candelaValues[i];
      const vHigh = candelaValues[i + 1];
      const aLow = verticalAngles[i];
      const aHigh = verticalAngles[i + 1];
      leftAngle = aLow + ((halfMax - vLow) / (vHigh - vLow)) * (aHigh - aLow);
      hasLeft = true;
      break;
    }
  }
  if (!hasLeft) leftAngle = verticalAngles[0] ?? 0;

  // Scan right from peak
  let rightAngle = peakAngle;
  let hasRight = false;
  for (let i = peakIdx + 1; i < candelaValues.length; i++) {
    if (candelaValues[i] < halfMax) {
      const vHigh = candelaValues[i - 1];
      const vLow = candelaValues[i];
      const aHigh = verticalAngles[i - 1];
      const aLow = verticalAngles[i];
      rightAngle = aHigh + ((halfMax - vHigh) / (vLow - vHigh)) * (aLow - aHigh);
      hasRight = true;
      break;
    }
  }
  if (!hasRight) rightAngle = verticalAngles[verticalAngles.length - 1] ?? 0;

  // Peak at nadir: mirror right side for left
  if (peakAngle === 0 && !hasLeft && hasRight) {
    leftAngle = -rightAngle;
  }

  return {
    beamAngle: (peakAngle - leftAngle) + (rightAngle - peakAngle),
    leftAngle: peakAngle - leftAngle,
    rightAngle: rightAngle - peakAngle,
    peak,
    peakAngle,
  };
}

export function getFieldAngle(
  candelaValues: number[],
  verticalAngles: number[],
): { fieldAngle: number; leftAngle: number; rightAngle: number } | null {
  if (candelaValues.length === 0) return null;

  const peak = Math.max(...candelaValues);
  if (peak === 0) return null;

  const tenPercent = peak * 0.1;
  const peakIdx = candelaValues.indexOf(peak);
  const peakAngle = verticalAngles[peakIdx] ?? 0;

  // Scan left from peak
  let leftAngle = peakAngle;
  let hasLeft = false;
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (candelaValues[i] < tenPercent) {
      const vLow = candelaValues[i];
      const vHigh = candelaValues[i + 1];
      const aLow = verticalAngles[i];
      const aHigh = verticalAngles[i + 1];
      leftAngle = aLow + ((tenPercent - vLow) / (vHigh - vLow)) * (aHigh - aLow);
      hasLeft = true;
      break;
    }
  }
  if (!hasLeft) leftAngle = verticalAngles[0] ?? 0;

  // Scan right from peak
  let rightAngle = peakAngle;
  let hasRight = false;
  for (let i = peakIdx + 1; i < candelaValues.length; i++) {
    if (candelaValues[i] < tenPercent) {
      const vHigh = candelaValues[i - 1];
      const vLow = candelaValues[i];
      const aHigh = verticalAngles[i - 1];
      const aLow = verticalAngles[i];
      rightAngle = aHigh + ((tenPercent - vHigh) / (vLow - vHigh)) * (aLow - aHigh);
      hasRight = true;
      break;
    }
  }
  if (!hasRight) rightAngle = verticalAngles[verticalAngles.length - 1] ?? 0;

  // Peak at nadir: mirror right side for left
  if (peakAngle === 0 && !hasLeft && hasRight) {
    leftAngle = -rightAngle;
  }

  return {
    fieldAngle: (peakAngle - leftAngle) + (rightAngle - peakAngle),
    leftAngle: peakAngle - leftAngle,
    rightAngle: rightAngle - peakAngle,
  };
}
