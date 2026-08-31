import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../../tools/control-plane-local');

describe('local dashboard static behavior', () => {
  it('shows the approved scope and does not embed backend configuration', async () => {
    const [html, js, css] = await Promise.all(['public/index.html', 'public/dashboard.js', 'public/dashboard.css'].map((file) => readFile(path.join(root, file), 'utf8')));
    expect(html).toContain('AI Control Plane'); expect(html).toContain('PHI OFF'); expect(html).toContain('Remote MCP OFF');
    expect(html).toContain('Approved repositories'); expect(html).toContain('Asana project metadata'); expect(html).toContain('Project intelligence'); expect(html).toContain('Not enabled in this local profile.'); expect(js).toContain("fetch('/api/status'"); expect(js).toContain('asana_permission_state'); expect(js).toContain('asana_projects'); expect(js).toContain("status.schema_version === '3'"); expect(js).toContain('active_project_count'); expect(css).toContain('#0c0f14');
    expect(`${html}${js}${css}`).not.toContain('CONTROL_PLANE_LOCAL_API_BEARER');
    expect(`${html}${js}${css}`).not.toContain('CONTROL_PLANE_LOCAL_API_URL');
  });
});
