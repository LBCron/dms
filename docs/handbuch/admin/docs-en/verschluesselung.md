# Encryption {#verschlusselung}

Passwords and other secrets that Ablago stores are encrypted in the database. Ablago keeps the key for this in a **separate file**, never in the database. A database backup alone therefore reveals no secrets.

What exactly is encrypted is shown on the page under [What is encrypted](#was-verschlusselt-ist) with the number per kind.

![Workbench → Encryption](bilder/werkbank-verschluesselung.png)

## What is encrypted { #was-verschlusselt-ist }

The section **What is encrypted** counts every kind of encrypted value – also with 0, so you see what belongs to it:

| Kind | Where you enter it |
| --- | --- |
| **Password fields in Mappen** | [password fields](mappentypen.md#passwortfelder) in the filing view |
| **Password fields in the recycle bin** | deleted Mappen in the [recycle bin](papierkorb.md) |
| **E-mail sending** (password of the mail server) | **Workbench → E-mail and address** |
| **Mailboxes (IMAP password)** | [mailboxes](postfaecher.md) with password sign-in |
| **Mailboxes (OAuth: app secret)** | the client secret of the app at the provider, under [Mailboxes](postfaecher.md) |
| **Mailboxes (OAuth sign-in)** | access and refresh tokens after signing in at the provider |
| **Sign-in via a provider (OIDC)** | the client secret under [Sign-in protection](anmeldeschutz.md#anmeldung-uber-einen-anbieter-openid-connect) |
| **Two-factor sign-in** | the secret of every user who has set up [two-factor sign-in](anmeldeschutz.md#zwei-faktor-anmeldung) |
| **Package settings (secrets)** | fields of type secret in the settings of [packages](pakete.md) |

If a value can't be read with the existing key, "… not readable" appears next to it; which one it is appears below under *Unreadable or unencrypted values*. If a row **Further settings** turns up, the display doesn't know this kind yet – it is still encrypted and taken along when changing; feel free to report it as a bug.

Ablago encrypts the [backups](sicherung.md) with a key derived from this one; they aren't in the list.

## Creating the key { #schlussel-erzeugen }

1. In the Compose file, the folder `/data/geheim` must be a separate volume (see [Installation](installation.md)), e.g.
   ```yaml
   - /volume1/docker/dms/geheim:/data/geheim
   ```
2. **Workbench → Encryption → Create key.** A restart is not necessary.

Afterwards the page shows the state **present** and the key's **fingerprint** (e.g. `5E27-9473-05C5-D6A0`). As long as there is no key, a notice appears above the whole workbench, and no passwords can be saved.

!!! warning "Back up the key separately"
    Copy the file `geheim/dms.schluessel` to a safe place, separately from the database backup. A database can only be fully restored with this key – without it, the passwords in it can no longer be read.

The page also checks whether the folder really is a separate volume. If not, it points this out: without a volume, the file would be gone as soon as the container is recreated (e.g. on an update).

## Changing the key { #schlussel-wechseln }

If the key could have become known – for instance because a printed emergency sheet was lost – or you want to renew it regularly: **Workbench → Encryption → Change key.** In case of a security incident, first lock everyone else out with [Lock right now](wartungsmodus.md#jetzt-sofort-sperren).

![Key changed](bilder/werkbank-schluesselwechsel.png)

After a confirmation – for safety you type the word **wechseln** there –

1. Ablago creates a new key,
2. re-encrypts all secrets in the database **completely or not at all**; if something aborts, the previous key stays valid. This includes everything under [What is encrypted](#was-verschlusselt-ist): password fields in Mappen and in the recycle bin, mail server, mailboxes (IMAP password, OAuth app and OAuth sign-in), the provider's client secret, two-factor secrets and package secrets,
3. sets the check word anew and
4. replaces the key file. The old key is not kept.

Values that were already unreadable before stay as they are; Ablago says how many there are. The change is recorded in the log with old and new fingerprint (without the key). The key can't be changed during a backup.

**Afterwards:**

The page shows the next two steps with a button each; a completed step gets a tick:

- **Download a new emergency sheet** – the button **Download emergency sheet** downloads the PDF directly (like the button in the section *Emergency sheet* below). Until then, overview and backup point this out.
- **Create a new backup** – with **Back up now**.
- **Older backups** remain encrypted with the old key. The list under [Backup](sicherung.md) marks them with "earlier key". To [restore](wiederherstellen.md) such a backup, Ablago asks for the key from the old emergency sheet. Keep it as long as you need these backups – or delete them with **Delete backups with an earlier key**.

!!! warning "Copies of the key file"
    If you copied the file `geheim/dms.schluessel` somewhere, replace the copy with the new file.

## States {#zustande}

| State | Meaning | What to do |
| --- | --- | --- |
| **missing** | There has never been a key. | Create a key. |
| **present** | Everything is fine. | – |
| **lost** | There was a key, but the file is missing. | Put the file from your copy back into `geheim/` and restart Ablago. If it is lost, create a new key and enter the secrets anew – see [Key lost](#schlussel-verloren). |
| **doesn't match** | Under `geheim/` there is a different key from the one the passwords are encrypted with. | Put the right file there and restart – or remove the wrong one, restart and create a new key. |

Under **Unreadable or unencrypted values**, the page lists which passwords and secrets can't be read with the existing key (e.g. after a new key) and where you enter them anew – also mailboxes, OAuth sign-ins, the provider's client secret, two-factor secrets and package secrets. An SMTP password from a version before 0.11 appears there as "unencrypted" until there is a key; then it is encrypted automatically.

## Key lost { #schlussel-verloren }

Your Mappen and documents aren't affected – only stored secrets such as mailbox passwords can no longer be read by Ablago without the key file. If you create a new key, you enter them again like this:

- **Password fields and mail server:** the values are listed under *Unreadable or unencrypted values*. Enter them anew.
- **Mailboxes:** fetching fails until you enter the password anew under **Workbench → Mailboxes**. With OAuth you enter the app's client secret anew and sign the mailboxes in again at the provider.
- **Sign-in via a provider:** sign-in fails until you enter the client secret anew under **Workbench → Sign-in protection**.
- **Two-factor sign-in:** codes from the authenticator app no longer match. Users only get in with their recovery codes. Reset two-factor sign-in under **Workbench → Users**; the user then sets it up anew.
- **Package secrets:** enter them anew in the package's settings.
- **Backups:** older backups can only be restored with the old key from the [emergency sheet](sicherung.md#notfallblatt).
