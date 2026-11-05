# Languages {#sprachen}

**Workbench → Settings → Languages** decides in which languages Ablago talks in your Library. **German** and **English** are built in; further languages will come later as language packages from the [package catalogue](pakete.md).

## Settings {#einstellungen}

- **Allowed languages** – from these, every person chooses their own under [My account → Account → Language](https://help.ablago.app/benutzer/aktuell/en/profil/#sprache). German is the source language and always included, as is the installation's language.
- **Installation language** – applies to everyone who hasn't chosen anything, to the sign-in page (as long as the browser doesn't send an allowed language) and to emails to people without a choice of their own. The [setup assistant](installation.md#sprache) sets it with its first step.

If you take a language off the list, people who had chosen it see Ablago in the installation's language again. Their choice stays saved and applies again as soon as you allow the language again.

## What appears in which language {#was-in-welcher-sprache-erscheint}

| What | Language |
|---|---|
| Interface, messages, help texts | the person's, otherwise the installation's |
| Emails to a person (invitation, password, notices, daily summary) | the person's, otherwise the installation's |
| Emails to all administrators | for each recipient in their language |
| Emergency sheet | the language of whoever downloads it |
| Texts for third parties (access copy under Art. 15 GDPR, retrieval link, stamp) | the installation's |
| Titles and names that the server forms once for everyone (e.g. system folder types, the packages' views) | the installation's |
| Log | always German |
| Dates, numbers and amounts | according to the interface language (English: British notation, e.g. `04/03/2026` and `1,234.50`) |

Labels you give yourself – folder types, fields, tabs, views – you translate per language on the respective element (tab **Languages**).

## Good to know {#gut-zu-wissen}

- If a text is missing in a language, it appears in English, otherwise in German – a place never stays empty.
- Machine-translated language packages show the notice "Machine-translated – improvements welcome" in My account, with a link to how to take part.
- With several servers, a change applies immediately on the server where you save and on the others after a minute at the latest.
- The setting is in the database (setting `sprachen`) and thus in every [backup](sicherung.md); every person's choice is stored with their account.
