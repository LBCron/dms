# Sending email {#e-mail-versand}

Ablago sends invitations, password links, the [Daily summary](aufgaben.md#tagliche-zusammenfassung) and folders that someone [sends by email](https://help.ablago.app/benutzer/aktuell/en/versenden/). For this it needs a mailbox through whose mail server (SMTP) Ablago writes. You set up sending in the [setup wizard](installation.md#optionales) or later under **Workbench → email and address**. Both places are built the same way; only **Check connection** and the test email exist only in the workbench, because they need a sign-in.

What goes out in the process is listed under [What leaves your Library](datenschutz.md#was-deine-ablage-verlasst): only emails that someone triggers or switches on, via your mail server.

## The easy way: address and password { #der-einfache-weg-adresse-und-passwort }

![Sending email in the setup wizard](bilder/einrichtung-mail.png)

1. **Which email address should Ablago write with?** Prefilled is your account's address (in the wizard the one from the step "Your account"). It's best to use a separate address for Ablago, such as `ablage@example.org`.
2. Enter the mailbox's **password** or **app password**.
3. **Check connection** (in the workbench). Ablago signs in to the server without sending anything.

The wizard suggests the rest from the address and marks it with **suggested by the wizard**:

| Detail | Suggestion |
| --- | --- |
| Server, port, connection type | from the list of known providers or found (see below) |
| User | the address itself (according to some providers' settings file, only the part before the @) |
| Sender | `Ablago – {name of the Library} <address>`, e.g. `Ablago – Familie Beispiel <lena@example.org>` |
| Test email to | the same address |

Only what is visibly there is taken over. If you change a field yourself, it is no longer a suggestion and stays as you entered it. In the wizard you first tick **Set up email sending now**; without the tick, sending stays off. **Next** takes the details into the summary; there are no separate save buttons there. Saving only happens with **Set up now**. Until then, the wizard only keeps the password as long as the page is open; after reloading it asks for it again. In the workbench you save as everywhere via the bar at the bottom.

## Finding server and port { #server-und-port-finden }

Ablago looks for the server in this order:

1. **Built-in list** of common providers: GMX, WEB.DE, T-Online, Gmail, Outlook.com, iCloud, Posteo and mailbox.org. For this, nothing leaves the device.
2. If the domain isn't in the list, Ablago asks the **DNS of your domain** when leaving the address field: the SRV records `_submissions._tcp` and `_submission._tcp` (RFC 8314, RFC 6186) and the MX record. From the MX record, Ablago recognises own domains at IONOS, Strato, Microsoft 365, Google Workspace and mailbox.org.
3. Then the **settings file of your own provider**, if there is one: `https://autoconfig.<domain>/mail/config-v1.1.xml` and `https://<domain>/.well-known/autoconfig/mail/config-v1.1.xml`.
4. If Ablago finds nothing, you can **Look it up in the Thunderbird database**. That only happens at the push of this button.

**What leaves the device in the process:** in step 2 a DNS query with the domain (e.g. `example.org`) goes to the DNS server your NAS uses anyway. In step 3 two HTTPS requests go to your own provider's domain. They contain no address, and Ablago doesn't follow redirects to other addresses. In step 4 only the domain goes to `autoconfig.thunderbird.net` (Mozilla). Address and password never leave the device during the search. Every request has a time limit of a few seconds. Below the suggestion it says whom Ablago asked.

If Ablago finds no server, **Advanced** opens. Server and port are then usually in your provider's help.

## Notes per provider {#hinweise-je-anbieter}

| Provider | Server | What to note |
| --- | --- | --- |
| GMX | `mail.gmx.net`, 587, STARTTLS | First enable sending via SMTP in the mailbox: Settings → POP3/IMAP retrieval ([GMX help](https://hilfe.gmx.net/pop-imap/einschalten.html)) |
| WEB.DE | `smtp.web.de`, 587, STARTTLS | enable as with GMX ([WEB.DE help](https://hilfe.web.de/pop-imap/einschalten.html)) |
| T-Online | `securesmtp.t-online.de`, 465, SSL/TLS | the **Email password** from the customer centre, not the password for the login |
| Gmail | `smtp.gmail.com`, 465, SSL/TLS | an **app password** ([Google help](https://support.google.com/accounts/answer/185833)) or [sign-in via OAuth](#anmeldung-uber-oauth) |
| Outlook.com | `smtp-mail.outlook.com`, 587, STARTTLS | [sign-in via OAuth](#anmeldung-uber-oauth) |
| Microsoft 365 | `smtp.office365.com`, 587, STARTTLS | [sign-in via OAuth](#anmeldung-uber-oauth). Microsoft switches off password sign-in for SMTP with Exchange Online at the end of December 2026 ([Microsoft help](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission)) |
| iCloud | `smtp.mail.me.com`, 587, STARTTLS | an **app-specific password** ([Apple help](https://support.apple.com/en-gb/102654)) |
| Posteo | `posteo.de`, 587, STARTTLS | – |
| mailbox.org | `smtp.mailbox.org`, 465, SSL/TLS | – |
| IONOS | `smtp.ionos.de`, 587, STARTTLS | recognised from your domain's MX record |
| Strato | `smtp.strato.de`, 465, SSL/TLS | recognised from your domain's MX record |

Ablago shows the same notes below the suggestion, with a link to the provider's help.

## Check connection and test email { #verbindung-prufen-und-testmail }

![Workbench → email and address: sending email](bilder/werkbank-mail.png)

**Check connection** is right below the password. **Send test email** sends an email to the address under *Test email to*. Both work with the values in the form, even before you save.

If something doesn't work, Ablago names the cause in one sentence. The server's exact answer is below it under *Server's answer*.

| Message | What helps |
| --- | --- |
| Password wrong or app password needed | Check the password; for Gmail and iCloud create an app password; for GMX and WEB.DE enable sending |
| Google requires an app password | Create an app password or use OAuth |
| Microsoft doesn't allow password sign-in here | [Sign-in via OAuth](#anmeldung-uber-oauth) |
| The server doesn't allow this sender | use the account's address as the sender |
| The connection type doesn't match the port | 465 belongs to SSL/TLS, 587 to STARTTLS |
| The server's certificate is not trusted | check the server name; only for your own server on the home network *Allow self-signed certificate* |
| The server doesn't answer / No connection | check server and port; some networks block outgoing mail ports |

## Advanced { #erweitert }

Collapsed under **Advanced** are all fields: server, connection type (STARTTLS, usually port 587; SSL/TLS, usually 465; unencrypted only on the home network), port, user, sender, *Remove stored password* and *Allow self-signed certificate*. An empty user means: without sign-in, for instance for a mail server on the home network.

Ablago stores the password encrypted with the [key](verschluesselung.md) and never shows it again.

## Sign-in via OAuth { #anmeldung-uber-oauth }

With **Microsoft 365, Outlook.com** and **Gmail**, Ablago can send via **OAuth** instead of a password (SMTP with XOAUTH2). It is the same sign-in as for the [mailboxes](postfaecher.md#anmeldung-mit-oauth): the same app at the provider, the same redirect URI, the same process in the browser or with a device code.

1. Create the app at the provider, as described under [Mailboxes → Sign-in with OAuth](postfaecher.md#anmeldung-mit-oauth). For **Microsoft** it additionally needs the permission **SMTP.Send** (Office 365 Exchange Online, delegated). For **Google** the scope `https://mail.google.com/` applies to fetching and sending.
2. **Workbench → email and address**: enter the address, choose *Sign-in* **Via Microsoft (OAuth)** or **Via Google (OAuth)** and **save**.
3. Below it, if not done yet, enter **client ID** and **client secret** and then **Sign in in the browser** or **Sign in with device code** (Microsoft only).
4. **Check connection**.

OAuth doesn't exist in the setup wizard yet, because the app has to be created at the provider beforehand. A notice says so there; it is set up afterwards in the workbench.

!!! note "Security"
    With OAuth, Ablago only sends the access token to the provider's own sending server (`smtp.office365.com`, `smtp-mail.outlook.com` or `smtp.gmail.com`), only encrypted and only with a valid certificate. Ablago only stores tokens encrypted; they never appear in the interface. If you change the sign-in type, provider, account or server, or the tenant on the app, Ablago signs sending out. The provider sees every sign-in, but no paperwork except the emails that go out through it.

Ablago renews the sign-in itself before it expires. If it has expired or been revoked, sending fails with a clear notice until you sign in again in the workbench. There is no email about this, because it would have to go via exactly this sign-in.
