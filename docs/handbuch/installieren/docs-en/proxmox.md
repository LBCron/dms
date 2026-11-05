# Proxmox and other virtualisation {#proxmox-und-andere-virtualisierung}

!!! info "Tested: image automatically, device not yet"
    GitHub's machines test the image with every change on amd64 and arm64. There is no report from a particular device here yet. What that means is described under [Tested platforms](plattformen.md).

If you already have a server at home with **Proxmox VE** or another virtualisation platform, Ablago is best given its own small **Linux VM** with Docker.

## Proxmox VE

### As a VM (recommended) {#als-vm-empfohlen}

1. Upload an ISO of [Debian](https://www.debian.org/distrib/) or [Ubuntu Server](https://ubuntu.com/download/server) under **local → ISO Images** or download it via URL.
2. **Create VM:** 2 cores, 2–4 GB of memory, a 32 GB disk plus space for documents and backups. Under *System*, switch on the **QEMU Guest Agent**.
3. Install Linux, then in the VM:
   ```sh
   sudo apt install qemu-guest-agent
   ```
4. In the VM options, switch on **Start at boot**.
5. Continue as on any [PC with Linux](linux.md#2-docker-installieren).

### As an LXC container {#als-lxc-container}

Docker also runs in an LXC container if **nesting** is switched on there (and additionally **keyctl** for unprivileged containers). That saves a little memory. Proxmox itself recommends a VM for Docker, though: in the container, Docker shares the kernel with the host, and Proxmox updates can occasionally disturb it. If you already know LXC well, you can take this way; we advise everyone else to use a VM.

### Backup {#sicherung}

Proxmox can back up the whole VM (**Datacenter → Backup** or Proxmox Backup Server). That is good extra protection, but doesn't replace Ablago's backup: it is encrypted, can be restored on any device and doesn't need Proxmox. So copy the `sicherung` folder to another place anyway, see [PC with Linux → Backup](linux.md#sicherung).

## Other virtualisation {#andere-virtualisierung}

The same pattern applies everywhere: **create a Linux VM** (2 cores, 2–4 GB, network bridged into your home network), switch on **automatic start** and then continue as on a [PC with Linux](linux.md#2-docker-installieren).

| Platform | Typical for | Note |
|---|---|---|
| **Hyper-V** | Windows 10/11 Pro, Windows Server | See [Windows → Linux VM in Hyper-V](windows.md#linux-vm-in-hyper-v). |
| **XCP-ng** | home servers, a free alternative to VMware | Create a VM from the Debian or Ubuntu template, switch on *Auto power on*. |
| **VMware ESXi** | existing home labs | As with Proxmox; VMware Tools in Linux: package `open-vm-tools`. |
| **VirtualBox, VMware Workstation** | an ordinary desktop PC | Works for trying out. The VM only runs while the PC is on and the program is open – not ideal for long-term operation. |
| **NAS with its own virtualisation** (Synology VMM, QNAP Virtualization Station, Unraid VMs) | NAS | Not needed: these devices can run Docker directly, see the [NAS guides](index.md#was-hast-du). |
