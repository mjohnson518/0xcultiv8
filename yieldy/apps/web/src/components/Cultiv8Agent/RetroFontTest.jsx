/**
 * Retro Font Test Component
 * Validates that all pixel fonts load and render correctly
 */

export function RetroFontTest() {
  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Retro Font Test</h2>
      
      {/* VT323 Test */}
      <div className="retro-border p-4">
        <p className="retro-label mb-2">VT323 (Pixel Font)</p>
        <h1 className="retro-heading-2">CULTIV8 AGENT v1.0</h1>
        <p style={{ fontFamily: 'VT323, monospace', fontSize: '24px' }}>
          The quick brown fox jumps over the lazy dog 0123456789
        </p>
      </div>

      {/* IBM Plex Mono Test */}
      <div className="retro-border p-4">
        <p className="retro-label mb-2">IBM Plex Mono (Code Font)</p>
        <p className="retro-body">
          System Status: [●ACTIVE] | TVL: $10,234,567 | APY: 5.23%
        </p>
        <code className="retro-code">
          function calculateRisk() return 7.5/10;
        </code>
      </div>

      {/* Press Start 2P Test */}
      <div className="retro-border p-4">
        <p className="retro-label mb-2">Press Start 2P (Display Font)</p>
        <h3 className="retro-heading-1">LEVEL UP</h3>
        <p style={{ fontFamily: 'Press Start 2P, monospace', fontSize: '12px' }}>
          SCORE: 1000
        </p>
      </div>

      {/* Terminal Test */}
      <div className="terminal-window">
        <div className="terminal-line terminal-success">✓ Fonts loaded successfully</div>
        <div className="terminal-line terminal-output">Testing retro theme...</div>
        <div className="terminal-line terminal-prompt cursor">Ready for deployment</div>
      </div>

      {/* Button Tests */}
      <div className="space-x-4">
        <button className="retro-button">STANDARD</button>
        <button className="retro-button retro-button-primary">PRIMARY</button>
        <button className="retro-button" disabled>DISABLED</button>
      </div>

      {/* Table Test */}
      <table className="retro-table">
        <thead>
          <tr>
            <th>PROTOCOL</th>
            <th>APY</th>
            <th>TVL</th>
            <th>RISK</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AAVE</td>
            <td>4.25%</td>
            <td>$1.5B</td>
            <td>3/10</td>
          </tr>
          <tr>
            <td>COMPOUND</td>
            <td>3.85%</td>
            <td>$800M</td>
            <td>4/10</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

