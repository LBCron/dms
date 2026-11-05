# Understanding versions {#versionen-verstehen}

You know it from the file manager on your PC: if you save a file with the same name, the old one is gone. That's why many people add something to the name – `_v2`, `_old`, `_final`, a date. After a few months nobody knows which file is the right one.

In Ablago you don't have to rename anything any more. A document stays **one** document, and every new edition becomes a new **version** of it. The old editions stay underneath.

![In the past, many files with additions in their names; today one document with its versions 1 to 4](grafiken/versionen-frueher-heute.en.svg){ .grafik }

!!! info "Only where versioning is switched on"
    Versions exist in tabs where an administrator has switched on **versioning**. You can tell by the button **Replace** next to a document. If it is missing, there are no versions there – or you may only read the folder.

## Filing a new edition {#eine-neue-fassung-ablegen}

When a signed addendum, a new scan or a corrected invoice arrives for the tenancy agreement:

1. Open the folder and the tab with the document.
2. Next to the document, click **Replace** and choose the new file.
3. Done – without **Save folder**. The document now shows **Version 2** (or the next number).

The folder always shows the **newest** version. The old one isn't gone; it lies underneath. The new file name may be different, and so may the file type – `receipt.jpg` may become `receipt.pdf`.

**If you simply upload a file with the same name**, Ablago asks: do you want to save it **as a new version** (preselected) or **as a separate document with a counter**, e.g. `Invoice (2).pdf`? Without versioning, the question is instead: a separate document with a counter, or **delete the old document and upload the new one** – then the old one is gone for good.

## Viewing, downloading and restoring older versions {#altere-versionen-ansehen-herunterladen-zuruckholen}

One click on **Version 3** on the document shows all versions: when it was saved, by whom, where it came from, file name and size.

- **View** (↗) opens an older version without changing anything.
- **Download** saves it on your device.
- **Restore** makes an older version the current one again: it is taken over as a **new, highest** version – version 1 becomes e.g. version 4. The versions in between remain; so you can always go back again.

The folder's [history](zusammenarbeit.md#historie) lists every new version, e.g. "Version 3 (replaces receipt.jpg)" or "Version 1 restored".

## What you should know {#was-du-wissen-solltest}

- **Search** only finds text in the current version.
- **Limited number:** an administrator can set that only the last so-many versions are kept. Ablago then deletes older ones by itself; they can no longer be restored.
- **Deleting a document** removes it with **all** its versions. If it has older versions, Ablago asks first and names their number. It goes into the [Bin](ablage.md#papierkorb) with all versions and can be restored from there.
- **In archive mode** (retention obligation), documents cannot be deleted before the end of the period; you file a new edition there as a new version.

## Version of the document or version of Ablago? { #version-des-dokuments-oder-version-des-dms }

The word "version" turns up in two places:

| | Version of a document | Version of Ablago |
| --- | --- | --- |
| What is it? | an edition of a file in a folder | the state of the program itself, e.g. 0.73 |
| Where is it shown? | on the document: **Version 3** | under [New in this version](neu.md) and in the help |
| Who changes it? | you, with **Replace** or **Restore** | an administrator, with an update |

An update of Ablago doesn't change anything about your documents and their versions.

More about documents in general: [Documents](dokumente.md#versionen).
