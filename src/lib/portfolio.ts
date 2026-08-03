export type PortfolioStage =
  | 'Intake'
  | 'Discovery'
  | 'Planned'
  | 'Active'
  | 'Blocked'
  | 'Validation'
  | 'Done'
  | 'Parked';

export type PortfolioPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'unranked';
export type PlanningHorizon = 'Now' | 'Next' | 'Later';
export type VerificationState = 'verified' | 'partially_verified' | 'needs_verification';
export type Disposition =
  | 'created'
  | 'merged'
  | 'deferred'
  | 'duplicate'
  | 'needs_decision'
  | 'excluded';

export interface PortfolioSource {
  id: string;
  title: string;
  sourceType: 'drive_transcript' | 'user_input' | 'repository_audit' | 'email';
  reference: string;
  sourceDate: string;
  accessedDate: string;
  verification: VerificationState;
  notes: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  outcome: string;
  problemOpportunity: string;
  stage: PortfolioStage;
  priority: PortfolioPriority;
  horizon: PlanningHorizon;
  workstream: string;
  team: string;
  sponsorIds: string[];
  leadIds: string[];
  collaboratorIds: string[];
  nextAction: string;
  milestones: Array<{ id: string; title: string; targetDate: string | null; status: string }>;
  dependencyProjectIds: string[];
  risks: string[];
  sourceRefs: string[];
  lastUpdated: string;
  verification: VerificationState;
  repoAliases: string[];
}

export interface PortfolioFeature {
  id: string;
  parentProjectId: string;
  title: string;
  problemUserNeed: string;
  scopeValue: string;
  stage: PortfolioStage;
  ownerIds: string[];
  dependencyFeatureIds: string[];
  acceptanceCriteria: string[];
  sourceRefs: string[];
  verification: VerificationState;
  disposition: Disposition;
  lastUpdated: string;
}

export interface RawIdea {
  id: string;
  summary: string;
  sourceRefs: string[];
  receivedDate: string;
  triageStatus: 'untriaged' | 'triaged';
  destinationProjectId: string | null;
  destinationFeatureId: string | null;
  disposition: Disposition;
  rationale: string;
  verification: VerificationState;
  unresolvedQuestion: string;
}

export interface PortfolioDecision {
  id: string;
  date: string;
  summary: string;
  rationale: string;
  relatedProjectIds: string[];
  relatedFeatureIds: string[];
  relatedPersonIds: string[];
  sourceRefs: string[];
  verification: VerificationState;
}

export interface PortfolioData {
  schemaVersion: string;
  sources: PortfolioSource[];
  projects: PortfolioProject[];
  features: PortfolioFeature[];
  rawIdeas: RawIdea[];
  decisions: PortfolioDecision[];
}

export interface ProjectFilters {
  search?: string;
  ownerId?: string;
  team?: string;
  priority?: PortfolioPriority | '';
  stage?: PortfolioStage | '';
  workstream?: string;
  horizon?: PlanningHorizon | '';
}

const PROJECT_REQUIRED_FIELDS: Array<keyof PortfolioProject> = [
  'id',
  'title',
  'outcome',
  'problemOpportunity',
  'stage',
  'priority',
  'horizon',
  'workstream',
  'team',
  'nextAction',
  'lastUpdated',
  'verification',
  'sourceRefs',
];

const FEATURE_REQUIRED_FIELDS: Array<keyof PortfolioFeature> = [
  'id', 'parentProjectId', 'title', 'problemUserNeed', 'scopeValue', 'stage',
  'acceptanceCriteria', 'sourceRefs', 'verification', 'disposition', 'lastUpdated',
];

const RAW_IDEA_REQUIRED_FIELDS: Array<keyof RawIdea> = [
  'id', 'summary', 'sourceRefs', 'receivedDate', 'triageStatus', 'disposition',
  'rationale', 'verification', 'unresolvedQuestion',
];

const DECISION_REQUIRED_FIELDS: Array<keyof PortfolioDecision> = [
  'id', 'date', 'summary', 'rationale', 'sourceRefs', 'verification',
];

const SOURCE_REQUIRED_FIELDS: Array<keyof PortfolioSource> = [
  'id', 'title', 'sourceType', 'reference', 'sourceDate', 'accessedDate',
  'verification', 'notes',
];

function isMissing(value: unknown): boolean {
  return value === '' || value === null || value === undefined
    || (Array.isArray(value) && value.length === 0);
}

function checkRequired<T extends { id: string }>(
  kind: string,
  record: T,
  fields: Array<keyof T>,
  errors: string[],
) {
  for (const field of fields) {
    if (isMissing(record[field])) errors.push(`${kind} ${record.id} is missing ${String(field)}`);
  }
}

function duplicateIds(data: PortfolioData): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const records = [
    ...data.sources,
    ...data.projects,
    ...data.features,
    ...data.rawIdeas,
    ...data.decisions,
  ];
  for (const record of records) {
    if (seen.has(record.id)) duplicates.add(record.id);
    seen.add(record.id);
  }
  return [...duplicates].map((id) => `Duplicate ID: ${id}`);
}

export function validatePortfolio(data: PortfolioData): string[] {
  const errors = duplicateIds(data);
  const sourceIds = new Set(data.sources.map((source) => source.id));
  const projectIds = new Set(data.projects.map((project) => project.id));
  const featureIds = new Set(data.features.map((feature) => feature.id));

  for (const source of data.sources) checkRequired('Source', source, SOURCE_REQUIRED_FIELDS, errors);

  const checkSources = (kind: string, id: string, refs: string[]) => {
    for (const ref of refs) {
      if (!sourceIds.has(ref)) errors.push(`${kind} ${id} references unknown source ${ref}`);
    }
  };

  for (const project of data.projects) {
    checkRequired('Project', project, PROJECT_REQUIRED_FIELDS, errors);
    checkSources('Project', project.id, project.sourceRefs);
    for (const dependencyId of project.dependencyProjectIds) {
      if (!projectIds.has(dependencyId)) {
        errors.push(`Project ${project.id} depends on unknown project ${dependencyId}`);
      }
    }
  }

  for (const feature of data.features) {
    checkRequired('Feature', feature, FEATURE_REQUIRED_FIELDS, errors);
    if (!projectIds.has(feature.parentProjectId)) {
      errors.push(`Feature ${feature.id} has unknown parent project ${feature.parentProjectId}`);
    }
    checkSources('Feature', feature.id, feature.sourceRefs);
    for (const dependencyId of feature.dependencyFeatureIds) {
      if (!featureIds.has(dependencyId)) {
        errors.push(`Feature ${feature.id} depends on unknown feature ${dependencyId}`);
      }
    }
  }

  for (const idea of data.rawIdeas) {
    checkRequired('Raw idea', idea, RAW_IDEA_REQUIRED_FIELDS, errors);
    checkSources('Raw idea', idea.id, idea.sourceRefs);
    if (idea.destinationProjectId && !projectIds.has(idea.destinationProjectId)) {
      errors.push(`Raw idea ${idea.id} references unknown project ${idea.destinationProjectId}`);
    }
    if (idea.destinationFeatureId && !featureIds.has(idea.destinationFeatureId)) {
      errors.push(`Raw idea ${idea.id} references unknown feature ${idea.destinationFeatureId}`);
    }
  }

  for (const decision of data.decisions) {
    checkRequired('Decision', decision, DECISION_REQUIRED_FIELDS, errors);
    checkSources('Decision', decision.id, decision.sourceRefs);
    for (const projectId of decision.relatedProjectIds) {
      if (!projectIds.has(projectId)) errors.push(`Decision ${decision.id} references unknown project ${projectId}`);
    }
    for (const featureId of decision.relatedFeatureIds) {
      if (!featureIds.has(featureId)) errors.push(`Decision ${decision.id} references unknown feature ${featureId}`);
    }
  }

  return errors;
}

export type ProjectHealthFlag =
  | 'missing_owner'
  | 'missing_next_action'
  | 'blocked'
  | 'stale'
  | 'untriaged_idea'
  | 'needs_verification';

export function getProjectHealth(
  project: PortfolioProject,
  data: Pick<PortfolioData, 'rawIdeas'>,
  now = new Date(),
): ProjectHealthFlag[] {
  const flags: ProjectHealthFlag[] = [];
  if (project.leadIds.length === 0) flags.push('missing_owner');
  if (!project.nextAction.trim()) flags.push('missing_next_action');
  if (project.stage === 'Blocked') flags.push('blocked');

  const lastUpdated = new Date(`${project.lastUpdated}T00:00:00Z`);
  const ageInDays = (now.getTime() - lastUpdated.getTime()) / 86_400_000;
  if (Number.isFinite(ageInDays) && ageInDays > 30) flags.push('stale');
  if (data.rawIdeas.some((idea) => idea.destinationProjectId === project.id && idea.triageStatus === 'untriaged')) {
    flags.push('untriaged_idea');
  }
  if (project.verification !== 'verified') flags.push('needs_verification');
  return flags;
}

export function filterProjects(projects: PortfolioProject[], filters: ProjectFilters): PortfolioProject[] {
  const query = filters.search?.trim().toLocaleLowerCase();
  return projects.filter((project) => {
    const owners = [...project.sponsorIds, ...project.leadIds, ...project.collaboratorIds];
    if (query) {
      const searchable = [
        project.title,
        project.outcome,
        project.problemOpportunity,
        project.nextAction,
        project.workstream,
      ].join(' ').toLocaleLowerCase();
      if (!searchable.includes(query)) return false;
    }
    if (filters.ownerId && !owners.includes(filters.ownerId)) return false;
    if (filters.team && project.team !== filters.team) return false;
    if (filters.priority && project.priority !== filters.priority) return false;
    if (filters.stage && project.stage !== filters.stage) return false;
    if (filters.workstream && project.workstream !== filters.workstream) return false;
    if (filters.horizon && project.horizon !== filters.horizon) return false;
    return true;
  });
}

export interface ImprovementLinkInput {
  parentProjectId?: string;
  repoName?: string;
}

export function resolveImprovementProject(
  improvement: ImprovementLinkInput,
  data: Pick<PortfolioData, 'projects'>,
): { project: PortfolioProject; method: 'explicit' | 'repo_alias' } | null {
  if (improvement.parentProjectId) {
    const project = data.projects.find((item) => item.id === improvement.parentProjectId);
    return project ? { project, method: 'explicit' } : null;
  }
  if (!improvement.repoName) return null;
  const repoName = improvement.repoName.toLocaleLowerCase();
  const matches = data.projects.filter((project) =>
    project.repoAliases.some((alias) => alias.toLocaleLowerCase() === repoName),
  );
  return matches.length === 1 ? { project: matches[0], method: 'repo_alias' } : null;
}
