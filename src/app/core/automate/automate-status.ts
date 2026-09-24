import type {
  AutomateMissReasonDto,
  AutomateResponseDto,
} from './dtos/automate-response.dto';

/** UI status lines from `automate-api.md` §3. */
export type AutomateStatusKind = 'solutions' | 'flagged-only' | 'empty-miss' | 'empty-none';

export interface AutomateStatusLine {
  kind: AutomateStatusKind;
  title: string;
  hint: string;
}

export function automateStatusFor(response: AutomateResponseDto): AutomateStatusLine {
  const recommended = response.solutions.filter((s) => s.recommended);
  if (recommended.length > 0) {
    return {
      kind: 'solutions',
      title: `${recommended.length} compliant solution${recommended.length === 1 ? '' : 's'}`,
      hint: 'Best = first recommended entry; the rest are alternatives.',
    };
  }
  if (response.solutions.length > 0) {
    return {
      kind: 'flagged-only',
      title: 'No compliant layout',
      hint: 'Closest options exceed the cap. Lower the target, allow more overdesign, or add dimmer variants.',
    };
  }
  if (response.closestMiss) {
    return { kind: 'empty-miss', ...missReasonCopy(response.closestMiss.missReason) };
  }
  return {
    kind: 'empty-none',
    title: 'Nothing viable',
    hint: 'Widen spacing steps or relax constraints.',
  };
}

function missReasonCopy(reason: AutomateMissReasonDto | null): Pick<AutomateStatusLine, 'title' | 'hint'> {
  switch (reason) {
    case 'under_target':
      return {
        title: 'Closest miss: under target',
        hint: 'Needs more or better-distributed light.',
      };
    case 'over_cap':
      return {
        title: 'Closest miss: over cap',
        hint: 'Smallest layouts are already too bright — dimmer variants needed.',
      };
    case 'uniformity':
      return {
        title: 'Closest miss: patchy uniformity',
        hint: 'Average is OK but patchy — a denser grid is needed.',
      };
    default:
      return { title: 'Closest miss', hint: 'See miss details.' };
  }
}
