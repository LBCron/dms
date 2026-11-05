# Windows

!!! info "Tested: image automatically, device not yet"
    GitHub's machines test the image with every change on amd64 and arm64. There is no report from a particular device here yet. What that means is described under [Tested platforms](plattformen.md).

If you already have a Windows computer running around the clock, it can take on Ablago as well. Ablago is a Linux container. On Windows it therefore needs a small Linux environment, which Windows itself provides: **WSL 2** or **Hyper-V**.

| Computer | Recommended way |
|---|---|
| Windows 10/11, mostly used by someone and not always on | [Docker Desktop](#docker-desktop-windows-1011) |
| Windows 10/11 Pro, meant to run permanently as a server | [Linux VM in Hyper-V](#linux-vm-in-hyper-v) |
| Windows Server | [Linux VM in Hyper-V](#linux-vm-in-hyper-v) |

## Docker Desktop (Windows 10/11)

1. Install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) and choose **WSL 2** during setup. Docker Desktop is free for private use; for companies, [Docker's licence terms](https://docs.docker.com/subscription/desktop-license/) apply.
2. Install a Linux environment from the Microsoft Store, e.g. **Ubuntu**, and switch it on in Docker Desktop under **Settings → Resources → WSL integration**.
3. Open the **Ubuntu terminal** and run the commands from [PC with Linux → Start Ablago](linux.md#3-dms-starten) there.
4. Open `http://localhost:8080` in your browser.

!!! tip "Store the data in Linux, not on C:"
    Create Ablago in the Ubuntu terminal under `~/dms`, not under `/mnt/c/…`. Folders on the Windows drive are much slower via WSL, and the database can run into problems with file permissions there. In Explorer you find the folders under **Linux → Ubuntu → home**.

!!! warning "Only runs while someone is signed in"
    Docker Desktop only starts after signing in to Windows (**Settings → General → Start Docker Desktop when you sign in**). If the computer is off, asleep or nobody is signed in, Ablago cannot be reached. For a computer meant to serve as a server, the Hyper-V VM is the better way.

For other devices on your home network to reach Ablago, the **Windows Firewall** must allow incoming connections on port 8080. Docker Desktop asks about this on the first start.

## Linux VM in Hyper-V

Hyper-V is included in **Windows 10/11 Pro, Enterprise** and in **Windows Server**. A small Linux runs inside it, regardless of whether anyone is signed in.

1. Switch on Hyper-V: **Turn Windows features on or off → Hyper-V** (on Windows Server: **Server Manager → Add roles → Hyper-V**).
2. In Hyper-V Manager, create a **virtual switch** of type *External* so the VM gets its own address on your home network.
3. Create a **generation 2 VM**: 2 processors, 2–4 GB of memory (fixed, not dynamic), a disk as needed, ISO of [Debian](https://www.debian.org/distrib/) or [Ubuntu Server](https://ubuntu.com/download/server). For Debian, choose the template *Microsoft UEFI Certificate Authority* under **Security**, otherwise the installation won't start.
4. In the VM settings under **Automatic start action**, choose *Always start*.
5. In the VM, continue as on any [PC with Linux](linux.md#2-docker-installieren).

!!! note "Docker directly on Windows Server?"
    Docker Desktop is not intended for Windows Server, and the built-in Windows containers cannot run Linux images. The Linux VM is the simplest reliable way.

## Backup {#sicherung}

Copy the `sicherung` folder to another place regularly, e.g. with Windows File History, OneDrive or a USB disk. The backups are encrypted, so cloud storage only sees unreadable files. Exports are not included: a [full export](https://help.ablago.app/admin/aktuell/en/export/) is unencrypted and is therefore kept in its own [export folder](https://help.ablago.app/admin/aktuell/en/export/#export-ordner), never with the backups. In WSL it is under `\\wsl$\Ubuntu\home\<name>\dms\daten\sicherung` (two containers) or `\\wsl$\Ubuntu\home\<name>\dms\sicherung` (dms-komplett). With the VM, copy it on from within Linux, see [PC with Linux → Backup](linux.md#sicherung).
