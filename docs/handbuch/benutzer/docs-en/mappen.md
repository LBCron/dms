# Mappen

A Mappe collects everything about one thing: the details, the documents and the connections to other Mappen.

![Open Mappe with tabs](bilder/ablage.png)

## Structure of a Mappe {#aufbau-einer-mappe}

At the top is the Mappe's **title**. You don't have to write it yourself: Ablago puts it together from the details, for example from the invoice number and date – "R-2026-117 of 02.03.2026". If a detail changes, the title changes with it.

Below it are the **index values** every Mappe has: when and by whom it was created and last changed. Uploaded and removed documents count as changes too, but notes and tasks don't. A click on a name opens that user's Mappe. With the **star** to the right of the title you remember the Mappe as a [favourite](ablage.md#favoriten).

Then come the **tabs** – the Mappe's dividers. There are four kinds:

| Tab | What it contains |
| --- | --- |
| **Details** (e.g. "Contract", "Master data") | fields to fill in |
| **Documents** (e.g. "Contract documents") | uploaded files, see [Documents](dokumente.md) |
| **Links** (e.g. "Invoices") | other Mappen that link to this Mappe |
| **History** | who changed what on the Mappe when, see [History](zusammenarbeit.md#historie) |

After document and link tabs it says how much is in them. A red dot shows on which tab a field isn't right yet.

## Creating a Mappe {#eine-mappe-anlegen}

1. On the left, choose the view of the Mappe type, for example *Invoice*.
2. Click **+ New**.
3. Fill in the fields. Fields with **\*** are required. Below some fields there is a hint about what belongs in them.
4. Click **Save Mappe**.

!!! info "Archive – keep until"
    If a Mappe shows **Archive · keep until 31.12.YYYY**, it must be kept until then: until that day, neither the Mappe nor its documents can be deleted; you replace documents as a new version. After that, whoever has the permission may delete it; administrators find all expired Mappen collected under **Workbench → Retention expired**.

!!! info "Only matching Mappen"
    Some link fields only offer certain Mappen, e.g. for the field *Doctor* only contract partners who are doctors. If "no longer matches the filter" appears next to a chosen Mappe, it remains valid; you can only newly choose what matches.

!!! info "Sequential numbers"
    If a field says "Assigned on saving", the Mappe automatically gets the next number there when saved, e.g. an invoice number. The number can't be changed afterwards.

![Creating a new invoice](bilder/mappe-neu.png)

If something isn't right – a required field is empty, a number too large, a number already taken –, the reason appears directly at the field, and nothing is saved.

### Fill in from document { #aus-dokument-ausfullen }

If you have a **business card**, a till receipt or a letter in front of you, you don't have to type it out: at the top of the Mappe (new or existing) there is **Fill in from document** – for some Mappe types with its own name, e.g. **Scan business card**.

1. Tap the button. On the phone, **Take photo** opens the camera directly; **Another photo** adds e.g. the back. On the computer you choose a file – a photo, a PDF or a vCard (`.vcf`). In an existing Mappe, a document already in it works too.
2. **Recognise details.** Ablago reads the text (offline, without AI) and looks for matching details: name, position, phone, mobile, e-mail, website, address, date, amount, numbers.
3. **Understood – please check and save.** Empty fields are now filled in as a **suggestion**; below it, it says how certain the value is and at which passage of text it was. **Undo** empties the field again. If a field is already filled in, your value stays – below it, **In the document** shows the other value with **Take over**; **Take over all alternatives** does this for all of them.
4. **Links**, e.g. *Organisation* for a person: if the company already exists (recognised by name, website or e-mail domain), it is suggested. If it doesn't exist yet, **Create "Organisation" with these details** creates it after a confirmation.
5. **Save Mappe.** Only now is anything saved. The photo or file is then in the Mappe's document tab – unless you have unticked "file in the tab …".

Which fields recognition fills in is set by the administrator on the Mappe type; it never fills in password fields. If they have chosen a package for it, such as an AI assistant, "Recognised with "…"." appears below the result – even then these are only suggestions. The document's text then goes to the package's AI service – on the home network it stays with you; whether it is a provider your administrator sees at the package's service address. If the package doesn't respond, the built-in recognition takes over, and a sentence tells you so. If something goes wrong (blurry photo, no text), the reason is in the box – try again with more light and the card held straight.

**Business card with a QR code:** many cards carry a QR code with all contact details (vCard). If the administrator has chosen the package **Read QR code**, Ablago takes the details from this code instead of from the recognised text – phone numbers and names are then correct character for character. Below the result, "Recognised with "Read QR code"." appears; the passage names the line from the vCard. The package reads documents that are already in the Mappe or in a post: so first file the photo of the card (or open the post it arrived in) and then click **Fill in from document** with this document. If the card has no QR code or something else is in it (a web address, a GiroCode), Ablago reads the text as usual, and a sentence tells you so.

### The fields {#die-felder}

| Field | How to enter it |
| --- | --- |
| Text, long text | freely; some texts have a maximum length or must be unique |
| Formatted text | with a toolbar: bold, italic, heading, list, numbered list, quote, link; **@** mentions someone (see below) |
| Number | with a decimal separator, e.g. `12,5` |
| Amount | number and currency, e.g. `98,00 EUR` |
| Date | via the calendar or as a date |
| Yes/no | tick the box |
| Selection list | choose a value (or several) from the list |
| Link | search for and choose another Mappe (see below) |
| Password | type it in; it is stored encrypted (see below) |

Some text fields have a **format**: e-mail, phone, website, IBAN or postcode. On the phone the matching keyboard then appears, and Ablago rejects obviously wrong entries – such as letters in a phone number – with a hint about what to do. Next to an e-mail address, phone number or website there is a button with which you write, call or open the page straight away. An IBAN is shown in groups of four; a German postcode has exactly 5 digits; for other countries you enter the country. Some date fields have limits; a birthday, for example, may not be in the future. What is already saved stays until you change the field.

### Formatted text {#formatierter-text}

Some longer texts can be formatted. Above the field there is a small **toolbar**: select text and click **B** (bold), *I* (italic), a heading, a list, a numbered list, a quote or a link. With **Write** and **Preview** you switch between input and the finished view. The field then contains a simple notation, e.g. `**bold**` – that's correct. **Preview** shows what it looks like.

![Formatted text with toolbar](bilder/formatiert.png)

If you type **@** and the first letters of a name, you choose a user. They then get a [task](eingang.md) on this Mappe.

In lists and in the search, the text appears without formatting.

### Passwords {#passworter}

In a **password field** (e.g. the password of a customer portal), only "••••••••" appears after saving. The **eye** shows the password; Ablago records every display in the Mappe's history (who, when, which Mappe – not the password). **Change** takes a new password, **Remove password** deletes it on saving (until then **Undo** works).

![Password field](bilder/passwortfeld.png)

Passwords never appear in the title, in lists or in the search. If the field says "not possible", an administrator hasn't set up a key for passwords yet.

### Linking to other Mappen { #auf-andere-mappen-verweisen }

A **link** connects two Mappen – the invoice with its contract, the contract with the contract partner. Type a few letters of the title into the field and choose the matching Mappe from the suggestions. With the keyboard, **Enter** takes the first suggestion, **Esc** closes the list.

For fields that allow **several links** (e.g. *For invoices* on a payment), you repeat this. The search field stays at the top directly below the label; the chosen Mappen appear **below it**, each with **Remove**. This is how you choose several entries from a list everywhere, including the Mappe types in the [advanced search](ablage.md#erweiterte-suche).

If the Mappe doesn't exist yet, **+ Create …** below the field leads directly to creating it.

A click on a link that has been set opens the other Mappe.

## Changing {#andern}

Open the Mappe, change the details and click **Save Mappe**. As long as something isn't saved, "Unsaved changes" appears at the bottom. **Discard changes** restores the saved state.

If you want to leave the Mappe with unsaved changes, Ablago asks.

Next to the title are the star for the [favourites](ablage.md#favoriten) and the menu **Mappe ▾** (assign task, remind, send by e-mail, export as PDF, copy link). Every Mappe also has the tabs **Notes** (with a number) and **History** – see [Notes, mentions, history](zusammenarbeit.md) and [E-mail, PDF and link](versenden.md). On the phone, the row of tabs scrolls horizontally; a shadow at the edge shows that more follow. Menus such as **Mappe ▾**, **+ New** and your user menu open on the phone as a sheet from the bottom with large entries; tapping next to it closes it. On the phone, **Delete Mappe …** is there too. The bar with **Discard** and **Save** only appears on the phone once you have changed something.

Some details are only for reading and have a dashed border – for example name and e-mail address in a user's Mappe. Next to them it says where they are changed.

### Editing at the same time {#gleichzeitig-bearbeiten}

The same Mappe may be open in several places at the same time – on the laptop and on the phone, in two windows or for two people in the household. When saving, Ablago only sends the fields you **changed in this window**. Everything else stays as it is currently saved.

**Example:** Lena has the Mappe "Car insurance" open on her laptop. On her phone she changes the **premium** and saves. Afterwards she changes only the **note** on the laptop and saves. Both are kept – the laptop doesn't set the premium back to the old value, and no question comes.

If you both changed **the same field**, Ablago asks before overwriting anything:

> Jonas changed "Premium" at 17:04 to "412,00 €". You wanted to enter "398,00 €".

For each field choose **Take mine** or **Keep Jonas's value** and click **Save like this**. If it was you yourself on another device, it says **Take the value from here** or **Keep the other value**. Your other changes and those of the others are merged without a question. **Back to editing** doesn't save anything yet – your entries stay. What applied is recorded in the [history](zusammenarbeit.md#historie) like every change.

This applies to all fields, including links and multiple selections (there the whole field counts) and the fields the title is made from. There is no lock ("being edited"); Ablago only asks when two changes really concern the same field. Automatic processes such as automatically assigning post or packages don't reset fields you have changed in the meantime either.

## Links { #verknupfungen }

The tab **Links** shows all Mappen that link to this Mappe. For the contract partner you thus see their contracts and invoices, for the contract its invoices – without having to enter them there.

![A contract partner's contracts](bilder/verknuepfungen.png)

Depending on the setup, the Mappen of a group appear as a simple list of titles or as a **table** with columns, such as the invoices with amount, date and *paid*. A click on a row opens the Mappe.

![A contract partner's invoices as a table](bilder/verknuepfungen-tabelle.png)

With **+ Create …** in the heading of a group you directly create a new Mappe that already links to this Mappe – for example a new invoice for this contract.

For a new Mappe the tab is still empty: links only arise once the Mappe is saved and others link to it.

!!! info "Belonging or reference"
    Next to every link it says what kind it is. **Belonging** means: belongs to it (the invoice belongs to the contract). **Reference** means: only has to do with it (the invoice comes from this issuer). This helps with evaluations such as "everything about the house", so that not every invoice from the same tradesperson turns up there – and when [deleting with linked Mappen](#mit-verknupften-mappen-loschen): only what belongs to it is deleted along with it.

## Deleting { #loschen }

At the bottom left of the Mappe is **Delete Mappe**. After a confirmation, the Mappe goes with its documents into the [recycle bin](ablage.md#papierkorb); there it can be restored for a while. If the recycle bin is switched off, it is gone for good immediately.

In the confirmation you choose the **reason** – *No longer needed*, *Period expired*, *At the request of the data subject* or *Other* – and can add a short remark. Both are recorded in the deletion log, with which your administrator can prove that and why something was deleted; the Mappe's title and contents are not in it. So don't write any names in the remark.

If deleting isn't possible right now, the button is locked (dimmed, with a padlock), and the reason is given in one sentence next to it. **Why is deleting locked?** expands the detailed reason right at the button:

- **Other Mappen still link to it.** The explanation lists them – with links there (for many, the first eight and "and … more"). Remove the link there first. That way no contract can disappear that still has invoices. Sent e-mails and other [post](post.md) don't prevent deleting.
- **Archive mode:** the retention period is still running; before that, the Mappe can't be deleted by anyone.
- **Permissions:** you may not delete Mappen of this Mappe type. An administrator sets this.

![Locked button "Delete Mappe" with a padlock and the expanded explanation](bilder/mappe-loeschen-warum.png)

Users and system roles can't be deleted in the filing view at all; the button is missing there.

### Delete with linked Mappen { #mit-verknupften-mappen-loschen }

If you want to get rid of a Mappe **with everything attached to it** – such as a contract partner you haven't had anything to do with for years, including contracts, invoices and documents –, use **Mappe ▾ → Delete with linked Mappen …** (at the bottom of the menu, red). If the Mappe can't be deleted on its own because others still link to it, the same way is also available under **Why is deleting locked?** at the delete button. You need the permission to delete the Mappe.

![Preview as a tree: what goes along and what stays](bilder/mit-verknuepften-loeschen.png)

1. **Preview as a tree:** Ablago collects all Mappen that belong to this Mappe, and the Mappen that in turn belong to those (contract partner → contracts → invoices → delivery notes …), with the number of their documents. You set the **depth** (default 5 levels); you expand and collapse branches with ▸/▾. Every Mappe appears only once, even with circles.
    - **Only downwards:** only what links to the deleted Mappe is deleted along with it. Mappen it links to itself (e.g. a category, a storage location or, when deleting an invoice, the contract partner) never belong to it – not even via a Mappe deleted along with it: an invoice's delivery note goes along, but its link to the contract partner is not followed.
    - **Only via belonging:** only links of the [link kind](begriffe.md#verweisart) **Belonging** lead to deletion (the invoice belongs to the contract). If a Mappe is only attached via a **reference** – e.g. a contract with this contract partner as *contact person*, post with *For* or *Assigned to* –, it stays; only the link is removed. Ablago doesn't collect what is attached to it.
2. **Markings** per Mappe:
    - ✅ **will be deleted**.
    - 📎 **only connected via reference** – always stays, only the link is removed (with the field, e.g. "via contact person (reference)"). If you remove the tick, the link stays too – and with it the Mappe it points to.
    - 🔗 **also attached to other Mappen** – e.g. an invoice that also links to another contract. Suggestion: **only remove the link, keep the Mappe**; in the selection field you can choose to **delete it along** instead.
    - 🔒 **retention period still running** ([archive mode](begriffe.md#archivmodus)) – is **never** deleted; next to it, it says from when it may go.
    - ⛔ **no delete permission** – is never deleted.
3. **Selecting:** every Mappe has a box (default: on). If you remove the tick, it stays. **What stays holds on to what it links to:** if an invoice stays (deselected, locked or without permission), its contract and the contract partner stay too – with the reason why. The same applies if a Mappe outside the preview (too deep, not visible) still links to it. Links are only removed where you chose "only remove link".
4. **Summary:** at the bottom it says what will happen, e.g. "37 Mappen and 112 documents will be put in the recycle bin; 3 stay because of the retention period; 2 links will be removed."
5. **Confirm:** to confirm, you type the Mappe's name.

**Reminder at the end of the period:** if the Mappe stays because Mappen below it are still in their retention period, Ablago creates a [reminder](begriffe.md#erinnerung) on it for the day after the latest end of the period – "Müller GmbH can be deleted from 01.01.2032 – run "Delete with linked Mappen" again". On that day it appears under "To do"; a click opens the Mappe, and you delete again.

Everything goes into the [recycle bin](ablage.md#papierkorb) as **one operation**: there, **Restore all** restores all Mappen and documents together – including the links between them and the links that were removed from Mappen that stay. The history of every Mappe says "put in the recycle bin – deleted with linked Mappen" with the number of Mappen and documents. If the recycle bin is switched off, deleting is permanent immediately; the confirmation says so.

If the button is missing, Mappen of this Mappe type may not be deleted.

## What you may see and change { #was-du-sehen-und-andern-darfst }

An administrator can set per Mappe type who may create, read, edit and delete Mappen and see passwords in them – for example, that only the accounts team edits invoices or that confidential Mappen are only seen by those responsible. What applies to you is shown under My account in [My permissions](profil.md#meine-rechte).

They can also set permissions on every **view**: who **sees** it, who may **create** there with **+ New** and who may **export** from it. But a view never shows you Mappen you may not read on the Mappe type.

This is how you notice it:

- **Mappen you may not read** don't appear in lists, search, counters and favourites. If a Mappe links to one of them, it says *Mappe not visible* without a link.
- **Without edit permission**, a Mappe only displays its fields and documents; "Read only" appears at the bottom. Notes and tasks still work.
- **Without delete permission**, "Delete Mappe" is locked (with a padlock and "Why is deleting locked?"), **without create permission** "+ New" is missing, **without see-passwords permission** the eye on password fields is missing.
- **Without export permission**, the export buttons are missing in a view; views you may not see are missing from the tree.
- If your permissions depend on a field (such as "Responsible") and you would take away your own read or edit permission with a change, Ablago asks before saving.
- When choosing users (responsible, mentions, deputy, tasks), only those you may see appear.
- You always see your **recycle bin**; but what you restore from it you only see afterwards if you may read the Mappe.
