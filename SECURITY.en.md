# Security

[Deutsch](SECURITY.md) · **English**

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities. Report them confidentially via GitHub: **Security → Report a vulnerability** in this repository ([private vulnerability reporting](https://github.com/motom001/dms/security/advisories/new)). Reports in German or English are welcome.

Helpful details: the affected version (Werkbank → Technik), steps to reproduce, and what an attacker could achieve with it. We get back to you as soon as we have seen the report, and publish a fix as a patch release with a note in the release notes.

## Supported versions

Fixes are provided for the **latest version**. Please update first before reporting – see [Updating](https://motom001.github.io/dms/admin/aktuell/aktualisieren/) (German).

## What is checked automatically

| What | With | When |
| --- | --- | --- |
| Our code (TypeScript, workflows) | CodeQL | every pull request, every push to `main` |
| Libraries | Dependabot (alerts and updates), `npm audit` from severity "high" | every pull request, weekly |
| Images `dms` and `dms-komplett` | Trivy: critical vulnerabilities with an available fix block the pull request | every pull request, every release, weekly rebuild |
| Secrets (tokens, passwords) | Secret scanning with push protection | every push |
| How the project works | [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/motom001/dms) | weekly, every push to `main` |

Findings are listed under **Security** in this repository. Findings of the image scan that are knowingly accepted are listed with a reason in [`.trivyignore`](.trivyignore).

## Verifying the origin of the images

Every published image carries a signed **provenance attestation** (from which commit, built with which workflow) and a **bill of materials** (SBOM, SPDX). Verify them with the [GitHub CLI](https://cli.github.com/):

```sh
gh attestation verify oci://ghcr.io/motom001/dms:<version> -R motom001/dms
gh attestation verify oci://ghcr.io/motom001/dms-komplett:<version> -R motom001/dms
```

How this is built in detail is described in the [developer manual](https://motom001.github.io/dms/entwickler/aktuell/release/#abhangigkeiten-und-sicherheitsupdates) (German).

## Verifying where packages come from

The DMS project signs the official package catalog ([dms-registry](https://github.com/motom001/dms-registry)) with Ed25519. From version 0.141.0 on, the DMS verifies the signature with these two public keys (built into the code, `server/src/projektschluessel.ts`); a signature made with either of them is valid:

| Key | Key ID | Fingerprint (SHA-256 of the public key) |
| --- | --- | --- |
| Signing key (registry CI) | `da31d65f4a429768` | `da31 d65f 4a42 9768 db27 8f76 e67a ce99 7024 9d25 9352 e7da 5a0b 931b d85d 5ac0` |
| Backup key (kept offline by the maintainer) | `e8e8f4f53d4eca0e` | `e8e8 f4f5 3d4e ca0e 3e51 ac12 bbe8 807e 9c3c 00af 19a7 27cc 2d1e 1b92 172b fe15` |

> **Note: these are still test keys.** Their private counterparts are public in the tests, so a signature made with them proves nothing. As soon as the maintainer has generated the real keys, their fingerprints will be listed here. How to replace them is described in the [developer handbook](https://motom001.github.io/dms/entwickler/aktuell/pakete/#projektschluessel-austauschen) (German).

What "signed" and "not signed" mean in the install preview is explained in the [administration handbook](https://motom001.github.io/dms/admin/aktuell/pakete/#herkunft-signiert-oder-nicht) (German).
