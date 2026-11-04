/**
 * Symbole für Ansichten (#428): eine feste Auswahl aus Lucide (https://lucide.dev, lucide-static 0.460.0, ISC) –
 * derselbe Symbolsatz wie im Katalog und in den Clients. Gespeichert wird nur der Lucide-Name (z. B. `house`).
 * Namen werden nie umbenannt oder entfernt, nur ergänzt; ein unbekannter Name (Paket für eine neuere Version)
 * heißt „ohne Symbol“. Die Formen liegen in web/src/ansichtsymbol-formen.ts.
 */
export interface AnsichtSymbolGruppe { gruppe: string; symbole: Array<{ name: string; titel: string }> }

export const ANSICHT_SYMBOLE: AnsichtSymbolGruppe[] = [
  { gruppe: "Haus und Wohnen", symbole: [
    { name: "house", titel: "Haus" }, { name: "sofa", titel: "Wohnen, Möbel" }, { name: "key-round", titel: "Schlüssel" }, { name: "lamp", titel: "Lampe" }, { name: "plug", titel: "Strom" }, { name: "zap", titel: "Energie" }, { name: "droplet", titel: "Wasser" }, { name: "flame", titel: "Heizung, Gas" }, { name: "hammer", titel: "Handwerk" }, { name: "wrench", titel: "Wartung, Reparatur" }, { name: "trees", titel: "Garten" },
  ] },
  { gruppe: "Fahrzeuge und Reisen", symbole: [
    { name: "car", titel: "Auto" }, { name: "bike", titel: "Fahrrad" }, { name: "bus", titel: "Bus, Bahn" }, { name: "plane", titel: "Reise, Flug" }, { name: "fuel", titel: "Tanken" }, { name: "map-pin", titel: "Ort" }, { name: "globe", titel: "Welt, Ausland" }, { name: "umbrella", titel: "Urlaub" },
  ] },
  { gruppe: "Geld und Verträge", symbole: [
    { name: "euro", titel: "Geld" }, { name: "wallet", titel: "Konto, Geldbörse" }, { name: "piggy-bank", titel: "Sparen" }, { name: "credit-card", titel: "Karte" }, { name: "receipt", titel: "Rechnung, Beleg" }, { name: "landmark", titel: "Bank, Behörde" }, { name: "signature", titel: "Vertrag" }, { name: "scale", titel: "Recht" }, { name: "shield-check", titel: "Versicherung" }, { name: "percent", titel: "Steuern, Zinsen" }, { name: "calculator", titel: "Rechnen" },
  ] },
  { gruppe: "Gesundheit", symbole: [
    { name: "heart", titel: "Herz" }, { name: "heart-pulse", titel: "Gesundheit" }, { name: "pill", titel: "Medikamente" }, { name: "stethoscope", titel: "Arzt" }, { name: "hospital", titel: "Krankenhaus" },
  ] },
  { gruppe: "Familie und Freizeit", symbole: [
    { name: "users", titel: "Familie, Personen" }, { name: "user", titel: "Person" }, { name: "baby", titel: "Kind" }, { name: "dog", titel: "Hund" }, { name: "cat", titel: "Katze" }, { name: "gift", titel: "Geschenk" }, { name: "graduation-cap", titel: "Ausbildung" }, { name: "school", titel: "Schule" }, { name: "music", titel: "Musik" }, { name: "book-open", titel: "Buch" }, { name: "utensils", titel: "Essen" }, { name: "shopping-cart", titel: "Einkauf" }, { name: "leaf", titel: "Natur" }, { name: "sun", titel: "Sommer" },
  ] },
  { gruppe: "Arbeit", symbole: [
    { name: "briefcase", titel: "Arbeit" }, { name: "building-2", titel: "Firma, Gebäude" }, { name: "factory", titel: "Betrieb" }, { name: "laptop", titel: "Computer" },
  ] },
  { gruppe: "Post und Kommunikation", symbole: [
    { name: "mail", titel: "Post, E-Mail" }, { name: "inbox", titel: "Posteingang" }, { name: "send", titel: "Gesendet" }, { name: "phone", titel: "Telefon" }, { name: "message-square", titel: "Nachricht" }, { name: "newspaper", titel: "Zeitung" },
  ] },
  { gruppe: "Fristen und Aufgaben", symbole: [
    { name: "calendar", titel: "Kalender" }, { name: "clock", titel: "Zeit" }, { name: "bell", titel: "Erinnerung" }, { name: "alarm-clock", titel: "Wecker" }, { name: "list-checks", titel: "Aufgaben" }, { name: "timer", titel: "Frist" },
  ] },
  { gruppe: "Ordnung", symbole: [
    { name: "folder", titel: "Ordner" }, { name: "archive", titel: "Archiv" }, { name: "tag", titel: "Schlagwort" }, { name: "star", titel: "Favoriten" }, { name: "bookmark", titel: "Lesezeichen" }, { name: "file-text", titel: "Dokument" }, { name: "files", titel: "Dokumente" }, { name: "box", titel: "Kiste" }, { name: "image", titel: "Bild" }, { name: "camera", titel: "Foto" },
  ] },
];

export const ANSICHT_SYMBOL_NAMEN: ReadonlySet<string> = new Set(ANSICHT_SYMBOLE.flatMap((g) => g.symbole.map((s) => s.name)));

/** Gültiger Name oder null (unbekannt, leer, kein Text). */
export const ansichtSymbol = (v: unknown): string | null => (typeof v === 'string' && ANSICHT_SYMBOL_NAMEN.has(v.trim()) ? v.trim() : null);
