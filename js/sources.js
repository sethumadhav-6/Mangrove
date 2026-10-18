// Live video sources. Everything ends up in one <video> element that the AI loop reads from.
//
//  camera  : HDMI capture card / USB camera (DJI RC Pro, RC Plus, Smart Controller HDMI-out -> capture dongle)
//  screen  : a mirrored controller or DJI app window (getDisplayMedia)
//  whep    : WebRTC from a relay such as MediaMTX that receives the drone's RTMP push (lowest latency over network)
//  hls     : HLS (.m3u8) from a relay (higher latency, works through most networks)
//  file    : a recorded flight video, for testing and post-flight review

let current = { stop() {} };

export async function listCameras() {
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
    tmp.getTracks().forEach((t) => t.stop());
  } catch {}
  const devs = await navigator.mediaDevices.enumerateDevices();
  return devs.filter((d) => d.kind === 'videoinput');
}

function attachStream(video, stream) {
  video.srcObject = stream; video.removeAttribute('src');
  video.muted = true; video.playsInline = true;
  return video.play().catch(() => {});
}

export async function start(video, kind, opts = {}, libs = {}) {
  stop(video);
  if (kind === 'camera') {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: opts.deviceId ? { exact: opts.deviceId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    await attachStream(video, stream);
    current = { stop: () => stream.getTracks().forEach((t) => t.stop()) };
  } else if (kind === 'screen') {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
    await attachStream(video, stream);
    current = { stop: () => stream.getTracks().forEach((t) => t.stop()) };
  } else if (kind === 'whep') {
    current = await startWhep(video, opts.url);
  } else if (kind === 'hls') {
    current = await startHls(video, opts.url, libs.hls);
  } else if (kind === 'file') {
    video.srcObject = null; video.crossOrigin = 'anonymous';
    video.src = URL.createObjectURL(opts.file); video.loop = true; video.muted = true;
    await video.play();
    current = { stop: () => { URL.revokeObjectURL(video.src); video.removeAttribute('src'); video.load(); } };
  }
  return current;
}

export function stop(video) {
  try { current.stop(); } catch {}
  current = { stop() {} };
  if (video) { video.pause(); video.srcObject = null; }
}

async function startWhep(video, url) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  const stream = new MediaStream();
  pc.ontrack = (ev) => { stream.addTrack(ev.track); if (video.srcObject !== stream) attachStream(video, stream); };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 2000);
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } };
  });
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp });
  if (!r.ok) { pc.close(); throw new Error(`WHEP server answered ${r.status}. Is the relay running and the stream path right?`); }
  const resource = r.headers.get('Location');
  await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });
  return {
    stop: () => {
      pc.close();
      if (resource) fetch(new URL(resource, url), { method: 'DELETE' }).catch(() => {});
    },
  };
}

async function startHls(video, url, hlsUrl) {
  video.srcObject = null; video.crossOrigin = 'anonymous'; video.muted = true;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url; await video.play();
    return { stop: () => { video.removeAttribute('src'); video.load(); } };
  }
  const { default: Hls } = await import(hlsUrl);
  const hls = new Hls({ lowLatencyMode: true, liveSyncDuration: 1.5 });
  hls.loadSource(url); hls.attachMedia(video);
  await new Promise((res, rej) => {
    hls.on(Hls.Events.MANIFEST_PARSED, res);
    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) rej(new Error('HLS error: ' + d.details)); });
  });
  await video.play();
  return { stop: () => hls.destroy() };
}
