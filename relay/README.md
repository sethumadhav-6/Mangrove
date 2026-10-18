# Getting the drone video into the browser

Vercel only hosts the web page. It cannot receive a video stream. The video has to reach the browser directly, and the AI then runs on the laptop or tablet that has the page open. There are three ways to do that.

## 1. HDMI capture (recommended for field work)

Works with the **DJI RC Pro, RC Plus and Smart Controller** (and other controllers with HDMI-out).

```
Controller HDMI-out -> USB HDMI capture dongle (UVC, 1080p) -> laptop USB
```

Open the app, choose **Capture card / USB**, then pick the dongle. Latency is about 100–200 ms. It needs no internet once the page and models are cached. The controller's on-screen overlay (OSD) comes through as well. Hide the OSD in the DJI app if you can, or set **Canopy grid rows** so tiles avoid the overlay.

## 2. Screen or window share

* **Android phone controller (DJI RC-N1/N2 with phone):** mirror the phone to the laptop with `scrcpy` over USB. Then choose **Screen or window** and pick the scrcpy window.
* **DJI app on a laptop or tablet:** share that window.

## 3. RTMP → relay → WebRTC / HLS

Use this when the drone app can push RTMP (*Live streaming → RTMP* in DJI Fly on supported drones, or DJI Pilot 2 on Enterprise drones).

1. Run [MediaMTX](https://github.com/bluenviron/mediamtx/releases) on the laptop with `mediamtx.yml` from this folder.
2. Put the controller and laptop on the same network (a phone hotspot is fine).
3. In the DJI app, set RTMP to `rtmp://<laptop-LAN-IP>:1935/drone`.
4. In the app, choose **Relay · WebRTC** and enter `http://localhost:8889/drone/whep`.

**HTTPS rule:** the Vercel page is served over HTTPS. A browser on that page can call `http://localhost`, but it cannot call a plain-`http` LAN or internet address. If the relay is on another machine or a cloud VM, put HTTPS in front of it. A Cloudflare Tunnel or Caddy works, or you can set `webrtcEncryption`/`hlsEncryption` with a certificate in MediaMTX.

**Remote viewing** (the office watching a field flight): run MediaMTX on a small cloud VM with HTTPS and push RTMP to it over 4G. Anyone with the WHEP/HLS URL can then open the Vercel page and run identification on their own machine.

## Field checklist

* Before any flight, check the airspace zone on DGCA Digital Sky. Kochi, for example, has airport and naval zones near several mangrove sites.
* Bird sanctuaries and heronries such as Mangalavanam need Forest Department permission. Keep altitude and distance high enough that birds do not flush. Avoid hovering over active colonies during the breeding season.
