const text = (id, value) => { document.getElementById(id).textContent = value; };
const formatTime = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const checkLabel = (code) => ({ exact_four: 'authorized_repository_scope', readable_exact_four: 'readable_authorized_repositories' }[code] ?? code);
const item = (label) => { const node = document.createElement('li'); node.textContent = label; return node; };

function renderBoundaries(status) {
  const labels = [['content', status.boundaries.content ? 'Content on demand' : 'Content OFF'], ['phi', 'PHI OFF'], ['source_writes', status.boundaries.source_writes ? 'Human-confirmed source actions' : 'Source writes OFF'], ['canonical_data_writes', status.boundaries.canonical_data_writes ? 'Shared handoffs enabled' : 'Canonical mutation OFF'], ['scheduling', status.boundaries.scheduling ? 'Foreground refresh only' : 'Scheduling OFF'], ['remote_mcp', 'Remote MCP OFF'], ['production', 'Production OFF'], ['audit_logging', 'Audit logging ON']];
  const root = document.getElementById('boundaries'); root.replaceChildren(...labels.map(([key, label]) => { const node = item(label); node.className = `badge ${status.boundaries[key] ? 'ready' : 'off'}`; return node; }));
}

function renderCapabilities(status) {
  const enabled = status.schema_version === '4'; document.getElementById('local-capabilities').hidden = !enabled; if (!enabled) return;
  const value = status.capabilities; text('capability-summary', 'Local product capabilities are available only in this foreground local-nonproduction session.');
  document.getElementById('capability-limitations').replaceChildren(...[
    `Repository text: ${value.repository_text.replaceAll('_', ' ')}`, `Shared handoffs: ${value.shared_handoffs.replaceAll('_', ' ')}`, `Asana actions: ${value.asana_actions.replaceAll('_', ' ')}`, `GitHub actions: ${value.github_actions.replaceAll('_', ' ')}`, `Automatic refresh: ${value.automatic_metadata_refresh.replaceAll('_', ' ')}`, 'Microsoft Graph is not connected. PHI, remote MCP, and production remain unavailable.',
  ].map(item));
}

function render(status) {
  const passed = status.checks.filter((check) => check.passed).length; const ready = status.readiness === 'ready'; const badge = document.getElementById('readiness'); badge.textContent = ready ? 'Ready' : 'Blocked'; badge.className = `badge ${ready ? 'ready' : 'blocked'}`;
  text('summary', ready ? 'Local nonproduction control is ready.' : 'Local access is safely blocked. No source metadata is displayed until permissions are refreshed.'); text('mode', 'Local nonproduction'); text('partition', 'Product development'); text('permission', status.permission_state === 'current' ? 'Current' : 'Refresh required'); text('asana-permission', status.asana_permission_state === 'current' ? 'Current' : 'Refresh required'); text('tool-count', String(status.tool_count)); text('checked-at', `Checked ${formatTime(status.checked_at)}`); text('check-count', `${passed} / ${status.checks.length}`); text('repository-count', String(status.repository_count));
  const checks = document.getElementById('checks'); checks.replaceChildren(...status.checks.map((check) => { const node = document.createElement('li'); node.className = `check ${check.passed ? 'passed' : 'failed'}`; node.append(document.createTextNode(checkLabel(check.code))); const detail = document.createElement('span'); detail.className = 'check-detail'; detail.textContent = check.detail_code; node.append(detail); return node; }));
  const repositories = document.getElementById('repositories'); repositories.replaceChildren(...status.repositories.map((repository) => { const node = document.createElement('li'); node.className = 'repository'; node.append(document.createTextNode(repository.full_name)); const time = document.createElement('time'); time.dateTime = repository.retrieved_at; time.textContent = `Retrieved ${formatTime(repository.retrieved_at)}`; node.append(time); return node; }));
  text('asana-project-count', String(status.asana_project_count)); const projects = document.getElementById('asana-projects'); projects.replaceChildren(...status.asana_projects.map((project) => { const node = document.createElement('li'); node.className = 'repository'; const details = document.createElement('span'); details.textContent = `${project.name} · ${project.status}`; node.append(details); const time = document.createElement('time'); time.dateTime = project.retrieved_at; time.textContent = `Retrieved ${formatTime(project.retrieved_at)}`; node.append(time); return node; }));
  const projectEnabled = status.schema_version !== '2'; document.getElementById('project-intelligence-metrics').hidden = !projectEnabled; text('project-intelligence-summary', projectEnabled ? 'Metadata-only aggregates from the durable local project index.' : 'Not enabled in this local profile.'); if (projectEnabled) { text('active-project-count', String(status.active_project_count)); text('stale-project-count', String(status.stale_project_count)); text('projects-without-owner-count', String(status.projects_without_owner_count)); }
  renderBoundaries(status); renderCapabilities(status);
}

async function loadActions() {
  const root = document.getElementById('action-previews');
  try {
    const response = await fetch('/api/actions', {
      cache: 'no-store', headers: { 'x-sevaro-local-actions': '1' },
    });
    if (!response.ok) throw new Error('unavailable');
    const actions = await response.json();
    root.replaceChildren(...actions.previews.map((preview) => {
      const node = document.createElement('li');
      node.className = 'repository';
      const detail = document.createElement('span');
      detail.textContent = `${preview.consumer} · ${preview.action.action} · expires ${formatTime(preview.expires_at)}`;
      const exactChange = document.createElement('pre');
      exactChange.textContent = JSON.stringify(preview.action, null, 2);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Confirm this exact change';
      button.disabled = true;
      let attempted = false;
      const label = document.createElement('label');
      const attestation = document.createElement('input');
      attestation.type = 'checkbox';
      label.append(attestation, document.createTextNode(' I reviewed the exact target and payload. It contains no PHI or secrets.'));
      attestation.addEventListener('change', () => { button.disabled = attempted || !attestation.checked; });
      const target = document.createElement('a');
      const targetId = preview.action.task_gid || preview.action.project_gid;
      if (/^[0-9]+$/.test(targetId ?? '')) {
        target.href = preview.action.task_gid
          ? `https://app.asana.com/0/0/${targetId}`
          : `https://app.asana.com/0/${targetId}/list`;
        target.textContent = 'Review target in Asana';
        target.target = '_blank';
        target.rel = 'noopener noreferrer';
      }
      button.addEventListener('click', async () => {
        if (attempted || !attestation.checked) return;
        attempted = true;
        button.disabled = true;
        text('action-message', 'Confirming this one proposed action…');
        try {
          const confirmed = await fetch(`/api/actions/${preview.consumer}/${preview.preview_id}/confirm`, {
            method: 'POST',
            headers: { 'x-sevaro-local-actions': '1', 'x-control-plane-confirmation': actions.csrf_nonce },
          });
          const body = await confirmed.json();
          if (confirmed.status === 409 && body.error === 'action_outcome_uncertain') {
            text('action-message', 'The outcome is uncertain. Verify the target in Asana before attempting another action.');
            return;
          }
          if (!confirmed.ok) throw new Error('denied');
          text('action-message', 'Action completed.');
          await loadActions();
        } catch {
          text('action-message', 'Confirmation was unavailable. Check Asana before creating another proposal. No automatic retry was performed.');
        }
        // Consumed or ambiguous proposals must never regain a retry button.
      });
      node.append(detail, target, exactChange, label, button);
      return node;
    }));
    if (actions.previews.length === 0) root.replaceChildren(item('No pending action proposals.'));
  } catch {
    root.replaceChildren(item('Action proposals are unavailable.'));
  }
}

async function load() { try { const response = await fetch('/api/status', { cache: 'no-store', headers: { 'x-sevaro-local-status': '1' } }); if (!response.ok) throw new Error('unavailable'); render(await response.json()); await loadActions(); } catch { const badge = document.getElementById('readiness'); badge.textContent = 'Unavailable'; badge.className = 'badge blocked'; text('summary', 'Local status is unavailable. No source data was displayed.'); } }
load();
