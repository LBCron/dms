# Frequently asked questions {#haufige-fragen}

??? question "I don't see the workbench."
    The workbench is reserved for administrators. As a member you only work in the filing view.

??? question "There is no view for the paperwork I want to file."
    An administrator sets up new Mappe types. Describe to them what you want to file and which details belong to it.

??? question "The button "+ New" is missing."
    There are several reasons for this:

    - Mappen of this Mappe type are not created in the filing view – for example *User*. An administrator creates those in user management.
    - You may not create Mappen of this Mappe type, or you may not create in this view. An administrator sets both in the permissions; what applies to you is shown under My account in [My permissions](profil.md#meine-rechte).
    - The view shows several Mappe types. Then create the Mappe in the view of the individual Mappe type.
    - For *Post*, the button is called **+ Post** (see [Post](post.md)).

??? question "I can't delete a Mappe."
    Next to the locked **Delete Mappe** (with a padlock), the reason is given in one sentence; **Why is deleting locked?** explains more:

    - Other Mappen still link to it – then Ablago shows which. Remove the link there first.
    - You may not delete Mappen of this Mappe type. An administrator sets this in the permissions.
    - The Mappe type is in **archive mode**, and the Mappe's retention period is still running. Then it can only be deleted after the end of the period – by nobody.

??? question "I can't change a field."
    - You may only read Mappen of this Mappe type, not edit them. Then "Read only" appears at the bottom of the Mappe.
    - Fields with a dashed border are read-only, for example name and e-mail address in a user's Mappe. Next to them it says where they are changed.
    - A **sequential number** (e.g. an invoice number) is assigned by Ablago on the first save; after that, nobody can change it.
    - For *Post*, Ablago sets *Channel* and *Assigned to* itself.

??? question "I don't see a Mappe or view that others see."
    An administrator can set who may read which Mappen and see which views – for example only the "Parents". What you may do per Mappe type is shown under My account in [My permissions](profil.md#meine-rechte). If you need access, ask the administrator.

??? question "A Mappe is suddenly under "To do"."
    Then you have an open task on it. What needs to be done is shown at the top of the Mappe. Possible reasons:

    - **Assigned:** someone has given you a task.
    - **Mention:** someone has mentioned you with **@**.
    - **Deadline** or **reminder:** a date is approaching, or the day of a reminder has come.
    - **Deputy:** someone has entered you as their deputy, or you are currently standing in for someone.
    - **Post for you:** your name is under **For** on new post.
    - **Access request:** an access copy under Art. 15 GDPR for this person was retrieved (or its retrieval link blocked).
    - **Doesn't fit:** its Mappe type was changed, and the Mappe no longer fits it.

    More under [To do](eingang.md).

??? question "I accidentally deleted a Mappe."
    It is in the **recycle bin** below "To do". Open it there and click **Restore**.

??? question "I replaced a document. Is the old edition gone?"
    Not if the tab has versions: the old edition lies under the document as an older **version** and can be viewed, downloaded and restored. How that works is described under [Understanding versions](versionen.md).

??? question "Search doesn't find a text from a PDF."
    Next to the search field, tick **Search full text**. If the document has only just been uploaded, it may still say *Full text: waiting* next to it – then wait a moment. With *skipped* or *error* you can trigger it again with **Try again** on the document; for some file types there is no full text, though.

??? question "The columns have shifted or one has disappeared."
    Under My account, **Appearance on this device** → **Restore default appearance**. Or briefly click the handle between the columns – that expands collapsed areas again.

??? question "The text is too small."
    Menu under your name → **My account** → **Appearance** → **Font size on this device** → *large*.

??? question "I see a notice "Maintenance"."
    An administrator is maintaining Ablago, e.g. for an update. There is time to save until the maintenance; after that, Ablago briefly signs you out. You can sign in again as soon as the maintenance is over; the sign-in page says how long it is expected to take.

??? question "At the top it says "Ablago can't be reached right now"."
    Ablago is restarting, usually because of an update. Leave the page open: the browser checks by itself and shows "Ablago can be reached again" as soon as it continues. What you have entered stays. Save again afterwards in case saving didn't work during the pause. If the view still shows errors afterwards, choose "Reload view" in the bar.

??? question "At the top it says "A new version is available"."
    Ablago was updated while the page was open. Save unsaved entries and choose "Reload page" – only then does the interface match the new version.

??? question "I've been signed out and my last changes are missing."
    An administrator has probably restored a backup. Then the state of the backup applies – including the password from that time. Ask them when the backup is from; you may have to enter again what was changed after that.

??? question "I've forgotten my password."
    **Forgot your password?** below the sign-in. If Ablago doesn't send e-mails, an administrator creates a link for you.

??? question "I've found a bug or have a wish."
    In the menu under your name → **Report a problem** (see [My account and settings](profil.md#fehler-melden)). Wishes are also welcome directly as an [issue on GitHub](https://github.com/motom001/dms/issues/new?template=wunsch.md).
