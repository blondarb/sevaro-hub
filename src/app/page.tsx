import './globals.css';

// Preserve exact existing Hub splash page design
export default function HomePage() {
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
          letter-spacing: 0.12em; color: #5a6580; margin-bottom: 16px; padding-left: 4px;
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
        .card-title { font-size: 1.05rem; font-weight: 600; color: #d0d8e8; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
        .card-desc { font-size: 0.88rem; color: #6a7490; line-height: 1.5; }
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
        footer { text-align: center; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); color: #3a4260; font-size: 0.82rem; }
        @media (max-width: 600px) { .container { padding: 40px 16px 60px; } header h1 { font-size: 1.8rem; } .grid { grid-template-columns: 1fr; } }
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
            <a className="card" href="https://evidence.neuroplans.app" target="_blank" rel="noopener">
              <div className="card-title">Evidence Engine <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Two-stage clinical AI: Claude Sonnet reasoning with Bedrock KB (1,472 docs) and live PubMed search, plus integrated NeuroScribe documentation workflow.<span className="card-next">Next: Optimize synthesis speed</span></div>
            </a>
            <a className="card" href="https://app.neuroplans.app" target="_blank" rel="noopener">
              <div className="card-title">OPSAmple <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Clinical operations platform with AI-generated interpretations, 30-day summaries, and wearable dashboard.<span className="card-next">Next: Real-time transcription display and diagnosis plan coverage</span></div>
            </a>
            <a className="card" href="https://showcase.neuroplans.app" target="_blank" rel="noopener">
              <div className="card-title">GitHub Showcase <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Developer portfolio with automated App Store monitoring and repo delta tracking.</div>
            </a>
            <a className="card" href="https://workouts.neuroplans.app" target="_blank" rel="noopener">
              <div className="card-title">Workouts <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Fitness tracking with AI-powered workout generation via Bedrock, Cognito auth, and RDS backend.<span className="card-next">Next: Privacy policy update and voice handoff reliability</span></div>
            </a>
            <a className="card" href="https://plans.neuroplans.app" target="_blank" rel="noopener">
              <div className="card-title">Neuro Plans v2 <span className="badge badge-live">Live</span></div>
              <div className="card-desc">Next-generation clinical plan builder for neurology. Next.js with Cognito auth and RDS backend.<span className="card-next">Next: Replace Supabase Auth OTP with AWS SES + RDS, then remove Supabase SDK from iOS</span></div>
            </a>
            <div className="card card-nolink">
              <div className="card-title">Cardio Plans v2 <span className="badge badge-new">New</span> <span className="badge badge-dev">Dev</span></div>
              <div className="card-desc">Next-generation cardiology plans app. Next.js with Cognito auth and RDS backend.<span className="card-next">Next: Build authenticated pages and clinical plan content</span></div>
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
              <div className="card-desc">AI-powered workout coach with personalized fitness programming via OpenAI GPT-5 Mini.<span className="card-next">v1.0.1 submitted — awaiting App Store review</span></div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">SevaroMonitor <span className="badge badge-app">iOS</span></div>
              <div className="card-desc">Wearable patient monitoring with finger tapping, verbal fluency, and tremor assessments.<span className="card-next">Next: Multi-device RPM infrastructure and alerting refinements</span></div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">PostSeed <span className="badge badge-new">New</span> <span className="badge badge-dev">Dev</span></div>
              <div className="card-desc">Capture-flow journal app with camera, voice recording, on-device transcription, location tagging, and sharing.<span className="card-next">Next: TestFlight build and beta testing</span></div>
            </div>
          </div>
        </div>

        {/* APIs */}
        <div className="section">
          <div className="section-title">APIs &amp; Services</div>
          <div className="grid">
            <div className="card card-nolink">
              <div className="card-title">SDNE <span className="badge badge-api">API</span></div>
              <div className="card-desc">Acoustic speech analysis with speech audio pipeline, cloud transcription, and clinical session review. Container Lambda on AWS.<span className="card-next">Next: End-to-end speech pipeline validation and gait task testing</span></div>
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
              <div className="card-desc">Neurology-focused clinical note generation with Cognito auth, Lambda API, and Bedrock AI.<span className="card-next">Next: Note generation pipeline polish and chart prep refinement</span></div>
            </div>
            <div className="card card-nolink">
              <div className="card-title">Sevaro Scribe <span className="badge badge-ext">Extension</span></div>
              <div className="card-desc">General clinical dictation with Deepgram Nova-3 streaming, Cognito auth, and AI-powered text refinement.<span className="card-next">Next: Production Cognito auth testing and DEV_MODE removal</span></div>
            </div>
          </div>
        </div>

        {/* Desktop Tools */}
        <div className="section">
          <div className="section-title">Desktop Tools</div>
          <div className="grid">
            <div className="card card-nolink">
              <div className="card-title">VoiceTranscriber</div>
              <div className="card-desc">macOS dictation app with Deepgram streaming, voice commands, silence auto-stop, and post-dictation AI cleanup. AWS Transcribe for HIPAA-compliant mode.<span className="card-next">Next: Steel man test remediations (logging, thread safety)</span></div>
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
              <div className="card-title">Feedback Dashboard <span className="badge badge-new">New</span></div>
              <div className="card-desc">Review voice feedback from testers across all apps. AI-generated summaries and action items.</div>
            </a>
          </div>
        </div>

        <footer>Sevaro Health &middot; All projects hosted on AWS</footer>
      </div>
    </>
  );
}
