# Backup {#sicherung}

How to restore a backup and how Ablago test-restores it weekly is described under [Restoring](wiederherstellen.md).

Under **Workbench → Backup**, Ablago creates backups itself: the whole database and all files at the **same point in time**, encrypted, without anyone having to stop working.

You restore a backup with Ablago. If you additionally want your paperwork in a form you can read **even without Ablago** – for instance to take it into another program –, use the [full export](export.md) in open formats.

![Backup in the workbench](bilder/werkbank-sicherung.png)

## What a backup contains { #was-eine-sicherung-enthalt }

Every backup consists of two files in the backup folder, e.g.:

| File | Content |
| --- | --- |
| `2026-10-29_0200-automatisch.dms-sicherung` | database and all files (documents, [converted versions](texterkennung.md#andere-dateitypen), logos, images of reported problems), packed and **encrypted** |
| `2026-10-29_0200-automatisch.json` | metadata, readable: Library id (field `haushaltId`), versions (Ablago, database state, PostgreSQL, Node.js, operating system, architecture), kind, start and duration, number of folders, documents, users and converted versions (field `anzahl.fassungen`), sizes, encryption with the key's fingerprint and the **SHA-256 checksum** of the backup file |

- Encryption uses AES-256-GCM. The key for it is derived from the key under **Workbench → [Encryption](verschluesselung.md)** – the same as for password fields. **Without this key, a backup can't be read.** It is never in the backup, only in the key file and on the [emergency sheet](#notfallblatt).
- Signed-in sessions don't belong to it: after a restore, everyone signs in anew.
- Packages' **converted versions** (e.g. a TIFF scan as PDF, see [Other file types](texterkennung.md#andere-dateitypen)) **are included** since version 0.140.1, with the information which package created them. After a restore, version, full text and preview are there as before – even if the package is no longer installed or a newer version would convert differently today.
- Packages' **archive versions (PDF/A)** (see [Archive version](texterkennung.md#archivfassung-pdfa)) are likewise included since version 0.149, with status and the word positions of text recognition. The metadata names their number (`anzahl.archivfassungen`); the test restore checks each against its checksum.
- The documents' **previews** aren't included – they are recreated by themselves after a restore (from the file or the version), and nothing refers to them. The principle: when in doubt, something goes into the backup; only what can be recreated identically at any time stays out.
- Ablago reads the database itself – independent of the PostgreSQL version. A backup is therefore also suitable for switching to a new major version of PostgreSQL.
- A **check word** (a known word, encrypted in the database) shows after a restore whether the right key applies.

Without a key, no backup can be created; the page then points to encryption.

## Back up now { #jetzt-sichern }

At the top of the section, the status is in one line: last backup, number and size of the backups, next date according to the schedule, free space and when the emergency sheet was downloaded.

**Back up now** starts a backup in the background, with progress. You can leave the page. If less space is free than the [minimum storage space](#zeitplan-und-aufbewahrung), no backup begins.

The list shows all backups in the folder with time, kind, size and content. **Check** recalculates the file's checksum and compares it with the one from the metadata – "unchanged" means: the file is as Ablago wrote it. **Delete** removes both files.

In the container this also works without a browser with the [command `dms`](konsole.md#betrieb): `dms sicherung` lists the backups, `dms sicherung jetzt` starts one, `dms sicherung pruefen <name>` checks one.

## Schedule and retention { #zeitplan-und-aufbewahrung }

![Schedule and retention](bilder/werkbank-sicherung-zeitplan.png)

- **Back up automatically** daily or weekly at a time (e.g. daily 02:00). If Ablago was off at that time, it backs up as soon as it runs again – but only on the same day. It doesn't catch up on a missed backup from the previous day; it only backs up again at the next scheduled date. There is never more than one automatic backup per day.
- The schedule can only be switched on once the **emergency sheet** has been downloaded – because a backup can only be opened with the key on it.
- **Retention** (default **7 daily / 4 weekly / 12 monthly**): of the automatic backups, the newest per day, per week and per month remains, as many as set; Ablago removes older ones after every automatic backup. Backups created by hand stay until you delete them.
- **Keep only the newest locally** (since 0.142): instead of the retention, only the newest automatic backup stays in the folder – for tight space, when an [off-site copy](sicherung-ausser-haus.md) is made. A backup whose copy is currently running stays until it has arrived (at most 2 days). "None locally" doesn't exist.
- **Minimum storage space** (default 1 GB): if less is free in the backup folder, no backup begins; this is shown as a notice in the workbench and in the log.
- In active [maintenance mode](wartungsmodus.md), the automatic backup pauses.

!!! note "Later"
    Backups that only contain new files save space but make restoring a chain. That only comes when space is pressing.

## Storage space { #speicherplatz }

The page shows how large documents and database are today, a **projection** for the chosen retention (every backup is complete; the database packs well, documents hardly), how much the backups take up and how much is free in the folder. If it gets tight – less free than the minimum storage space or than two more backups –, it warns. Independently of this, **Workbench → [System health](speicherplatz.md)** monitors all of Ablago's folders with a warning threshold and limit.

## Notices on problems { #hinweise-bei-problemen }

The workbench overview shows a notice if

- the last backup **failed**,
- the last successful one is **older than 2 days** (or there is none yet),
- the emergency sheet is missing or belongs to an earlier key,
- the backup folder isn't a separate volume or is on the same disk as the documents,
- the [off-site copy](sicherung-ausser-haus.md#anzeige-und-hinweise) failed or no newer backup has arrived there for more than 2 days.

If a backup fails, all administrators get an email – also without a schedule, for instance with **Back up now**. If the last successful backup is too old, the email only comes if the schedule is on. **One** email comes per incident (not hourly) – if [Email sending](installation.md#e-mail-und-adresse) is set up. Everything is also recorded in the [log](fehlersuche.md#protokoll), module *sicherung*.

## Storage location { #speicherort }

The backup folder is a separate volume in the [Compose templates](https://github.com/motom001/dms/tree/main/deploy) – with two containers as with [dms-komplett](https://help.ablago.app/installieren/aktuell/en/komplett/):

```yaml
volumes:
  - /volume1/docker/dms/sicherung:/data/sicherung
```

If it is on the same disk as database and documents, the backup is useless if this disk fails. The workbench warns if it recognises this (same disk as the documents; Ablago doesn't see the database's disk). Stick to the **3-2-1 rule**:

- **3 copies** of your data: the running Ablago and two backups,
- on **2 different media**, e.g. NAS and USB disk,
- **1 copy off site**, e.g. in the cloud or at relatives'.

Ablago only writes into the backup folder. You have the NAS copy it on, for example:

- **Synology:** *Hyper Backup* with the folder `docker/dms/sicherung` as the source, target USB disk or cloud (C2, S3, …).
- **UGREEN, QNAP and others:** the NAS's backup app (e.g. *Hybrid Backup Sync*) or a synchronisation to a USB disk.
- Alternatively put the backup folder straight onto a second disk of the NAS (`/volume2/…`) and copy that on.

Without a backup app – for instance on a Raspberry Pi or a rented server – a package such as **Backup target WebDAV** brings every backup off site itself and checks it there, see [Off-site backup](sicherung-ausser-haus.md).

As the backups are encrypted, they may also go into a cloud. The [emergency sheet](#notfallblatt) with the key does **not** belong there.

**What is unencrypted and where it is:** full exports, "Export my data" and access copies under Art. 15 are unencrypted. That's why they are not in the backup folder but in their own [export folder](export.md#export-ordner) (`/data/export`, next to `files/`) and are deleted after downloading or after 7 days. So you can copy the backup folder completely into the cloud. If you put the export folder somewhere else yourself, then never into the backup folder – the workbench warns if it is there.

## Emergency sheet { #notfallblatt }

**Download emergency sheet** (here and under *Encryption*) creates a PDF with everything you need after a failure – on **one A4 page** in Ablago's look, easily readable in black and white too. The sheet is in German:

1. **Header:** logo, name of your Library, date and Ablago version.
2. **Key:** large in groups of four for typing, plus its **fingerprint**. The zero is struck through, and below easily confused characters (`0` and `O`, `l`, `I` and `1`, `-` and `_`) it says in small print which one is meant. There is deliberately no QR code with the key – that would be one more way to get at it.
3. **This Library:** address, **Library id** and, in one sentence, where the backups are – since 0.142 also the target of the [off-site copy](sicherung-ausser-haus.md) (package and address, without user and password).
4. **Whom to ask?** Lines in which you enter who helps you in an emergency.
5. **Something has happened?** The links to the help page [What has happened to you?](was-ist-passiert.md) – clickable and always written out with `https://`: `https://help.ablago.app/notfall` (English `https://help.ablago.app/emergency`) – and a **QR code** for it. Scan it with your phone, read there and work on the computer at the same time.
6. **Locked out?** The **emergency code**: 28 characters in groups of four and your Library's address with `/notfall`. With it you get back in if you have locked yourself out – see [Getting back in with the emergency code](was-ist-passiert.md#notfallcode). It isn't the key and opens no backup.

**Every emergency sheet has a new emergency code.** Ablago only stores a hash of it; the code of a sheet downloaded earlier no longer works afterwards. So always print the most recently downloaded sheet. If the code has been used, it no longer works either – the overview then reminds you of a new sheet, as it does for a sheet from the time before the emergency code.

Folders, file names and the steps for restoring are not on the sheet but here in the manual under [Restoring](wiederherstellen.md) – they stay up to date there. An address without `https://` appears on the sheet without `http://` in front and isn't clickable.

![Emergency sheet](bilder/notfallblatt.png)

Where the database password is depends on the template:

| Template | Database password |
| --- | --- |
| general template (`deploy/nas`) | in the file `.env` next to the Compose file (`DB_PASSWORD`) |
| Synology, UGREEN, QNAP, TrueNAS, Unraid | at the top of the Compose file (`x-passwort`) |
| dms-komplett | none – the database can only be reached inside the container |

It isn't on the emergency sheet. For a new system a new password is enough anyway.

**Keeping it:** printed in a safe place (e.g. with the family documents or in the business's safe) or as a PDF in a password safe – in any case **separately from the NAS** and not next to the backups. Whoever has the sheet can read the backups.

Every download is recorded in the log (without the key). If the key changes ([Changing the key](verschluesselung.md#schlussel-wechseln)), the workbench points out that a new emergency sheet should be created; older backups still need the old one – keep it as long as there are such backups. In the list they carry the note "earlier key"; with **Delete backups with an earlier key** you remove them all at once. The [test restore](wiederherstellen.md#probe-wiederherstellung) needs the current key – backups with an earlier key can't be test-restored.

!!! tip "For the self-employed and landlords"
    How backup, history and permissions together result in orderly receipt filing is described in the [procedure documentation template](verfahrensdokumentation.md).
