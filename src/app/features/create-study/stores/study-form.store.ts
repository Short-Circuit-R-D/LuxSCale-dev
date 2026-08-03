import { computed, signal } from '@angular/core';

export interface ProjectDefinition {
  projectName: string;
  companyName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
}

export interface TechnicalSpecs {
  width1: number | null;
  length1: number | null;
  width2: number | null;
  length2: number | null;
  ceilingHeight: number | null;
  mountingHeight: number | null;
  standardCategory: string;
  taskOrActivity: string;
}

export interface StudyFormState {
  currentStep: number;
  project: ProjectDefinition;
  technical: TechnicalSpecs;
}

const INITIAL_PROJECT: ProjectDefinition = {
  projectName: '',
  companyName: '',
  clientName: '',
  clientPhone: '',
  clientEmail: '',
};

const INITIAL_TECHNICAL: TechnicalSpecs = {
  width1: null,
  length1: null,
  width2: null,
  length2: null,
  ceilingHeight: null,
  mountingHeight: null,
  standardCategory: '',
  taskOrActivity: '',
};

export function createStudyStore() {
  const currentStep = signal(1);
  const project = signal<ProjectDefinition>({ ...INITIAL_PROJECT });
  const technical = signal<TechnicalSpecs>({ ...INITIAL_TECHNICAL });

  const isFirstStep = computed(() => currentStep() === 1);
  const isLastStep = computed(() => currentStep() === 2);

  function updateProject(data: Partial<ProjectDefinition>) {
    project.update((prev) => ({ ...prev, ...data }));
  }

  function updateTechnical(data: Partial<TechnicalSpecs>) {
    technical.update((prev) => ({ ...prev, ...data }));
  }

  function nextStep() {
    if (currentStep() < 2) {
      currentStep.update((s) => s + 1);
    }
  }

  function prevStep() {
    if (currentStep() > 1) {
      currentStep.update((s) => s - 1);
    }
  }

  function goToStep(step: number) {
    if (step >= 1 && step <= 2) {
      currentStep.set(step);
    }
  }

  function discard() {
    currentStep.set(1);
    project.set({ ...INITIAL_PROJECT });
    technical.set({ ...INITIAL_TECHNICAL });
  }

  function submit() {
    const data = {
      ...project(),
      ...technical(),
    };
    console.log('Study submitted:', data);
  }

  return {
    currentStep,
    project,
    technical,
    isFirstStep,
    isLastStep,
    updateProject,
    updateTechnical,
    nextStep,
    prevStep,
    goToStep,
    discard,
    submit,
  };
}
