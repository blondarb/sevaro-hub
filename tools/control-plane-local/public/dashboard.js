const text = (id, value) => { document.getElementById(id).textContent = value; };
const formatTime = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function render(status) {
  const passed = status.checks.filter((check) => check.passed).length;
  const ready = status.readiness === 'ready';
  const badge = document.getElementById('readiness');
  badge.textContent = ready ? 'Ready' : 'Blocked';
  badge.className = `badge ${ready ? 'ready' : 'blocked'}`;
  text('summary', ready ? 'Local nonproduction metadata control is ready.' : 'Local access is safely blocked. No source metadata is displayed until permissions are refreshed.');
  text('mode', 'Local nonproduction'); text('partition', 'Product development');
  text('permission', status.permission_state === 'current' ? 'Current' : 'Refresh required');
  text('asana-permission', status.asana_permission_state === 'current' ? 'Current' : 'Refresh required');
  text('tool-count', String(status.tool_count)); text('checked-at', `Checked ${formatTime(status.checked_at)}`);
  text('check-count', `${passed} / ${status.checks.length}`); text('repository-count', `${status.repository_count} / 4`);
  const checks = document.getElementById('checks'); checks.replaceChildren(...status.checks.map((check) => { const item = document.createElement('li'); item.className = `check ${check.passed ? 'passed' : 'failed'}`; item.append(document.createTextNode(check.code)); const detail = document.createElement('span'); detail.className = 'check-detail'; detail.textContent = check.detail_code; item.append(detail); return item; }));
  const repositories = document.getElementById('repositories'); repositories.replaceChildren(...status.repositories.map((repository) => { const item = document.createElement('li'); item.className = 'repository'; item.append(document.createTextNode(repository.full_name)); const time = document.createElement('time'); time.dateTime = repository.retrieved_at; time.textContent = `Retrieved ${formatTime(repository.retrieved_at)}`; item.append(time); return item; }));
  text('asana-project-count', String(status.asana_project_count));
  const projects = document.getElementById('asana-projects'); projects.replaceChildren(...status.asana_projects.map((project) => { const item = document.createElement('li'); item.className = 'repository'; const details = document.createElement('span'); details.textContent = `${project.name} · ${project.status}`; item.append(details); const time = document.createElement('time'); time.dateTime = project.retrieved_at; time.textContent = `Retrieved ${formatTime(project.retrieved_at)}`; item.append(time); return item; }));
}

async function load() {
  try { const response = await fetch('/api/status', { cache: 'no-store', headers: { 'x-sevaro-local-status': '1' } }); if (!response.ok) throw new Error('unavailable'); render(await response.json()); }
  catch { const badge = document.getElementById('readiness'); badge.textContent = 'Unavailable'; badge.className = 'badge blocked'; text('summary', 'Local status is unavailable. No source data was displayed.'); }
}
load();
