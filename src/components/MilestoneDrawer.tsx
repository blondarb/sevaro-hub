'use client';

export interface Milestone {
  id: string;
  title: string;
  status: string;
  complexity: string;
  description: string;
  prerequisites: string[];
  keyFiles: string[];
  quickPrompt: string;
  fullPrompt: string;
  manualSteps: string[];
}

export interface Project {
  id: string;
  name: string;
  milestones: Milestone[];
}

export function MilestoneLinks({
  projectId,
  milestones,
  onOpen,
}: {
  projectId: string;
  milestones: Milestone[];
  onOpen: (projectId: string, milestoneId: string) => void;
}) {
  const active = milestones.filter(m => m.status !== 'done');
  if (active.length === 0) return null;

  return (
    <span className="card-next">
      Next:{' '}
      {active.slice(0, 5).map((m, i) => (
        <span key={m.id}>
          {i > 0 && ', '}
          <span
            className="milestone-link"
            onClick={() => onOpen(projectId, m.id)}
          >
            {i + 1}) {m.title}
          </span>
        </span>
      ))}
    </span>
  );
}
