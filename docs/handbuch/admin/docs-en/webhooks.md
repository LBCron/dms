# Webhooks

With a **webhook**, Ablago reports to another system by itself as soon as a user's numbers change: new post, *To do* and overdue items. Home automation (Homey, Node-RED, ioBroker, openHAB) and your own scripts then react immediately instead of asking every few minutes.

Users create their webhooks themselves (**My account → Notifications → Report instantly** (click your name at the top right)); they always apply to their own numbers and within their own permissions. You as an administrator determine under **Workbench → Webhooks** **where** reports may go, see all webhooks and switch them off if needed. How users set up a webhook (with an example for Node-RED) is described in the User manual under [Connecting to home automation](https://help.ablago.app/benutzer/aktuell/hausautomatisierung/#sofort-melden-webhook).

## What is reported – and what never is {#was-gemeldet-wird-und-was-nie}

A message contains **only** the kind, an event id, a time and the numbers – the same as with the [counter endpoint](api.md#zaehler):

```json
{"art":"zaehler.geaendert","id":"7c0e6a8e-3d1f-4f0a-9c55-2b8f0d3e4a11","zeit":"2026-11-03T07:15:02.000Z","daten":{"neuePost":2,"zuErledigen":5,"ueberfaellig":1,"stand":42,"geaendert":"2026-11-03T07:15:00.000Z"}}
```

**No** titles, senders, names, e-mail addresses or contents. Whoever wants to know more fetches it via the [interface](api.md) with their own key and their own permissions. Ablago only reports to addresses you have approved – never to the project or other servers.

## Approving targets {#ziele-freigeben}

Under **Workbench → Webhooks → Approved targets** you enter one address per line. Only its beginning counts (scheme, host, port), e.g.:

```text
http://homey.home.arpa
http://192.168.178.20:1880
https://hooks.example.org
```

- **`https://`** works everywhere, **`http://`** without TLS only on the home network: private addresses (`192.168.…`, `10.…`, `172.16–31.…`), `localhost`, names without a dot and the endings `.home.arpa`, `.lan`, `.local`, `.internal` – the same list as for sign-in via a provider.
- Users can only direct webhooks **to approved targets**. If you yourself create a webhook under My account, Ablago approves its target along with it.
- If you remove a target, Ablago **no longer delivers** anything there; the webhooks then show "The target is no longer approved".

!!! warning "A target is an outgoing connection"
    With a target you allow Ablago to send requests to this address. Only approve systems that expect such a message – not, say, the database, the router or the NAS's admin page.

## Overview and switching off {#ubersicht-und-abschalten}

Below that are **all webhooks** with user, address, last delivery (time, result, HTTP status, error) and the number of consecutive failures. The sidebar shows a **!** as soon as a webhook has errors or has been switched off.

- **Switch off** – Ablago reports nothing more; a waiting message lapses. If you switched it off, only an administrator can **switch it on** again, not the user themselves.
- **Delete** – the webhook is gone, including its history. If a user is deleted, their webhooks disappear too.

## Delivery {#zustellung}

- **Bundling:** after a change, Ablago waits about 3 seconds and then counts. Per webhook, **at most one message every 30 seconds** goes out; what happens in between comes bundled with the newest state. 20 letters from the scanner thus result in a few messages.
- **Time limit:** 5 seconds per delivery. Any `2xx` answer counts as arrived.
- **No redirects:** if the receiver answers with `301`, `302` etc., Ablago doesn't follow and reports an error. Enter the final address.
- **Retrying:** on an error, Ablago tries again at increasing intervals (30 seconds, 1, 2, 5, 10, 30 minutes, 1, 2, 4, 6, 8 hours) – together about 22 hours, 12 attempts. If new numbers come in the meantime, the next attempt sends the new state.
- **Switching off after many failures:** if the last attempt doesn't work either, Ablago switches the webhook off, shows the reason under My account and here and sends an e-mail to the administrators and to the user who owns the webhook (if [e-mail sending](installation.md#e-mail-und-adresse) is set up). The user switches it on again after the repair; then a message with the current state comes straight away.
- **At least once:** the messages wait in the database. After a restart or an interruption, a message may go out a second time – with the same **event id**, by which the receiver recognises the repeat.
- In **maintenance mode** and during a **restore**, delivery rests and catches up afterwards.

## Signature {#signatur}

Every webhook has its own **secret** (`whsec_…`). Ablago only shows it in full when creating and renewing and stores it encrypted with [Ablago's key](verschluesselung.md); when the key is changed, it is re-encrypted too. With it Ablago signs every message:

| Header | Content |
| --- | --- |
| `X-DMS-Signatur` | `v1=` and HMAC-SHA256 (hex) over `<X-DMS-Zeit>.<body>` |
| `X-DMS-Zeit` | time of sending in seconds since 1970 (Unix time) |
| `X-DMS-Ereignis` | event id (like `id` in the body) – the same for a repeat |
| `X-DMS-Art` | `zaehler.geaendert` or `probe` |
| `X-DMS-Versuch` | 1 on the first attempt, then 2, 3 … |
| `X-DMS-Webhook` | id of the webhook |

The receiver recalculates the signature with the secret and discards messages whose time deviates by more than 5 minutes. Examples in JavaScript and Python are in the [Developer manual](https://help.ablago.app/entwickler/aktuell/aufbau/#webhooks). If a secret is lost, the user creates a new one under My account with **New secret**; the old one stops working immediately.

## Backup and export {#sicherung-und-export}

Webhooks and their waiting messages go into the [backup](sicherung.md) (the secret encrypted). After a [restore](wiederherstellen.md), Ablago reports as soon as the numbers deviate from those of the backup; the `stand` may go back to that of the backup. They don't go into the [full export](export.md) – they are credentials.
