/**
 * Öffentliche Schlüssel des DMS-Projekts für den offiziellen Paketkatalog (#594, motom001/dms-registry#74).
 *
 * Die Registry signiert `katalog.json` mit dem Signierschlüssel (Secret in der CI). Der Reserveschlüssel liegt
 * offline beim Maintainer und ersetzt ihn, falls der Signierschlüssel verloren geht oder bekannt wird. Gültig ist
 * eine Signatur mit einem der beiden.
 *
 * DIES IST DIE EINZIGE STELLE ZUM AUSTAUSCHEN. Austausch: Entwicklerhandbuch → Pakete → „Signierter Katalog“.
 * Danach SECURITY.md und SECURITY.en.md (Fingerabdrücke) anpassen; `test` auf false setzen.
 *
 * ACHTUNG: Solange `test: true` gilt, sind das TESTSCHLÜSSEL. Ihre privaten Gegenstücke stehen offen in
 * server/test/katalogschluessel.ts – eine damit erzeugte Signatur beweist nichts. Vor einem Release mit
 * Pflichtsignatur (Stufe 2) müssen hier die echten Schlüssel des Maintainers stehen.
 */
export interface Projektschluessel {
  /** Wofür der Schlüssel da ist (Anzeige, Protokoll). */
  rolle: 'signier' | 'reserve';
  /** Öffentlicher Ed25519-Schlüssel als PEM (SPKI), wie ihn `openssl pkey -pubout` ausgibt. */
  pem: string;
  /** Testschlüssel: privates Gegenstück ist öffentlich bekannt. */
  test: boolean;
}

export const PROJEKT_SCHLUESSEL: readonly Projektschluessel[] = [
  {
    rolle: 'signier',
    test: true,
    pem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAIIKEJ/M9CeAWQgOXOLBE/G55/iPWuwjKAdkpH+XvO/o=\n-----END PUBLIC KEY-----\n',
  },
  {
    rolle: 'reserve',
    test: true,
    pem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA2UlaDjYJqY3lWHYmgRPJR85WIDCK9z7I8o2zqudhDQY=\n-----END PUBLIC KEY-----\n',
  },
];
