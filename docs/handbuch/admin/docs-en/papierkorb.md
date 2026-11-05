# Recycle bin {#papierkorb}

Deleted Mappen go into the recycle bin – including documents and links. Individually deleted **documents** too, with all versions and the full text. After the set retention, Ablago deletes them permanently.

- In the **filing view**, every user sees under *Recycle bin* only what **they themselves** deleted, and can restore it or delete it permanently. The entry is at the top among the fixed entries below *Favourites* – but only as long as the recycle bin is switched on or something is still in it.
- Under **Workbench → Recycle bin** you as an administrator see everything, with "deleted by": in the middle at the top the **retention** with **Empty recycle bin**, below it the deleted Mappen and documents. If you choose a Mappe, it appears on the right – there you restore it or delete it permanently.

![Workbench → Recycle bin](bilder/werkbank-papierkorb.png)

## Retention { #aufbewahrung }

At the top in the middle under **Retention** you set how many days deleted Mappen and documents stay (default: 30). Next to it, **Empty recycle bin** empties everything at once. Only removing the [demo data](demo.md) is permanent immediately. Ablago tidies up hourly.

**0 days switches the recycle bin off:** deleting is then permanent immediately, as before version 0.11. What is currently in the recycle bin is deleted permanently on saving – the workbench asks first.

Every user can set under My account that their recycle bin is **emptied on sign-out**.

### History of permanently deleted Mappen {#historie-endgultig-geloschter-mappen}

Every Mappe has a **history** (who changed what when). If a Mappe is deleted permanently, its history stays in the database for a while, so that it can be traced what happened to it. How long you set below under **Keep history of permanently deleted Mappen** (default: 365 days; 0 deletes it immediately too). The history of living Mappen always stays.

## What applies in the recycle bin {#was-im-papierkorb-gilt}

- Mappen in the recycle bin appear nowhere else: not in views, counters, search, link selection or the API.
- They don't block **unique values**: a new Mappe may get the same invoice number.
- As before, a Mappe that others still link to can't be deleted in the first place.
- **Restore** brings back documents and links. Links to Mappen that no longer exist in the meantime are dropped. If a unique value has been taken in the meantime, the Mappe lands under **To do** for whoever created it.
- **Delete with linked Mappen** ([User manual](https://help.ablago.app/benutzer/aktuell/mappen/#mit-verknupften-mappen-loschen)) puts all Mappen into the recycle bin as **one operation**. They can be restored together (**Restore all**) – with the links between them (also in a circle) and the links that were removed from Mappen that stay. Individually works too; then only this one Mappe's links come back.
- A Mappe type can't be deleted as long as Mappen of it are in the recycle bin.
- Mappen of a Mappe type in [archive mode](archiv.md) stay in the recycle bin until their retention period ends – even if the recycle bin's retention expires earlier. They can't be deleted permanently before that, not even as an administrator.
- The files stay in the file folder until the recycle bin is emptied.
- Every step – into the recycle bin, restored, deleted permanently (by hand, emptied or after expiry) – is recorded in the [deletion log](datenschutz.md#loschprotokoll), without titles and contents.

## Individual documents {#einzelne-dokumente}

- A document deleted from a tab moves into the recycle bin with **all versions** and **full text**. It no longer appears in the Mappe, in the search or in the API – until it is restored.
- The list shows it under **Documents** with Mappe, tab, size and who deleted it when.
- **Restore** puts it back into the same tab of the same Mappe; the Mappe's history records "Document into the recycle bin" and "Document restored". In the filing view, whoever deleted it and may still edit the Mappe may do this; in the workbench every administrator.
- If the Mappe itself is in the recycle bin, the Mappe comes back first; if it no longer exists, the document can only be deleted permanently. If a Mappe is deleted permanently, its individually deleted documents go too.
- Retention, **Empty recycle bin** and 0 days apply to documents in the same way. [Archive mode](archiv.md) blocks deleting a document beforehand, as before.
- Backup and restore contain the recycle bin; the [full export](export.md) lists the documents in the recycle bin in `papierkorb-dokumente.jsonl`.

!!! note "Permanent immediately"
    **Workbench → Demo data → remove** doesn't go via the recycle bin.

## Users and roles {#benutzer-und-rollen}

Roles go into the recycle bin like other Mappen; their assignment to users is dropped when deleted.

Whoever deletes an **invitation** (a user who has never signed in) puts their Mappe into the recycle bin; the user is **deactivated** until then. Only on emptying is the account deleted; **Restore** activates it again.
