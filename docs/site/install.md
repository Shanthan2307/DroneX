---
title: Install
order: 2
group: Get started
summary: Install on macOS, Windows or Linux and check that DroneX is running.
---

Install DroneX to connect real vehicles over USB, radio or your network, and to keep things running without a browser tab.

Download for your computer from [dronex.example/download](/download). Then:

## macOS

Open the `.dmg` and drag **DroneX** onto **Applications**. Wait for copying to finish, then open the installed app. If reinstalling, quit DroneX from its menu bar before replacing it; closing its window leaves it running.

Without administrator access, copy the same app to the **Applications** folder inside your home folder (`~/Applications`). Create that folder if needed. Finder can open it with **Go › Go to Folder** and `~/Applications`. No administrator password is needed for that folder.

Existing 0.3.0 settings and data are preserved. If the old copy is in `/Applications` and you cannot replace it, copy DroneX into your home Applications folder instead and open it from `~/Applications`.

The command-line tool is inside the app: use `~/Applications/DroneX.app/Contents/MacOS/dronex` in place of `dronex` in the commands below.

## Windows

Run the `.msi`. If Windows says "Windows protected your PC", choose **More info**, then **Run anyway**.

## Linux and Raspberry Pi

```
sudo apt update
sudo apt install ./dronex-*.deb
```

The `.deb` installs the desktop app as well as the daemon and command line. Open **DroneX** from your applications menu, or run `dronex open`. To run DroneX without a window, use `systemctl --user start dronex`.

The ARM64 `.deb` is for any 64-bit ARM Linux, such as a Raspberry Pi or an Ubuntu virtual machine on an Apple silicon Mac.

The desktop window needs no graphics card, so it works in a virtual machine too. To start it with other Chromium switches, such as `--ozone-platform=wayland`, put them in `~/.config/dronex-flags.conf`, then open DroneX again.

## Open the app

Open **DroneX** from Applications, Spotlight or the Start menu. It starts DroneX
in the background and follows your window preference. You can also use:

```
dronex open
```

In **Settings › Connections › When I open DroneX**, choose **Open a window**,
**Open in browser** or **Run in menu bar only**. The menu bar has the same
preference and separate **Open window** and **Open in browser** actions. Changing
the preference opens nothing.

Check DroneX is running with:

```
dronex status
```

## The menu bar

While DroneX runs, its icon is in the menu bar on a Mac, the notification area on Windows and the tray on Linux. From its menu you can check DroneX is running, open DroneX or these docs, send feedback with a screenshot, or quit. On GNOME the icon needs the AppIndicator extension. **Show DroneX in the menu bar** in **Settings › DroneX on this computer** turns it off.

**Start DroneX at login** in **Settings › DroneX on this computer**, or `dronex service install`, starts DroneX when you log in, without a window. `dronex service uninstall` turns it off.

## Updates

DroneX checks for new app versions even with its window closed and asks before installing. Open **About › App updates** to check, install, or see what is waiting. Installing restarts DroneX. On macOS, downloading starts after approval and safe shutdown; updates to your own `~/Applications/DroneX.app` need no administrator password. Replacing a protected system installation may require administrator permission. Windows and Linux download updates in the background and may ask for authorization to install.

Choose **Install when idle** to wait for DroneX’s windows and browser tabs to close and for vehicles, recordings, simulations and other work to finish. DroneX also waits for a disconnected real vehicle last seen armed to reconnect and confirm it is disarmed. You can cancel the scheduled update; quitting DroneX cancels it too. Updates never stop that work or restart your computer.

macOS uses Sparkle to replace the complete signed app, Windows uses Windows Installer, and Debian/Ubuntu Linux uses its `.deb` package and polkit. A headless Linux computer can download updates but needs a manual package installation when no desktop authorization agent is available. Interface updates continue separately: **Reload** applies them to an open page.
