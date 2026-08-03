'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  filterProjects,
  getProjectHealth,
  type PlanningHorizon,
  type PortfolioData,
  type PortfolioProject,
  type PortfolioStage,
  type ProjectFilters,
  type ProjectHealthFlag,
} from '@/lib/portfolio';
import styles from './PortfolioBoard.module.css';

const STAGES: PortfolioStage[] = [
  'Intake',
  'Discovery',
  'Planned',
  'Active',
  'Blocked',
  'Validation',
  'Done',
  'Parked',
];

const HEALTH_LABELS: Record<ProjectHealthFlag, string> = {
  missing_owner: 'Missing owner',
  missing_next_action: 'Missing next action',
  blocked: 'Blocked',
  stale: 'Stale',
  untriaged_idea: 'Untriaged idea',
  needs_verification: 'Needs verification',
};

function healthClass(flag: ProjectHealthFlag) {
  if (flag === 'blocked' || flag === 'missing_next_action') return `${styles.badge} ${styles.danger}`;
  if (flag === 'needs_verification' || flag === 'untriaged_idea' || flag === 'stale') {
    return `${styles.badge} ${styles.warning}`;
  }
  return styles.badge;
}

function ProjectDetail({ project, data }: { project: PortfolioProject; data: PortfolioData }) {
  const features = data.features.filter((feature) => feature.parentProjectId === project.id);
  const decisions = data.decisions.filter((decision) => decision.relatedProjectIds.includes(project.id));
  const sources = project.sourceRefs
    .map((sourceId) => data.sources.find((source) => source.id === sourceId))
    .filter((source): source is PortfolioData['sources'][number] => Boolean(source));
  const dependencies = project.dependencyProjectIds
    .map((projectId) => data.projects.find((candidate) => candidate.id === projectId))
    .filter((candidate): candidate is PortfolioProject => Boolean(candidate));
  const health = getProjectHealth(project, data);

  return (
    <aside className={styles.detail} data-testid="project-detail" aria-label={`${project.title} detail`}>
      <h2 className={styles.detailTitle}>{project.title}</h2>
      <p className={styles.detailOutcome}>{project.outcome}</p>
      <div className={styles.meta}>
        <span className={`${styles.badge} ${styles.info}`}>{project.stage}</span>
        <span className={styles.badge}>{project.priority}</span>
        <span className={styles.badge}>{project.horizon}</span>
        {health.map((flag) => <span key={flag} className={healthClass(flag)}>{HEALTH_LABELS[flag]}</span>)}
      </div>

      <section className={styles.detailSection}>
        <div className={styles.detailGrid}>
          <div><span className={styles.detailLabel}>Workstream</span><span className={styles.detailValue}>{project.workstream}</span></div>
          <div><span className={styles.detailLabel}>Team</span><span className={styles.detailValue}>{project.team}</span></div>
          <div><span className={styles.detailLabel}>Lead</span><span className={styles.detailValue}>{project.leadIds.join(', ') || 'Unassigned'}</span></div>
          <div><span className={styles.detailLabel}>Last updated</span><span className={styles.detailValue}>{project.lastUpdated}</span></div>
        </div>
      </section>

      <section className={styles.detailSection}>
        <h3>Problem / opportunity</h3>
        <p>{project.problemOpportunity}</p>
      </section>

      <section className={styles.detailSection}>
        <h3>Next action</h3>
        <p>{project.nextAction || 'Not defined'}</p>
      </section>

      <section className={styles.detailSection}>
        <h3>Dependencies and risks</h3>
        {dependencies.length > 0 ? <ul>{dependencies.map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p>No project dependencies recorded.</p>}
        {project.risks.length > 0 ? <ul>{project.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : null}
      </section>

      <section className={styles.detailSection}>
        <h3>Features / initiatives</h3>
        {features.length > 0 ? features.map((feature) => (
          <article key={feature.id} className={styles.feature}>
            <div className={styles.featureTitle}>{feature.title}</div>
            <div className={styles.meta}>
              <span className={`${styles.badge} ${styles.info}`}>Feature</span>
              <span className={styles.badge}>{feature.stage}</span>
              <span className={styles.badge}>{feature.disposition}</span>
            </div>
            <p>{feature.scopeValue}</p>
          </article>
        )) : <p>No linked features recorded.</p>}
      </section>

      <section className={styles.detailSection}>
        <h3>Decision history</h3>
        {decisions.length > 0 ? <ul>{decisions.map((decision) => <li key={decision.id}>{decision.date}: {decision.summary}</li>)}</ul> : <p>No decisions logged for this project.</p>}
      </section>

      <section className={styles.detailSection}>
        <h3>Sources and verification</h3>
        <ul>
          {sources.map((source) => (
            <li key={source.id}>
              {source.reference.startsWith('https://') ? <a className={styles.sourceLink} href={source.reference} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
              {' — '}{source.verification.replaceAll('_', ' ')}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function PortfolioBoard({ data, initialProjectId = null }: { data: PortfolioData; initialProjectId?: string | null }) {
  const [filters, setFilters] = useState<ProjectFilters>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() =>
    data.projects.some((project) => project.id === initialProjectId) ? initialProjectId : null,
  );
  const projects = useMemo(() => filterProjects(data.projects, filters), [data.projects, filters]);
  const selectedProject = data.projects.find((project) => project.id === selectedProjectId) ?? null;
  const teams = [...new Set(data.projects.map((project) => project.team))].sort();
  const workstreams = [...new Set(data.projects.map((project) => project.workstream))].sort();
  const ownerIds = [...new Set(data.projects.flatMap((project) => [
    ...project.sponsorIds,
    ...project.leadIds,
    ...project.collaboratorIds,
  ]))].sort();
  const missingOwners = data.projects.filter((project) => project.leadIds.length === 0).length;
  const untriagedIdeas = data.rawIdeas.filter((idea) => idea.triageStatus === 'untriaged').length;
  const blockers = data.projects.filter((project) => project.stage === 'Blocked').length
    + data.features.filter((feature) => feature.stage === 'Blocked').length;

  function setFilter<K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Portfolio operations</h1>
            <p className={styles.subtitle}>Projects are the portfolio source of truth. Features, raw ideas, decisions, sources, and private person IDs stay linked without being conflated.</p>
          </div>
          <Link href="/" className={styles.backLink}>← Hub</Link>
        </header>

        <section className={styles.summary} aria-label="Portfolio health summary">
          <div className={styles.summaryItem}><span className={styles.summaryValue}>{data.projects.length}</span><span className={styles.summaryLabel}>Projects</span></div>
          <div className={styles.summaryItem}><span className={styles.summaryValue}>{data.features.length}</span><span className={styles.summaryLabel}>Features</span></div>
          <div className={styles.summaryItem}><span className={styles.summaryValue}>{missingOwners}</span><span className={styles.summaryLabel}>Missing owners</span></div>
          <div className={styles.summaryItem}><span className={styles.summaryValue}>{blockers}</span><span className={styles.summaryLabel}>Blockers</span></div>
          <div className={styles.summaryItem}><span className={styles.summaryValue}>{untriagedIdeas}</span><span className={styles.summaryLabel}>Untriaged ideas</span></div>
        </section>

        <section className={styles.toolbar} aria-label="Portfolio filters">
          <div className={styles.field}><label htmlFor="portfolio-search">Search portfolio</label><input id="portfolio-search" className={styles.control} value={filters.search ?? ''} onChange={(event) => setFilter('search', event.target.value)} placeholder="Outcome, project, next action…" /></div>
          <div className={styles.field}><label htmlFor="portfolio-owner">Owner</label><select id="portfolio-owner" className={styles.control} value={filters.ownerId ?? ''} onChange={(event) => setFilter('ownerId', event.target.value)}><option value="">All owners</option>{ownerIds.map((ownerId) => <option key={ownerId}>{ownerId}</option>)}</select></div>
          <div className={styles.field}><label htmlFor="portfolio-team">Team</label><select id="portfolio-team" className={styles.control} value={filters.team ?? ''} onChange={(event) => setFilter('team', event.target.value)}><option value="">All teams</option>{teams.map((team) => <option key={team}>{team}</option>)}</select></div>
          <div className={styles.field}><label htmlFor="portfolio-priority">Priority</label><select id="portfolio-priority" className={styles.control} value={filters.priority ?? ''} onChange={(event) => setFilter('priority', event.target.value as ProjectFilters['priority'])}><option value="">All priorities</option>{['P0', 'P1', 'P2', 'P3', 'unranked'].map((priority) => <option key={priority}>{priority}</option>)}</select></div>
          <div className={styles.field}><label htmlFor="portfolio-stage">Stage</label><select id="portfolio-stage" className={styles.control} value={filters.stage ?? ''} onChange={(event) => setFilter('stage', event.target.value as ProjectFilters['stage'])}><option value="">All stages</option>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></div>
          <div className={styles.field}><label htmlFor="portfolio-workstream">Workstream</label><select id="portfolio-workstream" className={styles.control} value={filters.workstream ?? ''} onChange={(event) => setFilter('workstream', event.target.value)}><option value="">All workstreams</option>{workstreams.map((workstream) => <option key={workstream}>{workstream}</option>)}</select></div>
        </section>

        <div className={styles.horizonBar} aria-label="Planning horizon">
          <span className={styles.horizonLabel}>Now / Next / Later</span>
          {(['', 'Now', 'Next', 'Later'] as Array<PlanningHorizon | ''>).map((horizon) => (
            <button key={horizon || 'all'} type="button" className={`${styles.horizonButton} ${(filters.horizon ?? '') === horizon ? styles.horizonButtonActive : ''}`} onClick={() => setFilter('horizon', horizon)}>
              {horizon || 'All'}
            </button>
          ))}
        </div>

        <div className={styles.workspace}>
          <section className={styles.board}>
            <h2 className={styles.boardHeading}>Portfolio projects</h2>
            <p className={styles.count}>{projects.length} of {data.projects.length} projects shown</p>
            {projects.length === 0 ? <div className={styles.empty}>No projects match these filters.</div> : STAGES.map((stage) => {
              const stageProjects = projects.filter((project) => project.stage === stage);
              if (stageProjects.length === 0) return null;
              return (
                <section key={stage} className={styles.stageSection}>
                  <div className={styles.stageHeading}><span>{stage}</span><span>{stageProjects.length}</span></div>
                  {stageProjects.map((project) => {
                    const featureCount = data.features.filter((feature) => feature.parentProjectId === project.id).length;
                    const health = getProjectHealth(project, data);
                    return (
                      <button key={project.id} type="button" aria-label={`Open ${project.title}`} className={`${styles.projectButton} ${selectedProjectId === project.id ? styles.projectSelected : ''}`} onClick={() => setSelectedProjectId(project.id)}>
                        <div className={styles.projectTop}><span className={styles.projectTitle}>{project.title}</span><span className={styles.badge}>{project.priority}</span></div>
                        <p className={styles.projectOutcome}>{project.outcome}</p>
                        <div className={styles.meta}>
                          <span className={styles.metaText}>{featureCount} linked {featureCount === 1 ? 'feature' : 'features'}</span>
                          <span className={styles.metaText}>{project.workstream}</span>
                          {health.map((flag) => <span key={flag} className={healthClass(flag)}>{HEALTH_LABELS[flag]}</span>)}
                        </div>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </section>

          {selectedProject ? <ProjectDetail project={selectedProject} data={data} /> : <aside className={styles.detail}><div className={styles.detailEmpty}>Select a project to inspect its outcome, next action, dependencies, linked features, sources, and decisions.</div></aside>}
        </div>
      </div>
    </main>
  );
}
