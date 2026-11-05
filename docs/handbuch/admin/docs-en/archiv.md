# Archive mode and retention {#archivmodus-und-aufbewahrung}

Some receipts you have to keep: in Germany, tradespeople's invoices privately for 2 years (§ 14b UStG); with bookkeeping or a cash-basis accounting, accounting receipts for 8 years (since 2025), books for 10 years, business letters for 6 years – each from the end of the calendar year. **Archive mode** keeps such Mappen unchangeable until the end of their period and tells you afterwards what may go.

--8<-- "ausgeblendet-organisation.md"

!!! tip "Readable over many years"
    Three things help documents stay readable throughout the whole period: the [archive version (PDF/A)](texterkennung.md#archivfassung-pdfa), a format that any program will still open in many years; [Check all files](#alle-dateien-prufen), which compares every file with its checksum; and the [full export](export.md), a copy in open formats that you can read without Ablago.

!!! warning "Supports – replaces nothing"
    Archive mode **supports retention in line with the GoBD**. There is no official "GoBD certificate" for software: it only becomes proper through software, procedure and a **procedure documentation** together (you'll find a template under [Procedure documentation](verfahrensdokumentation.md)). It replaces neither this nor tax advice.

## Switching on {#einschalten}

In the Mappe type under **Archive mode**:

- **Switch on archive mode** (default: off).
- **Retention period** in years: suggestions 2, 6, 8, 10 or your own number (up to 30).
- **Reference date:** which date field counts, e.g. *Invoice date*; without a field, the Mappe's creation date. The period runs until **31.12.** of the reference year plus the years – an invoice of 2 March 2026 with 8 years thus until 31.12.2034. If a Mappe's date field is empty, its creation date counts.

This also applies immediately to existing Mappen. When switching on, Ablago shows how many Mappen are affected and how many of them would already "may go". Switching on, changing and switching off are recorded in the [log](fehlersuche.md#protokoll) – only when **saving** the Mappe type, with the state before and after (on/off, period, reference date); trying things out in the editor without saving leaves no entry. Switching off asks first.

## During the period {#wahrend-der-frist}

- Every Mappe shows **Archive · keep until 31.12.YYYY**, the list a note **Archive**. If the date field changes, the period changes – this is recorded in the Mappe's history.
- **No deletion before the end of the period:** neither the Mappe nor individual documents, not even by administrators, via multiple selection, recycle bin or the [interface](api.md) (409 with the date). Mappen that were already in the recycle bin before switching on stay there until the end of the period and are not emptied automatically.
- **Documents only change as a new version:** [versioning](mappentypen.md#register) is mandatory for all document tabs of the Mappe type; older versions remain until the end of the period ("only the last N" doesn't apply here).
- **Field changes** remain possible and are recorded in the history as always. The history of these Mappen is never cleaned up.

<a id="nach-der-frist-darf-weg"></a>

## After the period: "Retention expired" { #nach-der-frist-aufbewahrung-abgelaufen }

Under **Workbench → Retention expired** are all Mappen from Mappe types in archive mode whose period has expired, with the date. You choose individual ones or all and delete them – with the recycle bin into it, otherwise permanently. **Nothing is ever deleted automatically.** How archive mode, "Retention expired" and the recycle bin fit together into a locking and deletion concept under the GDPR is described under [Data protection in Ablago](datenschutz.md#sperr-und-loschkonzept-aufsetzen), with a [deletion concept template](loeschkonzept.md).

## Check all files { #alle-dateien-prufen }

Under **Workbench → Maintenance → Maintenance operations → Check all files**, Ablago reads every stored file – including older versions – and compares it with its checksum (SHA-256). Deviations ("content changed", "file missing") are listed with document and Mappe and in the log. Check this, for example, after moving the storage and before destroying paper.

## Backup {#sicherung}

The archive settings belong to the Mappe type and are part of every [backup](sicherung.md); after a restore they apply unchanged.
