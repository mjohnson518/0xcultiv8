import {
  CULTIV8_LOGO_LARGE,
  CULTIV8_LOGO_MEDIUM,
  CULTIV8_LOGO_SMALL,
  STATUS_ICONS,
  CONNECTION,
  RISK_LEVELS,
  SPINNERS,
  BOX_CHARS,
  createBox,
  BANNERS,
  DIVIDERS,
  createLoadingBar,
  createTable,
  wrapInBox,
} from '../../utils/asciiArt';

/**
 * ASCII Art Test Component
 * Displays all ASCII art assets for verification
 */
export function AsciiArtTest() {
  return (
    <div className="p-8 space-y-8 font-mono bg-white">
      <h1 className="text-2xl font-bold mb-6">ASCII Art Library Test</h1>

      {/* Logos */}
      <section>
        <h2 className="font-pixel text-lg mb-4">LOGOS</h2>
        
        <div className="bg-black text-white p-4 mb-4">
          <pre className="text-xs">{CULTIV8_LOGO_LARGE}</pre>
        </div>
        
        <div className="bg-gray-100 p-4 mb-4">
          <pre className="text-xs">{CULTIV8_LOGO_MEDIUM}</pre>
        </div>
        
        <div className="border-2 border-black p-4">
          <pre className="text-xs">{CULTIV8_LOGO_SMALL}</pre>
        </div>
      </section>

      {/* Status Icons */}
      <section>
        <h2 className="font-pixel text-lg mb-4">STATUS ICONS</h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(STATUS_ICONS).map(([key, icon]) => (
            <div key={key} className="border-2 border-black p-3 text-center">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-xs uppercase">{key}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Connection Status */}
      <section>
        <h2 className="font-pixel text-lg mb-4">CONNECTION STATUS</h2>
        <div className="space-y-2">
          {Object.entries(CONNECTION).map(([key, status]) => (
            <div key={key} className="font-mono">
              {status}
            </div>
          ))}
        </div>
      </section>

      {/* Risk Levels */}
      <section>
        <h2 className="font-pixel text-lg mb-4">RISK LEVELS</h2>
        <div className="space-y-2">
          {Object.entries(RISK_LEVELS).map(([key, level]) => (
            <div key={key} className="font-mono">
              {level}
            </div>
          ))}
        </div>
      </section>

      {/* Spinners */}
      <section>
        <h2 className="font-pixel text-lg mb-4">SPINNER FRAMES</h2>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(SPINNERS).map(([key, frames]) => (
            <div key={key} className="border-2 border-black p-4">
              <div className="text-xs uppercase mb-2">{key}:</div>
              <div className="text-2xl">{frames.join(' ')}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Box Characters */}
      <section>
        <h2 className="font-pixel text-lg mb-4">BOX DRAWING</h2>
        <div className="space-y-4">
          <pre className="text-lg">{createBox(40, 5, 'single')}</pre>
          <pre className="text-lg">{createBox(40, 5, 'double')}</pre>
          <pre className="text-lg">{createBox(40, 5, 'heavy')}</pre>
        </div>
      </section>

      {/* Banners */}
      <section>
        <h2 className="font-pixel text-lg mb-4">BANNERS</h2>
        <pre className="text-xs">{BANNERS.startup('10,234,567', '5.23')}</pre>
        <pre className="text-xs mt-4">{BANNERS.success('TRANSACTION COMPLETE')}</pre>
        <pre className="text-xs mt-4">{BANNERS.error('INSUFFICIENT FUNDS')}</pre>
        <pre className="text-xs mt-4">{BANNERS.warning('HIGH GAS PRICES')}</pre>
      </section>

      {/* Dividers */}
      <section>
        <h2 className="font-pixel text-lg mb-4">DIVIDERS</h2>
        <div className="space-y-2 text-sm">
          <div>{DIVIDERS.single}</div>
          <div>{DIVIDERS.double}</div>
          <div>{DIVIDERS.heavy}</div>
          <div>{DIVIDERS.dashed}</div>
          <div>{DIVIDERS.dotted}</div>
          <div>{DIVIDERS.withLabel('SECTION')}</div>
        </div>
      </section>

      {/* Loading Bar */}
      <section>
        <h2 className="font-pixel text-lg mb-4">LOADING BARS</h2>
        <div className="space-y-2">
          <div>{createLoadingBar(0)}</div>
          <div>{createLoadingBar(25)}</div>
          <div>{createLoadingBar(50)}</div>
          <div>{createLoadingBar(75)}</div>
          <div>{createLoadingBar(100)}</div>
        </div>
      </section>

      {/* Table Example */}
      <section>
        <h2 className="font-pixel text-lg mb-4">ASCII TABLE</h2>
        <pre className="text-xs">
          {createTable(
            ['PROTOCOL', 'APY', 'TVL', 'RISK'],
            [
              ['AAVE-V3', '5.2%', '$1.5B', '3.1'],
              ['COMPOUND', '7.8%', '$800M', '4.5'],
              ['CURVE', '12.3%', '$250M', '6.8'],
            ]
          )}
        </pre>
      </section>

      {/* Wrapped Text */}
      <section>
        <h2 className="font-pixel text-lg mb-4">TEXT IN BOX</h2>
        <pre className="text-sm">
          {wrapInBox('Welcome to Cultiv8\nYour trustless yield farming agent', 2, 'double')}
        </pre>
      </section>
    </div>
  );
}

