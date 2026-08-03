import { describe, expect, it } from 'vitest';
import portfolioData from '@/data/portfolio.json';
import {
  filterProjects,
  getProjectHealth,
  resolveImprovementProject,
  validatePortfolio,
  type PortfolioData,
  type PortfolioProject,
} from '@/lib/portfolio';

const data = portfolioData as PortfolioData;

function makeProject(overrides: Partial<PortfolioProject> = {}): PortfolioProject {
  return {
    id: 'project-test',
    title: 'Test project',
    outcome: 'Produce a testable outcome.',
    problemOpportunity: 'The current state is not testable.',
    stage: 'Discovery',
    priority: 'unranked',
    horizon: 'Next',
    workstream: 'Test',
    team: 'Product & Innovation',
    sponsorIds: [],
    leadIds: [],
    collaboratorIds: [],
    nextAction: 'Verify the project source.',
    milestones: [],
    dependencyProjectIds: [],
    risks: [],
    sourceRefs: ['source-user-input-2026-07-17'],
    lastUpdated: '2026-07-17',
    verification: 'needs_verification',
    repoAliases: ['test-repo'],
    ...overrides,
  };
}

describe('portfolio dataset validation', () => {
  it('accepts the checked-in representative portfolio data', () => {
    expect(validatePortfolio(data)).toEqual([]);
  });

  it('rejects duplicate IDs, missing project fields, and broken references', () => {
    const broken = structuredClone(data);
    broken.projects.push({
      ...broken.projects[0],
      title: '',
      sourceRefs: ['source-missing'],
      dependencyProjectIds: ['project-missing'],
    });
    broken.features[0].parentProjectId = 'project-missing';
    broken.features[0].dependencyFeatureIds = ['feature-missing'];
    broken.features[0].title = '';
    broken.rawIdeas[0].summary = '';
    broken.decisions[0].summary = '';
    broken.sources[0].reference = '';

    const errors = validatePortfolio(broken);

    expect(errors).toContain(`Duplicate ID: ${broken.projects[0].id}`);
    expect(errors).toContain(`Project ${broken.projects[0].id} is missing title`);
    expect(errors).toContain(`Project ${broken.projects[0].id} references unknown source source-missing`);
    expect(errors).toContain(`Project ${broken.projects[0].id} depends on unknown project project-missing`);
    expect(errors).toContain(`Feature ${broken.features[0].id} has unknown parent project project-missing`);
    expect(errors).toContain(`Feature ${broken.features[0].id} depends on unknown feature feature-missing`);
    expect(errors).toContain(`Feature ${broken.features[0].id} is missing title`);
    expect(errors).toContain(`Raw idea ${broken.rawIdeas[0].id} is missing summary`);
    expect(errors).toContain(`Decision ${broken.decisions[0].id} is missing summary`);
    expect(errors).toContain(`Source ${broken.sources[0].id} is missing reference`);
  });
});

describe('portfolio health and filtering', () => {
  it('flags missing owners, blocked projects, stale records, and untriaged intake', () => {
    const project = makeProject({
      stage: 'Blocked',
      nextAction: '',
      lastUpdated: '2026-05-01',
    });
    const health = getProjectHealth(project, data, new Date('2026-07-17T12:00:00Z'));

    expect(health).toEqual(expect.arrayContaining([
      'missing_owner',
      'missing_next_action',
      'blocked',
      'stale',
    ]));
    expect(getProjectHealth(data.projects[0], data)).toContain('untriaged_idea');
  });

  it('filters by search, owner, team, priority, stage, workstream, and horizon', () => {
    const projects = [
      makeProject({
        id: 'project-a',
        title: 'Alpha historian',
        leadIds: ['person-a'],
        team: 'Clinical AI',
        priority: 'P1',
        stage: 'Active',
        workstream: 'Clinical workflow',
        horizon: 'Now',
      }),
      makeProject({ id: 'project-b', title: 'Beta platform' }),
    ];

    expect(filterProjects(projects, {
      search: 'historian',
      ownerId: 'person-a',
      team: 'Clinical AI',
      priority: 'P1',
      stage: 'Active',
      workstream: 'Clinical workflow',
      horizon: 'Now',
    }).map((project) => project.id)).toEqual(['project-a']);
  });
});

describe('improvement queue linkage', () => {
  it('prefers an explicit parent project link', () => {
    const linked = resolveImprovementProject(
      { parentProjectId: data.projects[0].id, repoName: 'unrelated-repo' },
      data,
    );

    expect(linked).toMatchObject({ project: { id: data.projects[0].id }, method: 'explicit' });
  });

  it('uses a declared repo alias as a backwards-compatible link', () => {
    const project = data.projects.find((item) => item.repoAliases.includes('OPSAmplehtml'));
    expect(project).toBeDefined();

    const linked = resolveImprovementProject({ repoName: 'OPSAmplehtml' }, data);

    expect(linked).toMatchObject({ project: { id: project!.id }, method: 'repo_alias' });
  });

  it('leaves unknown and invalid explicit links visibly unlinked', () => {
    expect(resolveImprovementProject({ repoName: 'unknown-repo' }, data)).toBeNull();
    expect(resolveImprovementProject({ parentProjectId: 'project-missing' }, data)).toBeNull();
  });
});
