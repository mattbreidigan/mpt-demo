import { Link } from 'react-router-dom'
import { clearDemoStorage } from '../lib/storage'

export default function DashboardPage() {
  function handleReset() {
    clearDemoStorage()
    window.alert('Demo storage reset.')
  }

  return (
    <main className="container">
      <section className="hero-card">
        <p className="eyebrow">MPT Report Generator</p>
        <h1>Client-ready demo workflow</h1>
        <p className="muted">
          Upload a template, detect placeholders, generate forms, and prepare export data in one flow.
        </p>
      </section>

      <div className="card-grid">
        <section className="card">
          <h2>1. Template Parser</h2>
          <p className="muted">Upload a .docx file and auto-detect placeholders as editable fields.</p>
          <Link className="button" to="/template">
            Open Template Parser
          </Link>
        </section>

        <section className="card">
          <h2>2. Report Editor</h2>
          <p className="muted">Fill generated fields with autosave and validation summary.</p>
          <Link className="button" to="/editor">
            Open Report Editor
          </Link>
        </section>
      </div>

      <button className="button ghost" onClick={handleReset}>
        Reset Demo Data
      </button>
    </main>
  )
}
