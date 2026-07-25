import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as k8s from '@kubernetes/client-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NAMESPACE = process.env.WATCH_NAMESPACE || 'default';
const LABEL_SELECTOR = process.env.WATCH_LABEL_SELECTOR || 'app=team1-backend';
const CONTAINER = process.env.WATCH_CONTAINER || 'team1-backend';
const LOG_TAIL_LINES = Number(process.env.LOG_TAIL_LINES || 2000);

const kc = new k8s.KubeConfig();
kc.loadFromCluster();
const coreApi = kc.makeApiClient(k8s.CoreV1Api);

// 로그 한 줄에서 유저 활동 이벤트를 뽑아냄 (app.ts 코드는 건드리지 않고,
// 이미 찍히고 있는 로그 문구만 파싱함 — 문구가 바뀌면 여기도 같이 고쳐야 함)
const PATTERNS = [
  {
    type: 'disconnect',
    regex: /\[Server\] 유저 (.+?) 님의 접속이 끊겼습니다\. \(소켓 ID: (\S+)\)/,
    extract: (m) => ({ nickname: m[1], socketId: m[2] }),
  },
  {
    type: 'reconnect',
    regex: /\[Room\] (.+?) 님의 재접속\(새로고침\)으로 방\((.+?)\) 소켓 ID를 갱신하고 동기화했습니다\./,
    extract: (m) => ({ nickname: m[1], room: m[2] }),
  },
  {
    type: 'duplicate_login',
    regex: /\[중복 접속 감지\] (.+?)\(([^)]+)\) 님의 기존 연결을 종료합니다\. \(old: (\S+)\)/,
    extract: (m) => ({ nickname: m[1], email: m[2], oldSocketId: m[3] }),
  },
];

function parseLogLines(rawLog) {
  const events = [];
  const lines = rawLog.split('\n');
  for (const line of lines) {
    // kubectl 로그 라인 앞에 붙는 RFC3339 타임스탬프(--timestamps 사용 시) 분리
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s(.*)$/);
    const timestamp = tsMatch ? tsMatch[1] : null;
    const content = tsMatch ? tsMatch[2] : line;

    for (const p of PATTERNS) {
      const m = content.match(p.regex);
      if (m) {
        events.push({ type: p.type, timestamp, ...p.extract(m) });
        break;
      }
    }
  }
  return events;
}

async function getPodsWithNodes() {
  const res = await coreApi.listNamespacedPod({
    namespace: NAMESPACE,
    labelSelector: LABEL_SELECTOR,
  });
  return (res.items || []).map((pod) => ({
    podName: pod.metadata.name,
    nodeName: pod.spec.nodeName,
    podIP: pod.status.podIP,
    phase: pod.status.phase,
    startTime: pod.status.startTime,
  }));
}

async function getPodLog(podName) {
  const res = await coreApi.readNamespacedPodLog({
    name: podName,
    namespace: NAMESPACE,
    container: CONTAINER,
    tailLines: LOG_TAIL_LINES,
    timestamps: true,
  });
  return typeof res === 'string' ? res : String(res);
}

const app = express();

// ALB 타겟그룹 헬스체크용 — Basic Auth보다 먼저 위치해서 인증 없이 통과되어야 함
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// 유저 닉네임/이메일이 노출되는 내부 운영 도구라 Basic Auth로 최소한의 보호
const MONITOR_USER = process.env.MONITOR_USER;
const MONITOR_PASSWORD = process.env.MONITOR_PASSWORD;

if (MONITOR_USER && MONITOR_PASSWORD) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, password] = Buffer.from(encoded, 'base64').toString().split(':');
      if (user === MONITOR_USER && password === MONITOR_PASSWORD) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="team1-monitor"');
    res.status(401).send('Authentication required');
  });
} else {
  console.warn('[monitor] MONITOR_USER/MONITOR_PASSWORD not set — running without auth!');
}

app.get('/api/connections', async (_req, res) => {
  try {
    const pods = await getPodsWithNodes();

    const results = await Promise.all(
      pods.map(async (pod) => {
        try {
          const rawLog = await getPodLog(pod.podName);
          const events = parseLogLines(rawLog);
          // 최근 이벤트가 위로 오도록 정렬 (타임스탬프 있는 것만 정확히 정렬 가능)
          events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          return { ...pod, events: events.slice(0, 50) };
        } catch (err) {
          return { ...pod, events: [], error: String(err.message || err) };
        }
      })
    );

    res.json({ fetchedAt: new Date().toISOString(), pods: results });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[monitor] listening on :${PORT}`);
});
