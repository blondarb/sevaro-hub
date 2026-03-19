'use client';

import './globals.css';
import { useState, useEffect, useCallback } from 'react';
import roadmapData from '../data/roadmap.json';
import { MilestoneLinks } from '../components/MilestoneDrawer';
import type { Project, Milestone } from '../components/MilestoneDrawer';

const projects = roadmapData.projects as Project[];

function getMilestones(projectId: string): Milestone[] {
  const project = projects.find(p => p.id === projectId);
  return project?.milestones.filter(m => m.status !== 'done') ?? [];
}

export default function HomePage() {
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  const findMilestone = useCallback((taskKey: string): { project: Project; milestone: Milestone } | null => {
    const dotIndex = taskKey.indexOf('.');
    if (dotIndex === -1) return null;
    const projectId = taskKey.substring(0, dotIndex);
    const milestoneId = taskKey.substring(dotIndex + 1);
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return null;
    return { project, milestone };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const task = params.get('task');
    if (task && findMilestone(task)) {
      setActiveTask(task);
    }
  }, [findMilestone]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    if (activeTask) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [activeTask]);

  const openDrawer = (projectId: string, milestoneId: string) => {
    const taskKey = `${projectId}.${milestoneId}`;
    setActiveTask(taskKey);
    setShowFullPrompt(false);
    const url = new URL(window.location.href);
    url.searchParams.set('task', taskKey);
    window.history.pushState({}, '', url.toString());
  };

  const closeDrawer = () => {
    setActiveTask(null);
    setShowFullPrompt(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('task');
    window.history.pushState({}, '', url.toString());
  };

  const active = activeTask ? findMilestone(activeTask) : null;

  const complexityColor: Record<string, string> = {
    low: '#4ade80',
    medium: '#fbbf24',
    high: '#f87171',
  };

  const statusColor: Record<string, string> = {
    pending: '#9ca3af',
    'in-progress': '#60a5fa',
    done: '#4ade80',
    draft: '#f472b6',
  };

  return (
    <>
      <style>{`
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          background: #0a0a0f;
          color: #e0e0e8;
          min-height: 100vh;
          line-height: 1.6;
        }
        .bg-glow {
          position: fixed; top: -30%; left: 50%; transform: translateX(-50%);
          width: 800px; height: 800px;
          background: radial-gradient(circle, rgba(56, 120, 200, 0.08) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .container { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 60px 24px 80px; }
        header { text-align: center; margin-bottom: 56px; }
        header h1 {
          font-size: 2.4rem; font-weight: 700; letter-spacing: -0.02em;
          background: linear-gradient(135deg, #c8d8f0, #7aa2d4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;
        }
        header p { font-size: 1.05rem; color: #8890a4; }
        .section { margin-bottom: 48px; }
        .section-title {
          font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.12em; color: #9ba3b8; margin-bottom: 16px; padding-left: 4px;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
        .card {
          display: block; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 20px 22px; text-decoration: none; color: inherit; transition: all 0.2s ease;
        }
        .card:hover {
          background: rgba(255,255,255,0.06); border-color: rgba(120,160,220,0.25);
          transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        }
        .card-title { font-size: 1.05rem; font-weight: 600; color: #d0d8e8; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .card-title a { color: inherit; text-decoration: none; }
        .card-title a:hover { text-decoration: underline; }
        .card-desc { font-size: 0.88rem; color: #9ba3b8; line-height: 1.5; }
        .badge { display: inline-block; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 4px; }
        .badge-live { background: rgba(50,180,100,0.15); color: #4ade80; }
        .badge-api { background: rgba(160,120,240,0.15); color: #b89afc; }
        .badge-ext { background: rgba(240,170,60,0.15); color: #fbbf24; }
        .badge-app { background: rgba(60,160,240,0.15); color: #60a5fa; }
        .badge-review { background: rgba(240,200,60,0.15); color: #facc15; }
        .badge-dev { background: rgba(160,160,180,0.15); color: #9ca3af; }
        .badge-new { background: rgba(236,72,153,0.15); color: #f472b6; }
        .card-next { display: block; font-size: 0.78rem; color: #7aa2d4; margin-top: 8px; font-style: italic; }
        .card-nolink { cursor: default; }
        .card-nolink:hover { transform: none; box-shadow: none; background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
        footer { text-align: center; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); color: #9ba3b8; font-size: 0.82rem; }
        @media (max-width: 600px) { .container { padding: 40px 16px 60px; } header h1 { font-size: 1.8rem; } .grid { grid-template-columns: 1fr; } }
        .milestone-link {
          color: #7aa2d4;
          cursor: pointer;
          text-decoration: none;
          transition: color 0.15s;
        }
        .milestone-link:hover {
          color: #93b8e4;
          text-decoration: underline;
        }
      `}</style>

      <div className="bg-glow" />
      <div className="container">
        <header>
          <h1>Sevaro Hub</h1>
          <p>Projects &amp; tools built by Steve Arbogast</p>
        </header>

        {/* Web Applications */}
        <div className="section">
          <div className="section-title">Web Applications</div>
          <div className="grid">
            <div className="card">
              <div className="card-title"><a href="https://evidence.neuroplans.app" target="_blank" rel="noopener">Evidence Engine</a> <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Two-stage clinical AI: Claude Sonnet reasoning with Bedrock KB (1,472 docs) and live PubMed search, plus integrated NeuroScribe documentation workflow.
                <MilestoneLinks projectId="evidence-engine" milestones={getMilestones('evidence-engine')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card">
              <div className="card-title"><a href="https://app.neuroplans.app" target="_blank" rel="noopener">OPSAmple</a> <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Clinical operations platform with AI-generated interpretations, 30-day summaries, and wearable dashboard.
                <MilestoneLinks projectId="opsample" milestones={getMilestones('opsample')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card">
              <div className="card-title"><a href="https://showcase.neuroplans.app" target="_blank" rel="noopener">GitHub Showcase</a> <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Developer portfolio with automated App Store monitoring and repo delta tracking.
                <MilestoneLinks projectId="github-showcase" milestones={getMilestones('github-showcase')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card">
              <div className="card-title"><a href="https://workouts.neuroplans.app" target="_blank" rel="noopener">Workouts</a> <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Fitness tracking with AI-powered workout generation via Bedrock, Cognito auth, and RDS backend.
                <MilestoneLinks projectId="workouts" milestones={getMilestones('workouts')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card">
              <div className="card-title"><a href="https://plans.neuroplans.app" target="_blank" rel="noopener">Neuro Plans v2</a> <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Next-generation clinical plan builder for neurology. Next.js with Cognito auth and RDS backend.
                <MilestoneLinks projectId="neuro-plans-v2" milestones={getMilestones('neuro-plans-v2')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">Cardio Plans v2 <span className="badge badge-new">New</span> <span className="badge badge-dev">Dev</span></div>
              <div className="card-desc">Next-generation cardiology plans app. Next.js with Cognito auth and RDS backend.
                <MilestoneLinks projectId="cardio-plans-v2" milestones={getMilestones('cardio-plans-v2')} onOpen={openDrawer} />
              </div>
            </div>
          </div>
        </div>

        {/* iOS Apps */}
        <div className="section">
          <div className="section-title">iOS Apps</div>
          <div className="grid">
            <a className="card" href="https://apps.apple.com/app/neuro-plans/id6759209586" target="_blank" rel="noopener">
              <div className="card-title">Neuro Plans <span className="badge badge-app">App Store</span></div>
              <div className="card-desc">Neurology care plan generator for clinical decision support.</div>
            </a>
            <a className="card" href="https://apps.apple.com/app/cardio-plans/id6759342483" target="_blank" rel="noopener">
              <div className="card-title">Cardio Plans <span className="badge badge-app">App Store</span></div>
              <div className="card-desc">Cardiology care plan generator for evidence-based cardiac care.</div>
            </a>
            <div className="card card-nolink">
              <div className="card-title">RepGenius <span className="badge badge-review">In Review</span></div>
              <div className="card-desc">AI-powered workout coach with personalized fitness programming via OpenAI GPT-5 Mini.
                <MilestoneLinks projectId="repgenius" milestones={getMilestones('repgenius')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">SevaroMonitor <span className="badge badge-app">iOS</span></div>
              <div className="card-desc">Wearable patient monitoring with finger tapping, verbal fluency, and tremor assessments.
                <MilestoneLinks projectId="sevaro-monitor" milestones={getMilestones('sevaro-monitor')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">PostSeed <span className="badge badge-new">New</span> <span className="badge badge-dev">Dev</span></div>
              <div className="card-desc">Capture-flow journal app with camera, voice recording, on-device transcription, location tagging, and sharing.
                <MilestoneLinks projectId="postseed" milestones={getMilestones('postseed')} onOpen={openDrawer} />
              </div>
            </div>
          </div>
        </div>

        {/* APIs */}
        <div className="section">
          <div className="section-title">APIs &amp; Services</div>
          <div className="grid">
            <div className="card card-nolink">
              <div className="card-title">SDNE <span className="badge badge-api">API</span></div>
              <div className="card-desc">Acoustic speech analysis with speech audio pipeline, cloud transcription, and clinical session review. Container Lambda on AWS.
                <MilestoneLinks projectId="sdne" milestones={getMilestones('sdne')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">SevaroMonitor API <span className="badge badge-api">API</span></div>
              <div className="card-desc">Wearable monitoring backend with assessment tables and clinical alerting.</div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">Scribe API <span className="badge badge-api">API</span></div>
              <div className="card-desc">Lambda-based clinical note generation and transcription services.</div>
            </div>
          </div>
        </div>

        {/* Chrome Extensions */}
        <div className="section">
          <div className="section-title">Chrome Extensions</div>
          <div className="grid">
            <div className="card card-nolink">
              <div className="card-title">SevaroNeuro Scribe <span className="badge badge-ext">Extension</span></div>
              <div className="card-desc">Neurology-focused clinical note generation with Cognito auth, Lambda API, and Bedrock AI.
                <MilestoneLinks projectId="neuroscribe" milestones={getMilestones('neuroscribe')} onOpen={openDrawer} />
              </div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">Sevaro Scribe <span className="badge badge-ext">Extension</span></div>
              <div className="card-desc">General clinical dictation with Deepgram Nova-3 streaming, Cognito auth, and AI-powered text refinement.
                <MilestoneLinks projectId="sevaro-scribe" milestones={getMilestones('sevaro-scribe')} onOpen={openDrawer} />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Tools */}
        <div className="section">
          <div className="section-title">Desktop Tools</div>
          <div className="grid">
            <div className="card card-nolink">
              <div className="card-title">VoiceTranscriber</div>
              <div className="card-desc">macOS dictation app with Deepgram streaming, voice commands, silence auto-stop, and post-dictation AI cleanup. AWS Transcribe for HIPAA-compliant mode.
                <MilestoneLinks projectId="voice-transcriber" milestones={getMilestones('voice-transcriber')} onOpen={openDrawer} />
              </div>
            </div>
          </div>
        </div>

        {/* VR / XR */}
        <div className="section">
          <div className="section-title">VR / XR</div>
          <div className="grid">
            <div className="card card-nolink">
              <div className="card-title">Market Day VR <span className="badge badge-dev">Dev</span></div>
              <div className="card-desc">Cognitive/motor rehabilitation VR for post-stroke adults. Samsung Galaxy XR, Unity 6 LTS + Sonali AI coaching.
                <MilestoneLinks projectId="market-day-vr" milestones={getMilestones('market-day-vr')} onOpen={openDrawer} />
              </div>
            </div>
          </div>
        </div>

        {/* Tools */}
        <div className="section">
          <div className="section-title">Tools &amp; Testing</div>
          <div className="grid">
            <a className="card" href="/scribe-test.html">
              <div className="card-title">Scribe Test Page <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Test page with multiple text fields for Scribe extension dictation.</div>
            </a>
            <a className="card" href="/feedback">
              <div className="card-title">Feedback Dashboard <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Review voice feedback from testers across all apps. AI-generated summaries and action items.</div>
            </a>
          </div>
        </div>

        <footer>Sevaro Health &middot; All projects hosted on AWS</footer>
      </div>

      {/* Milestone Drawer */}
      {activeTask && active && (
        <>
          <style>{`
            .drawer-backdrop {
              position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; animation: fadeIn 0.2s ease;
            }
            .drawer-panel {
              position: fixed; top: 0; right: 0; width: min(440px, 90vw); height: 100vh;
              background: #12121a; border-left: 1px solid rgba(255,255,255,0.08); z-index: 1001;
              overflow-y: auto; padding: 28px 24px 40px; animation: slideIn 0.25s ease;
              box-shadow: -8px 0 40px rgba(0,0,0,0.5);
            }
            .drawer-close {
              position: absolute; top: 16px; right: 16px; background: none;
              border: 1px solid rgba(255,255,255,0.1); color: #8890a4; font-size: 1.2rem;
              cursor: pointer; width: 32px; height: 32px; border-radius: 6px;
              display: flex; align-items: center; justify-content: center; transition: all 0.15s;
            }
            .drawer-close:hover { background: rgba(255,255,255,0.06); color: #d0d8e8; }
            .drawer-title { font-size: 1.15rem; font-weight: 600; color: #d0d8e8; margin-bottom: 8px; padding-right: 40px; line-height: 1.4; }
            .drawer-project { font-size: 0.78rem; color: #5a6580; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; }
            .drawer-badges { display: flex; gap: 8px; margin-bottom: 20px; }
            .drawer-badge { display: inline-block; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 8px; border-radius: 4px; }
            .drawer-section { margin-bottom: 20px; }
            .drawer-section-title { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a6580; margin-bottom: 8px; }
            .drawer-text { font-size: 0.9rem; color: #9ca3b8; line-height: 1.6; }
            .drawer-list { list-style: none; padding: 0; margin: 0; }
            .drawer-list li { font-size: 0.85rem; color: #9ca3b8; padding: 4px 0 4px 16px; position: relative; }
            .drawer-list li::before { content: '\\203A'; position: absolute; left: 0; color: #5a6580; }
            .drawer-files { list-style: none; padding: 0; margin: 0; }
            .drawer-files li { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.78rem; color: #7aa2d4; padding: 3px 0; }
            .prompt-box { background: rgba(122,162,212,0.08); border: 1px solid rgba(122,162,212,0.15); border-radius: 8px; padding: 14px 16px; position: relative; }
            .prompt-text { font-size: 0.85rem; color: #b0c0d8; line-height: 1.5; font-style: italic; white-space: pre-wrap; }
            .copy-btn {
              background: rgba(122,162,212,0.15); border: 1px solid rgba(122,162,212,0.2); color: #7aa2d4;
              font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
              padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.15s;
              position: absolute; top: 10px; right: 10px;
            }
            .copy-btn:hover { background: rgba(122,162,212,0.25); }
            .full-prompt-toggle {
              background: none; border: 1px solid rgba(255,255,255,0.08); color: #7aa2d4;
              font-size: 0.8rem; padding: 6px 14px; border-radius: 6px; cursor: pointer;
              transition: all 0.15s; width: 100%; text-align: left;
            }
            .full-prompt-toggle:hover { background: rgba(255,255,255,0.04); border-color: rgba(122,162,212,0.2); }
            .steps-list { list-style: none; padding: 0; margin: 0; counter-reset: steps; }
            .steps-list li {
              font-size: 0.85rem; color: #9ca3b8; padding: 6px 0 6px 28px; position: relative;
              counter-increment: steps; line-height: 1.5;
            }
            .steps-list li::before {
              content: counter(steps); position: absolute; left: 0; color: #5a6580;
              font-size: 0.72rem; font-weight: 600; background: rgba(255,255,255,0.04);
              width: 20px; height: 20px; border-radius: 50%; display: flex;
              align-items: center; justify-content: center; top: 7px;
            }
            .drawer-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          `}</style>

          <div className="drawer-backdrop" onClick={closeDrawer} />
          <div className="drawer-panel">
            <button className="drawer-close" onClick={closeDrawer}>×</button>
            <div className="drawer-project">{active.project.name}</div>
            <div className="drawer-title">{active.milestone.title}</div>
            <div className="drawer-badges">
              <span className="drawer-badge" style={{ background: `${statusColor[active.milestone.status] || '#9ca3af'}20`, color: statusColor[active.milestone.status] || '#9ca3af' }}>
                {active.milestone.status}
              </span>
              <span className="drawer-badge" style={{ background: `${complexityColor[active.milestone.complexity] || '#9ca3af'}20`, color: complexityColor[active.milestone.complexity] || '#9ca3af' }}>
                {active.milestone.complexity}
              </span>
            </div>

            <div className="drawer-section">
              <div className="drawer-section-title">Description</div>
              <div className="drawer-text">{active.milestone.description}</div>
            </div>

            {active.milestone.prerequisites.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">Prerequisites</div>
                <ul className="drawer-list">
                  {active.milestone.prerequisites.map((p: string, i: number) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {active.milestone.keyFiles.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">Key Files</div>
                <ul className="drawer-files">
                  {active.milestone.keyFiles.map((f: string, i: number) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            <hr className="drawer-divider" />

            <div className="drawer-section">
              <div className="drawer-section-title">Quick Prompt</div>
              <div className="prompt-box">
                <CopyButton text={active.milestone.quickPrompt} label="quick prompt" />
                <div className="prompt-text">{active.milestone.quickPrompt}</div>
              </div>
            </div>

            <div className="drawer-section">
              {!showFullPrompt ? (
                <button className="full-prompt-toggle" onClick={() => setShowFullPrompt(true)}>
                  &#9656; Show full prompt with context and acceptance criteria
                </button>
              ) : (
                <>
                  <div className="drawer-section-title">Full Prompt</div>
                  <div className="prompt-box">
                    <CopyButton text={active.milestone.fullPrompt} label="full prompt" />
                    <div className="prompt-text">{active.milestone.fullPrompt}</div>
                  </div>
                  <button className="full-prompt-toggle" onClick={() => setShowFullPrompt(false)} style={{ marginTop: 8 }}>
                    &#9662; Hide full prompt
                  </button>
                </>
              )}
            </div>

            <hr className="drawer-divider" />

            {active.milestone.manualSteps.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">Manual Steps</div>
                <ol className="steps-list">
                  {active.milestone.manualSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="copy-btn" title={`Copy ${label}`}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
