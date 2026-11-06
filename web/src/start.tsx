import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DatenProvider } from './daten';
import { KontoProvider } from './konto';
import { starteSammler } from './diagnose';
import { starteErreichbarkeit } from './erreichbar';
import { Rueckfragen } from './rueckfrage';
import { Abrufseite } from './abruf';
import { Notfallseite } from './notfall';
import { Fehlergrenze } from './Fehlergrenze';

/** Erstes Bild, nachdem die Sprache feststeht (main.tsx, #729). */
export function zeige() {
  const wurzel = createRoot(document.getElementById('root')!);
  if (location.pathname === '/abruf') {
    // Öffentliche Abrufseite einer Auskunft (#455): eigenständig – ohne Anmeldung, Kontostatus und Diagnose.
    wurzel.render(<StrictMode><Fehlergrenze><Abrufseite /></Fehlergrenze></StrictMode>);
  } else if (location.pathname === '/notfall') {
    // Notfallzugang mit dem Notfallcode vom Notfallblatt (#815): eigenständig – ohne Anmeldung, Kontostatus und Diagnose.
    wurzel.render(<StrictMode><Fehlergrenze><Notfallseite /></Fehlergrenze></StrictMode>);
  } else {
    starteSammler();
    starteErreichbarkeit();
    wurzel.render(
      <StrictMode>
        {/* Fehlergrenze (#881): Ein Fehler beim Zeichnen zeigt eine Meldung statt einer leeren Seite. */}
        <Fehlergrenze>
          <KontoProvider>
            <DatenProvider>
              <App />
            </DatenProvider>
          </KontoProvider>
          {/* Rückfragen (#355) – außerhalb der Anmeldung, damit auch Einrichtung und Wiederherstellen sie haben. */}
          <Rueckfragen />
        </Fehlergrenze>
      </StrictMode>,
    );
  }
}
