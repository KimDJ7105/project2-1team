import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

export interface ClientConfig {
  url: string;
}

export interface DatabaseConfig {
  type: 'memory' | 'mysql'; // 사용할 DB 종류
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

export interface RedisConfig { // redis 정보
  host: string;
  port: number;
  password?: string;
}

export interface AppConfig {
  env: string;
  client: ClientConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
}

interface RawYamlConfig {
  development: AppConfig;
  production: AppConfig;
}

// YAML 파싱 결과에서 ${VAR:default} 패턴을 찾아 실제 환경변수 값으로 치환하는 함수
// process.env에 해당 키가 없으면 콜론(:) 뒤의 기본값을 사용
function resolveEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // 문자열이면 패턴 매칭 후 환경변수로 치환
    return obj.replace(/\$\{(\w+):?(.*?)\}/g, (_, key, defaultVal) => {
      const envVal = process.env[key];
      // process.env 값이 존재하고 빈 문자열이 아니면 사용, 없으면 기본값 사용
      if (envVal !== undefined && envVal !== '') {
        return envVal;
      }
      return defaultVal !== undefined ? defaultVal : '';
    });
  }
  if (Array.isArray(obj)) {
    // 배열이면 각 요소에 재귀 적용
    return obj.map(resolveEnvVars);
  }
  if (typeof obj === 'object' && obj !== null) {
    // 객체이면 각 값에 재귀 적용
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, resolveEnvVars(v)])
    );
  }
  return obj;
}

// 1. NODE_ENV 환경 변수를 확인 (기본값은 development)
const env = process.env.NODE_ENV || 'development';
const configPath = path.join(process.cwd(), 'src', 'config', 'application.yaml');

// 1. YAML 파일 동기 읽기
let fileContents = fs.readFileSync(configPath, 'utf8');

// 2. 문자열을 JavaScript 객체로 파싱 후, resolveEnvVars로 환경변수 치환 적용
const allConfigs = resolveEnvVars(yaml.load(fileContents)) as RawYamlConfig;

// 3. development 혹은 production에 알맞은 설정 뽑아내기
const activeConfig: AppConfig = allConfigs[env as keyof RawYamlConfig] || allConfigs.development;

console.log(`[Config] 현재 활성화된 환경 설정 프로필: ${env.toUpperCase()}`);
console.log(`[Config] 클라이언트 URL: ${activeConfig.client.url}`);
console.log(`[Config] 데이터베이스 타입: ${activeConfig.database.type}`);
console.log(`[Config] Redis 호스트 주소: ${activeConfig.redis.host}`);

export default activeConfig;