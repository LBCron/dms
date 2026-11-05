# Post

Everything that comes into Ablago or goes out is **post**: a scanned letter, an uploaded PDF, an email sent, a scan from the intake folder, an email fetched from a mailbox. So you don't have to look for the right folder and choose the right tab first: file the document as post and **assign it** when you have time.

![New post with Assign](bilder/post-zuordnen.png)

## New post {#neue-post}

In the Library, the view **New post** is above the other views (an administrator can move it). It shows all post that nobody has assigned or completed yet. If there is any, the number next to it is highlighted in colour, as with [To do](eingang.md).

### Creating new post – from anywhere {#neue-post-anlegen-von-uberall}

- **Drag files into the window:** drag one or more files **anywhere** into Ablago's browser window, no matter which page. The area **"Drop new documents here"** appears. When you let go, all files go **together into one new post**, which opens straight away.
- **+ New** in the header → **Post**: choose files. On the phone and tablet the entry is called **Post – choose file or photo**; above it is **Photograph post** (see [Capturing post with your phone](#post-erfassen-am-handy)).
- **+ Post** at the top of the views with post does the same.

![Dropping files](bilder/post-ablegen.png)

**Does a file already exist?** Before the post is created, Ablago checks every file. If one is already in a folder you may see, it asks: for each file it says where it is (with a link), and you tick **file anyway** or leave it out. **Continue** creates the post with the remaining files, **Cancel** creates nothing at all, a click on the link takes you to the existing folder.

Ablago takes the subject from the first file name; you can change it at any time. The **sender** stays empty until you enter it – after all, you only captured the letter, you didn't send it (who captured it is shown under "Created" and in the history). The list *New post* then shows "–". The channel is called *Uploaded*. Files over 100 MB or when the storage limit is reached are reported with a reason; the others are filed anyway.

**On an open folder** with a document tab, the area splits: **Into this folder** puts the files into the tab as before (taken over with *Save folder*), **As new post** makes a new post from them.

![Two targets on a folder](bilder/post-ablegen-mappe.png)

The area only appears when dragging files, not text or links, and only if you may create post. With Esc or when you leave the window, it disappears. In maintenance mode and while Ablago can't be reached, a short notice appears instead.

**+ New → folder …** creates a new, empty folder of a folder type you may create.

### Capturing post with your phone { #post-erfassen-am-handy }

The quickest way to photograph letters is **Photograph post** – as a large button at the top of the [home page](startseite.md) and as the first entry under **+ New**. It opens **the camera directly**, without the choice "Photo Library / Take Photo / Choose File".

1. Photograph the first page and confirm the photo.
2. At the bottom, the sheet with the pages taken appears. **Another page** photographs the next page **of the same letter** (e.g. the back). With **×** on a thumbnail you discard a page.
3. **Done – save as post**: all pages become **one PDF** and from it **one post** with the subject "Post from 01.11.2026, 20:52" (instead of "image"). You change the subject later when assigning.
4. **✓ Post saved** – tap **Photograph next receipt** to capture the next letter straight away as a separate post. **Assign now** opens the post, **Done** shows how many receipts you captured; they are under *New post*.

This way you capture several letters one after another without opening a folder – you can assign them later on the computer or via *To do*. If you close the camera without a photo (or accidentally hit the library), the sheet stays open: **Take photo** or **Choose photo from library** – you don't start from the beginning. The phone shrinks every photo before uploading (longest side 2400 pixels); that saves time and space.

**Forgot a page?** In a post, the phone shows **Add page**: the camera opens, and the new pages go **at the end of the PDF** of this post.

**Merging two posts:** if the back ended up as a separate post, open the post with the front and tap **Merge with another post …** (also on the computer). Choose the other post – its pages (PDFs and photos) go at the end of the PDF, and the other post goes into the bin. Files that are neither PDF nor photo can't be appended this way; assign such post instead.

### Into Ablago by email { #per-e-mail-ins-dms }

If your administrator has set up a [mailbox](https://help.ablago.app/admin/aktuell/en/postfaecher/) (e.g. `dms@…`), **you simply forward emails there** – or have invoices sent there right away. Every email becomes new post with the channel *Email*: subject, sender and date from the email, the attachments as documents, the text of the email on the post and, if desired, the whole email as `.eml`.

**Scan to email:** many scanners and multifunction devices send scans by e-mail. Enter the mailbox's address as the target – every scan becomes new post.

### Scanning into the intake folder {#scannen-in-den-eingangsordner}

If your administrator has set up an [Intake folder](https://help.ablago.app/admin/aktuell/en/eingangsordner/), you simply scan into this folder ("Scan to Folder" on the scanner). **Every file becomes a separate new post** with the channel *Folder*; Ablago takes the subject from the file name. If you scan into your own subfolder, e.g. `eingang/thomas/`, the post is **for you** straight away and appears under "To do" for you. The file then disappears from the folder: depending on the setting, it is in `erledigt/` or deleted. What Ablago can't take over (e.g. an empty or too large file) ends up in `fehler/`.

![+ New](bilder/neu-knopf.png)

Under the view **Post** you find all post, including assigned and completed post, with the sub-views **Received** and **Sent**.

## What a post shows {#was-an-einer-post-steht}

| Field | Meaning |
| --- | --- |
| **Subject** | title of the post |
| **Status** | *New* – not yet handled · *Assigned* – belongs to a folder · *Done* – nothing more to do |
| **Channel** | how it came into Ablago: *Uploaded*, *Email*, *Scan*, *Folder*, *Import*, *API*, *WebDAV* |
| **Direction** | *Incoming* or *Outgoing* |
| **Date, sender, recipient, message** | as far as known |
| **For** | who should take care of it |
| **Assigned to** | the folders the post belongs to |

Ablago sets channel and *Assigned to* itself. You can change everything else as with any folder.

## For someone { #fur-jemanden }

If you enter a user under **For**, the post appears under [To do](eingang.md) for them with the task **Post for you**. When it is assigned, completed or given to someone else, the task completes itself. If the user is absent, their stand-in gets it.

## Assign { #zuordnen }

At the top of a post there is a bar with the **status** and the button **Assign …**:

1. Choose the **Folder type**, e.g. *Invoice*.
2. Choose **select existing** and search for the folder, or **create new**.
3. Choose the **documents** that go along. All are preselected. If a document is already in another folder you may see, that is shown below – with a link. Then you may not need to file it again. If the folder type has several document tabs, you choose the tab.
4. **Assign to "…"** (for an existing folder) or **Next: fill in new folder**.

Afterwards the documents are in the folder, and the post links to it. Its status is *Assigned*. The [history](zusammenarbeit.md#historie) of both folders records what happened. The documents' full text moves along.

With **Next: fill in new folder**, the folder type's form opens. The post's subject and date are already filled in as suggestions, plus – as far as recognition found anything – amount, matching numbers (e.g. the invoice number) and the link to the sender. A notice at the top says what is prefilled. After **Save folder**, the post is assigned to the new folder.

### Suggestions when assigning {#vorschlage-beim-zuordnen}

As soon as a post's text is available (from text recognition, a PDF's text layer or an email's text), Ablago searches it – without AI and without the internet, only with patterns and by matching against your folders. What it finds appears at the top of the post in the box **Recognised**:

- **Sender:** an organisation (or branch, person) whose customer number, IBAN, email address, website, phone number or name appears in the letter – with a reason, e.g. "found: customer number 100-4711". **Enter as sender** writes the name into the post's field *Sender*. If none matches but the letterhead can be recognised reliably (e.g. the small sender line above the address field), it shows **Create as new organisation** – with name and address prefilled.
- **Date** of the letter (not the service period or due date) – **Enter as date of the post** takes it over.
- **Amount** (the total amount) and **numbers** such as customer, invoice or contract number.

Under **Assign …**, the **suggestions** for the target folder are at the top, the best one already selected and marked as *Suggestion*: a contract whose contract number appears in the letter; folders that link to the sender (e.g. their electricity contract); folders that earlier post from this sender went to; the sender themselves. Below each suggestion it says why. A click chooses another; the search below works as always – nothing happens until you click **Assign to "…"**.

What Ablago uses to recognise senders is set by the folder type: fields an administrator has marked "for recognition" (the packages *Basis* & co. come with this). If you have just created an organisation or added a customer number, click **Recognise again** in the box. Only folders you may see are suggested.

### Assigned automatically {#automatisch-zugeordnet}

If the recognition is **certain**, Ablago can assign post itself – but only if an administrator has switched this on for the target folder's type (default: off). Certain means: the sender is clearly recognised (e.g. by customer number or IBAN) **and** there is exactly one matching folder of this type – or exactly one whose number (e.g. contract number) appears in the letter. Ablago never creates new folders in doing so.

Afterwards, the task **Assigned automatically to "…" – please check** appears under [To do](eingang.md) – for the person under *For*, otherwise for the person who brought the post into Ablago (if they are absent, their stand-in). The same task appears at the top of the post with two buttons:

- **Fits** confirms the assignment.
- **Undo** takes the documents back into the post, removes the link and sets the status back to *New*. Ablago then no longer assigns this post by itself.

Why it was assigned ("Sender … clearly recognised (customer number 100-4711), only matching folder …") is shown in the box **Recognised** and in the [history](zusammenarbeit.md#historie) of the post and the folder. Post whose recipient may not read the target folder and post to folder types in archive mode are never assigned automatically.

**Keep a copy in the post** additionally leaves the documents in the post. That costs no space, because Ablago stores every file only once. This is handy when a letter belongs to **several** folders, e.g. to the invoice and the contract. You can assign a post as often as you like.

It also works without assigning: **Done** for advertising or things already dealt with; **New again** if there is something to do after all. You delete unnecessary post like any folder.

## Splitting a batch scan {#sammelscan-teilen}

If you scanned several letters at once, they arrive as **one post** with a long PDF. This is how you make separate posts from it:

1. Open the post and the tab with the PDF.
2. Next to the PDF, click **Pages**.
3. At the first page of each further letter, click **Split from here**. You can **delete** blank backs straight away and **rotate** crooked pages.
4. **Apply** and confirm the question.

For each part, a **new post** with status *New* is created: subject "Batch scan (part 1)", "Batch scan (part 2)" …, date, sender and "For" as in the original post. You can then [assign](#zuordnen) each one as usual. The original post keeps the whole PDF, is *Done* and links to the new ones under "Assigned to" – nothing is lost. At the top there is a notice with links to the new posts.

It also works the other way round: if two posts belong together (e.g. front and back scanned separately), open the first one, choose its PDFs and **Merge** – see [Edit PDF](dokumente.md#pdf-bearbeiten). Via the interface (API), a program can also merge PDFs from several posts; a post that becomes empty as a result is completed.

## Emails sent { #versendete-e-mails }

When you send a folder [by email](versenden.md), Ablago files the email as post: channel *Email*, direction *Outgoing*, status *Done*, assigned to the folder. Subject, recipients, sender, date and message stay as they were sent. You can change status and *For*.

If a folder is deleted, the post is kept. Only the link to this folder is removed.

## Who may do what? {#wer-darf-was}

Who sees, creates, edits and deletes post is governed by the [permissions](mappen.md#was-du-sehen-und-andern-darfst) of the folder type *Post*. To assign, you need the permission to edit the post **and** the target folder.
