# Inbox folder {#eingangsordner}

Ablago can watch a folder and **take over every file that lands there as new [post](https://help.ablago.app/benutzer/aktuell/post/)**. That way scanners ("Scan to Folder"), the NAS or any other program bring documents into Ablago without anyone opening the browser.

--8<-- "ausgeblendet-organisation.md"

## Mounting {#einbinden}

The inbox folder is a separate folder in the container: **`/eingang`**. The templates for Synology, UGREEN, QNAP, TrueNAS, Unraid and `dms-komplett` already mount it, e.g.

```yaml
      # Inbox folder (optional): scanner and NAS put files here → new post
      - /volume1/docker/dms/eingang:/eingang
```

If the line is missing, there is no inbox folder and the workbench doesn't show it – existing installations keep running unchanged. After adding it, recreate the project.

You share the folder `eingang` on the NAS for the scanner (SMB), e.g. as a subfolder of an existing share. In the scanner you enter this share as the target for "Scan to Folder".

## Settings {#einstellungen}

Under **Workbench → Inbox folder**:

- **Check inbox folder** – on or off (default: on).
- **Check interval** – how often Ablago looks, 5 to 3600 seconds (default: 30).
- **After taking over** – move the file to `erledigt/` (default) or delete it.
- **Skip duplicate files** – if exactly this file (same checksum) is already in Ablago, no post is created; the file is tidied away like one taken over and listed as "duplicate – skipped" (default: off).
- **Check now** – look immediately.

Below that are the last check, files still being written, the files taken over most recently with a link to the post, and errors.

## What happens when taking over {#was-beim-ubernehmen-passiert}

- **Every file becomes a separate post** with channel *Folder*, direction incoming, status *New*. The subject is the file name without the extension. The history says "taken over from the inbox folder (eingang/…)"; it was created by the *inbox folder*, not by a user.
- **Subfolders for users:** if the file is in a subfolder with the name, first name or the part of the e-mail address before the @ of a user (e.g. `eingang/thomas/`), this user is entered under **For** – the post appears under "To do" for them. That way everyone chooses their own target on the scanner. Other subfolders count like the main folder. Ablago looks up to **5 levels** deep into subfolders; files in deeper folders stay where they are.
- **Only finished files:** a file is only taken over once its size and modification time haven't changed over two checks – scanners write slowly.
- **Skipped** are hidden and temporary files (`.*`, `~*`, `*.tmp`, `*.part`, `*.crdownload`, `*.partial`, `Thumbs.db`, `desktop.ini`), the NAS systems' folders (`@eaDir`, `#recycle`, `.@__thumb`, `@Recycle`, `.Trash*`) as well as `erledigt/` and `fehler/`.
- **Rejected** are empty files and files over 100 MB: they move to **`fehler/`**, with a text file stating the reason next to them; the workbench shows a message. If the [storage space](speicherplatz.md) limit is reached, the file stays and gets its turn as soon as there is space again.
- **Same content:** if Mappen with the same file already exist, a new post is created anyway (except with *Skip duplicate files*). Its history says "This file is already in Ablago" – without a title, because the post is often seen by more people than the other Mappe. Where the file is, **Assign** shows to everyone who may read the Mappe.
- **No double takeover**, not even after a restart or crash in the middle of taking over: the file is only moved or deleted once the post is saved.
- In [maintenance mode](wartungsmodus.md) and during a [restore](wiederherstellen.md), the inbox folder rests. If several instances of Ablago run with the same database, only one takes over.

!!! tip "Doesn't watch, but polls"
    Ablago looks regularly instead of waiting for messages from the file system. Such messages don't arrive reliably via SMB/NFS and some Docker mounts.
